// Unit test for the movement-damage mechanic shipped in slice 72.
// Spike Growth (L2, 2d4 piercing per 5 ft moved through zone) is the
// canonical example: the consumer detects movement through the zone
// and calls planTickMovementDamage with the total feet moved; the
// engine rolls 2d4 once per 5-ft increment (floored — 7 ft = 1 hit)
// and emits a single DamageApplied with the summed damage.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildDruid = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Druid',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'druid', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: [],
    preparedSpells: ['spike-growth'],
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Runner',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 8, CHA: 8 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

const PACK = loadStarterPack();

describe('movement-damage mechanic (Spike Growth)', () => {
  it('emits damage proportional to feet moved (4 hits for 20 ft)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const druid = buildDruid();
    const target = buildTarget();
    let campaign = engine.createCampaign({ name: 'sg' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const castEvents = engine.plan.castSpell(campaign.state, {
      characterId: druid.id,
      spellId: 'spike-growth',
      slotLevel: 2,
      targetIds: [],
    }).events;
    campaign = commit(campaign, castEvents);

    const moveEvents = engine.plan.tickMovementDamage(campaign.state, {
      casterId: druid.id,
      targetId: target.id,
      feetMoved: 20,
    }).events;
    const damage = moveEvents.find((e) => e.type === 'DamageApplied');
    expect(damage).toBeDefined();
    expect(damage!.components.some((c) => c.type === 'piercing')).toBe(true);
    const total = damage!.components.reduce((sum, c) => sum + c.amount, 0);
    // 4 hits of 2d4 = 4 to 32 raw damage. With no mitigation the
    // minimum is 8 (4 hits * 2 dice * min roll 1) and max is 32.
    expect(total).toBeGreaterThanOrEqual(8);
    expect(total).toBeLessThanOrEqual(32);
  });

  it('emits zero events when feet moved is less than 5', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const druid = buildDruid();
    const target = buildTarget();
    let campaign = engine.createCampaign({ name: 'sg-zero' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const castEvents = engine.plan.castSpell(campaign.state, {
      characterId: druid.id,
      spellId: 'spike-growth',
      slotLevel: 2,
      targetIds: [],
    }).events;
    campaign = commit(campaign, castEvents);

    const events = engine.plan.tickMovementDamage(campaign.state, {
      casterId: druid.id,
      targetId: target.id,
      feetMoved: 4, // <5 → 0 hits → no damage event
    }).events;
    expect(events).toHaveLength(0);
  });

  it('floors fractional 5-ft increments (7 ft = 1 hit)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const druid = buildDruid();
    const target = buildTarget();
    let campaign = engine.createCampaign({ name: 'sg-floor' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const castEvents = engine.plan.castSpell(campaign.state, {
      characterId: druid.id,
      spellId: 'spike-growth',
      slotLevel: 2,
      targetIds: [],
    }).events;
    campaign = commit(campaign, castEvents);

    const events = engine.plan.tickMovementDamage(campaign.state, {
      casterId: druid.id,
      targetId: target.id,
      feetMoved: 7,
    }).events;
    const damage = events.find((e) => e.type === 'DamageApplied');
    expect(damage).toBeDefined();
    const total = damage!.components.reduce((sum, c) => sum + c.amount, 0);
    // 1 hit of 2d4 = 2 to 8 raw damage.
    expect(total).toBeGreaterThanOrEqual(2);
    expect(total).toBeLessThanOrEqual(8);
  });
});
