import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../src/ids.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { DamageAppliedEvent } from '../../src/schemas/events/combat.js';
import type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../src/schemas/events/spellcasting.js';

const buildCaster = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Mira',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['hold-person'],
  });

describe('golden: concentration cast, taken damage, broken', () => {
  it('Mira casts Hold Person, target paralyzed, Mira takes damage, fails CON save, paralysis ends', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(7) });
    const mira = buildCaster();
    const ogre = buildFighter({
      name: 'Ogre',
      hpMax: 30,
      hpCurrent: 30,
      STR: 14,
      DEX: 8,
      CON: 16,
      WIS: 7,
    });
    let campaign = engine.createCampaign({ name: 'hold-person' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: mira,
      } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: ogre,
      } satisfies CharacterCreatedEvent,
    ]);

    let castEvents = engine.plan.castSpell(campaign.state, {
      characterId: mira.id,
      spellId: 'hold-person',
      slotLevel: 2,
      targetIds: [ogre.id],
    }).events;
    let ogreSavedAgainstHoldPerson = castEvents.some(
      (e) => e.type === 'SaveRolled' && e.targetId === ogre.id && e.success,
    );
    let attempts = 0;
    while (ogreSavedAgainstHoldPerson && attempts < 30) {
      attempts++;
      const retryEngine = createEngine({
        contentPacks: [TEST_PACK],
        rng: seededRNG(7 + attempts),
      });
      const retry = retryEngine.plan.castSpell(campaign.state, {
        characterId: mira.id,
        spellId: 'hold-person',
        slotLevel: 2,
        targetIds: [ogre.id],
      }).events;
      ogreSavedAgainstHoldPerson = retry.some(
        (e) => e.type === 'SaveRolled' && e.targetId === ogre.id && e.success,
      );
      if (!ogreSavedAgainstHoldPerson) {
        castEvents = retry;
      }
    }
    expect(ogreSavedAgainstHoldPerson).toBe(false);

    campaign = commit(campaign, castEvents);
    expect(campaign.state.characters[mira.id]?.concentrationEffectId).toBeDefined();
    expect(
      campaign.state.characters[ogre.id]?.appliedConditions.some(
        (c) => c.conditionId === 'paralyzed',
      ),
    ).toBe(true);

    const damage: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: mira.id,
      components: [{ amount: 18, type: 'slashing' }],
    };
    campaign = commit(campaign, [damage]);

    let concEvents = engine.plan.checkConcentration(campaign.state, {
      characterId: mira.id,
      damageTaken: 18,
    }).events;
    let breakAttempts = 0;
    while (!concEvents.some((e) => e.type === 'ConcentrationBroken') && breakAttempts < 50) {
      breakAttempts++;
      const retryEngine = createEngine({
        contentPacks: [TEST_PACK],
        rng: seededRNG(99 + breakAttempts),
      });
      concEvents = retryEngine.plan.checkConcentration(campaign.state, {
        characterId: mira.id,
        damageTaken: 18,
      }).events;
    }
    expect(concEvents.some((e) => e.type === 'ConcentrationBroken')).toBe(true);

    campaign = commit(campaign, concEvents);

    expect(campaign.state.characters[mira.id]?.concentrationEffectId).toBeUndefined();
    expect(
      campaign.state.characters[ogre.id]?.appliedConditions.some(
        (c) => c.conditionId === 'paralyzed',
      ),
    ).toBe(false);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));

    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Hold Person broken by failed concentration save',
      }),
    ).toMatchFileSnapshot('./transcripts/s6-concentration.transcript.rtf');
  });
});
