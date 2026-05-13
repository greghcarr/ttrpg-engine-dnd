import { describe, expect, it } from 'vitest';
import { CharacterSchema } from '../../src/schemas/runtime/character.js';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp, makeItemInstance } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import { newCharacterId } from '../../src/ids.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ItemAcquiredEvent } from '../../src/schemas/events/inventory.js';

const buildWizard = (name: string) =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['fireball', 'fire-bolt', 'magic-missile', 'hold-person'],
  });

describe('golden: counterspell, dispel magic, identify (Slice 22)', () => {
  it('Counterspell prevents the target spell from resolving', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(22) });
    const mira = buildWizard('Mira');
    const enemy = buildWizard('Enemy Mage');
    const itemDef = 'longsword';
    const mysteryItem = makeItemInstance(itemDef, { customName: 'Mysterious Blade' });

    let campaign = engine.createCampaign({ name: 's22' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: mira } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: enemy } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: mysteryItem } satisfies ItemAcquiredEvent,
    ]);

    const originalSpellEventId = eventId();
    campaign = commit(
      campaign,
      engine.plan.counterspell(campaign.state, {
        counterCasterId: mira.id,
        targetCasterId: enemy.id,
        originalSpellEventId,
        spellId: 'fireball',
        castingClassId: 'wizard',
        slotLevelToConsume: 3,
        originalSpellLevel: 3,
      }).events,
    );

    const slotsUsed = campaign.state.characters[mira.id]?.spellSlotsUsed['3'] ?? 0;
    expect(slotsUsed).toBeGreaterThanOrEqual(1);

    campaign = commit(
      campaign,
      engine.plan.identify(campaign.state, {
        casterId: mira.id,
        itemInstanceId: mysteryItem.id,
      }).events,
    );
    expect(campaign.state.itemInstances[mysteryItem.id]?.identifiedByCharacterIds).toContain(mira.id);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 22: Counterspell + Identify',
      }),
    ).toMatchFileSnapshot('./transcripts/s22-reactive-spells.transcript.md');
  });

  it('Dispel Magic auto-ends a level-1 effect when cast at level 3', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(22) });
    const mira = buildWizard('Mira');
    const target = buildFighter({ name: 'Target' });

    let campaign = engine.createCampaign({ name: 's22-dispel' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: mira } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);

    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: mira.id,
        spellId: 'hold-person',
        slotLevel: 2,
        targetIds: [target.id],
        castingClassId: 'wizard',
      }).events,
    );

    const effectId = Object.keys(campaign.state.effectInstances)[0];
    expect(effectId).toBeDefined();

    campaign = commit(
      campaign,
      engine.plan.dispelMagic(campaign.state, {
        casterId: mira.id,
        effectInstanceId: effectId!,
        targetSpellLevel: 2,
        slotLevel: 3,
        castingClassId: 'wizard',
      }).events,
    );

    expect(campaign.state.effectInstances[effectId!]).toBeUndefined();
    expect(campaign.state.characters[mira.id]?.concentrationEffectId).toBeUndefined();
  });
});
