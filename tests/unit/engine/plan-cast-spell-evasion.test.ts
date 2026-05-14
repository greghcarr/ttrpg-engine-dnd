import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Rogue / Monk Evasion (L7). Bug this prevents: a Fireball cast
// at a Rogue with Evasion should deal 0 damage on a successful DEX
// save and half on a failed one. Without wiring, the standard formula
// applies (full on fail, half on success).

const PACK = loadStarterPack();

const buildRogue = (opts: { level?: number; dex?: number } = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Lyra',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'rogue', level: opts.level ?? 7, hitDiceRemaining: opts.level ?? 7 }],
    abilityScores: { STR: 10, DEX: opts.dex ?? 18, CON: 12, INT: 12, WIS: 12, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
  });

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Mira',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 7, hitDiceRemaining: 7 }],
    abilityScores: { STR: 8, DEX: 12, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    preparedSpells: ['fireball'],
  });

const cast = (target: Character, seed = 0) => {
  const wizard = buildWizard();
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  let campaign: Campaign = engine.createCampaign({ name: 'evasion-test' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return engine.plan.castSpell(campaign.state, {
    characterId: wizard.id,
    spellId: 'fireball',
    slotLevel: 3,
    targetIds: [target.id],
  }).events;
};

const damageFor = (events: ReadonlyArray<{ readonly type: string }>): number => {
  const dmg = events.find((e) => e.type === 'DamageApplied') as DamageAppliedEvent | undefined;
  if (!dmg) return 0;
  return dmg.components.reduce((sum, c) => sum + c.amount, 0);
};

describe('Evasion (Rogue L7 / Monk L7)', () => {
  it('a Rogue L7 takes 0 damage from Fireball on successful DEX save', () => {
    // Loop seeds to find one where the save succeeds.
    for (let seed = 0; seed < 200; seed++) {
      const target = buildRogue();
      const events = cast(target, seed);
      const save = events.find((e) => e.type === 'SaveRolled') as SaveRolledEvent | undefined;
      if (save?.success === true) {
        expect(damageFor(events)).toBe(0);
        return;
      }
    }
    throw new Error('no successful save found in 200 seeds');
  });

  it('a Rogue L7 takes half damage from Fireball on failed DEX save', () => {
    for (let seed = 0; seed < 200; seed++) {
      const target = buildRogue({ dex: 8 });
      const events = cast(target, seed);
      const save = events.find((e) => e.type === 'SaveRolled') as SaveRolledEvent | undefined;
      if (save?.success === false) {
        // 8d6 averages ~28. Half ~14. Match against the actual save result.
        const damage = damageFor(events);
        expect(damage).toBeGreaterThan(0);
        expect(damage).toBeLessThanOrEqual(48 / 2);
        return;
      }
    }
    throw new Error('no failed save found in 200 seeds');
  });

  it('a non-Evasion Fighter takes full damage on a failed DEX save (regression)', () => {
    const fighter = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Plain Fighter',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 7, hitDiceRemaining: 7 }],
      abilityScores: { STR: 16, DEX: 8, CON: 14, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 50, max: 50, temp: 0 },
      featsTaken: [],
    });
    for (let seed = 0; seed < 200; seed++) {
      const events = cast(fighter, seed);
      const save = events.find((e) => e.type === 'SaveRolled') as SaveRolledEvent | undefined;
      if (save?.success === false) {
        // 8d6 sum; with min 8 + max 48. Should be full damage.
        const damage = damageFor(events);
        expect(damage).toBeGreaterThanOrEqual(8);
        expect(damage).toBeLessThanOrEqual(48);
        return;
      }
    }
    throw new Error('no failed save in 200 seeds');
  });

  it('a Rogue at L6 (pre-Evasion) takes the standard half-on-success damage', () => {
    for (let seed = 0; seed < 200; seed++) {
      const target = buildRogue({ level: 6 });
      const events = cast(target, seed);
      const save = events.find((e) => e.type === 'SaveRolled') as SaveRolledEvent | undefined;
      if (save?.success === true) {
        const damage = damageFor(events);
        // half of 8d6 (8 to 48) → 4 to 24.
        expect(damage).toBeGreaterThanOrEqual(4);
        expect(damage).toBeLessThanOrEqual(24);
        return;
      }
    }
    throw new Error('no successful save in 200 seeds');
  });
});
