import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { Event } from '../../../src/schemas/events/index.js';

const buildSleepCaster = (level = 1): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Sleep Caster',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level, hitDiceRemaining: level }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 8 * level, max: 8 * level, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['sleep'],
  });

const buildSleepy = (name: string, hp: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: hp, max: hp, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const conditionsFor = (events: ReadonlyArray<Event>, targetId: string): string[] =>
  events
    .filter((e): e is Extract<Event, { type: 'ConditionApplied' }> => e.type === 'ConditionApplied')
    .filter((e) => e.targetId === targetId)
    .map((e) => e.conditionId);

describe('Sleep: HP-pool knockout (2024)', () => {
  it('applies unconscious to targets in ascending-HP order, stopping when the pool runs out', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(42) });
    const caster = buildSleepCaster();
    const t4 = buildSleepy('T4', 4);
    const t8 = buildSleepy('T8', 8);
    const t40 = buildSleepy('T40', 40);
    let campaign = engine.createCampaign({ name: 'sleep' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t4 } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t8 } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t40 } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: caster.id,
      spellId: 'sleep',
      slotLevel: 1,
      targetIds: [t40.id, t4.id, t8.id], // order in the intent shouldn't matter
    });
    // 5d8 averages 22.5; T4 (4 HP) is always covered, T8 (8 HP) often is,
    // T40 (40 HP) is never covered by a base-level Sleep.
    const t4Conds = conditionsFor(events, t4.id);
    expect(t4Conds).toContain('unconscious');
    const t40Conds = conditionsFor(events, t40.id);
    expect(t40Conds).not.toContain('unconscious');
  });

  it('skips targets that already have the condition', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(2) });
    const caster = buildSleepCaster();
    const t4 = buildSleepy('T4', 4);
    let campaign = engine.createCampaign({ name: 'sleep-skip' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t4 } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: t4.id,
        conditionId: 'unconscious',
      },
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: caster.id,
      spellId: 'sleep',
      slotLevel: 1,
      targetIds: [t4.id],
    });
    const t4Conds = conditionsFor(events, t4.id);
    expect(t4Conds).not.toContain('unconscious');
  });

  it('upcasting expands the pool (slot 3 covers an 8-HP target reliably)', () => {
    const PACK = loadStarterPack();
    // With 5d8+2d8+2d8 = 9d8 (min 9, max 72, avg ~40), an 8-HP target
    // should be reliably covered for any seed.
    for (let seed = 0; seed < 20; seed++) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const caster = buildSleepCaster(5);
      const t8 = buildSleepy('T8', 8);
      let campaign = engine.createCampaign({ name: 'sleep-up' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t8 } satisfies CharacterCreatedEvent,
      ]);
      const { events } = engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'sleep',
        slotLevel: 3,
        targetIds: [t8.id],
      });
      expect(conditionsFor(events, t8.id)).toContain('unconscious');
    }
  });
});
