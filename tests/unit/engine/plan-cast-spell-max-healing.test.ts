import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { HealedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 205: Life Domain L17 Supreme Healing. RAW: "When you would
// normally roll one or more dice to restore HP with a spell or
// Channel Divinity, you don't roll those dice; you use the highest
// possible value instead." Implemented via the `GrantMaxHealingDice`
// marker primitive on the caster's effect stack; cast-spell.ts's
// heal-mechanic path consults it and replaces every die with its
// max value. Flat modifiers (CHA mod, Disciple of Life boost,
// per-slot bonus dice) compose unchanged on top.

const PACK = loadStarterPack();

const buildCleric = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Solace',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level, hitDiceRemaining: level, subclassId: 'life-domain' }],
    abilityScores: { STR: 12, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
    preparedSpells: ['cure-wounds'],
  });

const buildWoundedAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Wounded',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 5, max: 40, temp: 0 },
    featsTaken: [],
  });

// Cure Wounds: 2d8 at slot 1, +2d8 per slot above 1st. WIS mod = +4
// at score 18. Disciple of Life (Life Domain L3): +(2 + slotLevel)
// for slots >= 1.
//
// Slot 1: 2d8 + 4 (WIS) + 3 (Disciple). Max = 16 + 4 + 3 = 23.
// Slot 3: 2d8 + 4 (extraDicePerSlotLevel) * (3-1) = 6d8 + 4 + 5.
//          Max = 48 + 4 + 5 = 57.

const findHeal = (events: ReadonlyArray<unknown>): HealedEvent =>
  events.find((e): e is HealedEvent => (e as { type?: string }).type === 'Healed')!;

const castCureWounds = (
  seed: number,
  level: number,
  slotLevel: number,
): number => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const cleric = buildCleric(level);
  const ally = buildWoundedAlly();
  let campaign: Campaign = engine.createCampaign({ name: `supreme-${seed}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
  ]);
  const { events } = engine.plan.castSpell(campaign.state, {
    characterId: cleric.id,
    spellId: 'cure-wounds',
    slotLevel,
    targetIds: [ally.id],
  });
  return findHeal(events).amount;
};

describe('Supreme Healing (Life Domain L17)', () => {
  it('L17 cleric: cure-wounds at slot 1 always heals the max value (23)', () => {
    // Deterministic across seeds because dice no longer roll.
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(castCureWounds(seed, 17, 1)).toBe(23);
    }
  });

  it('L17 cleric: cure-wounds at slot 3 always heals the upcast max (57)', () => {
    // 6d8 = 48 max + 4 WIS + 5 Disciple (2 + 3) = 57.
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(castCureWounds(seed, 17, 3)).toBe(57);
    }
  });

  it('L16 cleric (no Supreme Healing yet): cure-wounds at slot 1 produces non-max amounts across seeds', () => {
    let minAmount = Infinity;
    let maxAmount = -Infinity;
    for (let seed = 1; seed <= 30; seed += 1) {
      const amount = castCureWounds(seed, 16, 1);
      minAmount = Math.min(minAmount, amount);
      maxAmount = Math.max(maxAmount, amount);
    }
    // Disciple of Life floor: 2 dice min 1 each = 2 + 4 + 3 = 9.
    // Disciple of Life ceiling: 16 + 4 + 3 = 23.
    expect(minAmount).toBeGreaterThanOrEqual(9);
    expect(maxAmount).toBeLessThanOrEqual(23);
    // Across 30 seeds, at least one should not be max.
    expect(minAmount).toBeLessThan(23);
  });
});
