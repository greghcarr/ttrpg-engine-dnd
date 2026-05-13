import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../src/ids.js';
import { computeAvailableSpellSlots } from '../../src/derive/spell-slots.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import { formatTranscript } from '../transcript.js';

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Mage',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['fire-bolt', 'fireball', 'hold-person'],
  });

describe('golden: spellcasting end to end', () => {
  it('wizard casts fireball, slots are consumed, replay matches', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(11) });
    const wizard = buildWizard();
    const a = buildFighter({ name: 'Goblin A', hpMax: 30, hpCurrent: 30 });
    const b = buildFighter({ name: 'Goblin B', hpMax: 30, hpCurrent: 30 });
    let campaign = engine.createCampaign({ name: 'fireball-day' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
    ]);

    const before = computeAvailableSpellSlots(
      campaign.state.characters[wizard.id]!,
      engine.content.classes,
    );

    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'fireball',
        slotLevel: 3,
        targetIds: [a.id, b.id],
      }).events,
    );

    const after = computeAvailableSpellSlots(
      campaign.state.characters[wizard.id]!,
      engine.content.classes,
    );
    expect(after.standardByLevel[2]).toBe((before.standardByLevel[2] ?? 0) - 1);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));

    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Wizard casts Fireball at two goblins',
      }),
    ).toMatchFileSnapshot('./transcripts/s5-cast-spell-fireball.transcript.rtf');
  });

  it('long rest fully restores spell slots', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(7) });
    const wizard = buildWizard();
    let campaign = engine.createCampaign({ name: 'restore' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    // Cast fireball once
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'fireball',
        slotLevel: 3,
        targetIds: [],
      }).events,
    );
    expect(campaign.state.characters[wizard.id]?.spellSlotsUsed['3']).toBe(1);

    // Long rest
    campaign = commit(
      campaign,
      engine.plan.longRest(campaign.state, { participantIds: [wizard.id] }).events,
    );
    expect(campaign.state.characters[wizard.id]?.spellSlotsUsed).toEqual({});

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Cast Fireball, then long rest restores the slot',
      }),
    ).toMatchFileSnapshot('./transcripts/s5-cast-spell-long-rest.transcript.rtf');
  });
});
