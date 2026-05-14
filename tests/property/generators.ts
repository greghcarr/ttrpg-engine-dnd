// Shared `fast-check` arbitraries for property-based tests.
//
// Generators are intentionally constrained to a slice of the schema
// space — character classes/species/weapons from the test pack, ability
// scores in the realistic 3-20 range — so the generated values are
// always representable by the engine. The aim is to fuzz the
// derivation / reducer / planner pipelines against many *plausible*
// shapes, not to exhaustively explore the entire (much larger) schema
// surface.
//
// When a new property needs a richer generator (e.g. an encounter with
// positions, or a multi-class character), add a focused arbitrary here
// rather than inlining ad-hoc shapes in the test file.

import fc from 'fast-check';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../src/ids.js';

const CLASS_IDS = ['fighter', 'wizard', 'rogue', 'warlock', 'paladin'] as const;
const SPECIES_IDS = ['human'] as const;
const BACKGROUND_IDS = ['soldier'] as const;
const WEAPON_IDS = [
  'longsword',
  'battleaxe',
  'greataxe',
  'rapier',
  'dagger',
  'shortsword',
  'longbow',
] as const;
const ARMOR_IDS = [
  'leather-armor',
  'chain-shirt',
  'chain-mail',
  'plate',
] as const;
const SHIELD_ID = 'shield';

const ABILITY_SCORE = fc.integer({ min: 3, max: 20 });
const LEVEL = fc.integer({ min: 1, max: 20 });
const SMALL_LEVEL = fc.integer({ min: 1, max: 5 });

/**
 * A `fast-check` arbitrary that produces a schema-valid `Character`
 * drawn from a constrained subset of the test pack's content. The
 * character has a single class, fixed species, randomised ability
 * scores in [3, 20], randomised level in [1, 20], and an optional
 * armor / shield in the equipped slot.
 *
 * The character's HP scales loosely with level (10 per level, ±) so
 * derived values don't blow up at extreme levels. Generators target
 * properties that are invariant of HP scaling.
 */
export const characterArb = (): fc.Arbitrary<Character> =>
  fc.record({
    classId: fc.constantFrom(...CLASS_IDS),
    speciesId: fc.constantFrom(...SPECIES_IDS),
    backgroundId: fc.constantFrom(...BACKGROUND_IDS),
    level: LEVEL,
    STR: ABILITY_SCORE,
    DEX: ABILITY_SCORE,
    CON: ABILITY_SCORE,
    INT: ABILITY_SCORE,
    WIS: ABILITY_SCORE,
    CHA: ABILITY_SCORE,
    armorChoice: fc.option(fc.constantFrom(...ARMOR_IDS), { nil: undefined }),
    hasShield: fc.boolean(),
    exhaustion: fc.integer({ min: 0, max: 6 }),
  }).map((spec) => {
    const hpMax = Math.max(1, 10 * spec.level);
    const equipped: Record<string, string | ReadonlyArray<string>> = { attuned: [] };
    if (spec.armorChoice !== undefined) {
      equipped.armor = newItemInstanceId();
    }
    if (spec.hasShield) {
      equipped.shield = newItemInstanceId();
    }
    return CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Property Subject',
      speciesId: spec.speciesId,
      backgroundId: spec.backgroundId,
      classes: [{ classId: spec.classId, level: spec.level, hitDiceRemaining: spec.level }],
      abilityScores: {
        STR: spec.STR,
        DEX: spec.DEX,
        CON: spec.CON,
        INT: spec.INT,
        WIS: spec.WIS,
        CHA: spec.CHA,
      },
      hp: { current: hpMax, max: hpMax, temp: 0 },
      exhaustion: spec.exhaustion,
      featsTaken: ['savage-attacker'],
      equipped,
    }) as Character;
  });

/**
 * Generates the (Character, ItemInstance[]) pair needed when an
 * equipped item-instance must actually exist in the state. The
 * generator harvests the IDs the character's `equipped` slots
 * reference and builds matching instance records pointing at random
 * definitions from the test pack.
 */
export const characterWithEquipmentArb = (): fc.Arbitrary<{
  character: Character;
  itemInstances: ReadonlyArray<ItemInstance>;
}> =>
  fc.tuple(characterArb(), fc.constantFrom(...ARMOR_IDS)).map(([character, armorDef]) => {
    const instances: ItemInstance[] = [];
    if (character.equipped.armor !== undefined) {
      instances.push(
        ItemInstanceSchema.parse({ id: character.equipped.armor, definitionId: armorDef }),
      );
    }
    if (character.equipped.shield !== undefined) {
      instances.push(
        ItemInstanceSchema.parse({ id: character.equipped.shield, definitionId: SHIELD_ID }),
      );
    }
    return { character, itemInstances: instances };
  });

/**
 * Pick a weapon definition id at random — used by derivations that
 * need a target weapon (attack bonus, etc.). Returns the definition
 * id only; the caller owns instance creation.
 */
export const weaponDefIdArb = (): fc.Arbitrary<string> =>
  fc.constantFrom(...WEAPON_IDS);

/**
 * Generates a sequence of "simple" events targeted at a known
 * character — the easiest events to reason about with no cross-state
 * references. Sequence length is bounded; each event is independently
 * shaped so the full chain is always state-consistent at apply time.
 */
export interface SimpleEventSpec {
  readonly kind:
    | 'damage'
    | 'heal'
    | 'tempHP'
    | 'exhaustion-bump';
  readonly amount: number;
}

export const simpleEventSpecArb = (): fc.Arbitrary<SimpleEventSpec> =>
  fc.oneof(
    fc.record({
      kind: fc.constant('damage' as const),
      amount: fc.integer({ min: 1, max: 50 }),
    }),
    fc.record({
      kind: fc.constant('heal' as const),
      amount: fc.integer({ min: 1, max: 30 }),
    }),
    fc.record({
      kind: fc.constant('tempHP' as const),
      amount: fc.integer({ min: 1, max: 20 }),
    }),
    fc.record({
      kind: fc.constant('exhaustion-bump' as const),
      amount: fc.constant(1),
    }),
  );

export const simpleEventSequenceArb = (): fc.Arbitrary<ReadonlyArray<SimpleEventSpec>> =>
  fc.array(simpleEventSpecArb(), { minLength: 1, maxLength: 20 });

// Small-level character used by tests that don't care to fuzz across
// the full L1-20 range — exercises the same generators with a tighter
// scope, useful when the property is sensitive to extreme levels.
export const lowLevelCharacterArb = (): fc.Arbitrary<Character> =>
  characterArb().filter((c) => (c.classes[0]?.level ?? 1) <= 5);

// Test-pack classes paired with their 2024 multiclass prerequisites
// (PHB chapter 2). Used by the multiclass generator to skip class
// combinations the rules forbid for a given ability spread.
//
// Test pack subset: fighter (STR or DEX 13), wizard (INT 13),
// rogue (DEX 13), warlock (CHA 13), paladin (STR 13 and CHA 13).
const PREREQ_ABILITY_FLOOR = 13;
const MULTICLASS_PREREQS: ReadonlyArray<{
  classId: string;
  meets: (scores: { STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number }) => boolean;
}> = [
  { classId: 'fighter', meets: (s) => s.STR >= PREREQ_ABILITY_FLOOR || s.DEX >= PREREQ_ABILITY_FLOOR },
  { classId: 'wizard', meets: (s) => s.INT >= PREREQ_ABILITY_FLOOR },
  { classId: 'rogue', meets: (s) => s.DEX >= PREREQ_ABILITY_FLOOR },
  { classId: 'warlock', meets: (s) => s.CHA >= PREREQ_ABILITY_FLOOR },
  { classId: 'paladin', meets: (s) => s.STR >= PREREQ_ABILITY_FLOOR && s.CHA >= PREREQ_ABILITY_FLOOR },
];

/**
 * A `fast-check` arbitrary that produces a schema-valid multi-class
 * `Character` with 2 or 3 distinct classes drawn from the test pack.
 * Every class in the mix meets its 2024 PHB multiclass prerequisite
 * for the rolled ability spread. Each class level is at least 1; the
 * total level falls in [2, 20].
 *
 * Note: ability scores are constrained to [13, 20] to keep the prereq
 * filter from rejecting most candidates. That's a deliberate trade —
 * the goal of this generator is fuzzing slot/level interactions across
 * class mixes, not exercising low-ability paths (covered elsewhere).
 */
export const multiclassCharacterArb = (): fc.Arbitrary<Character> =>
  fc.record({
    // Pick 2 or 3 classes; we filter for distinctness post-pick.
    classCount: fc.integer({ min: 2, max: 3 }),
    classSeed: fc.array(fc.integer({ min: 0, max: MULTICLASS_PREREQS.length - 1 }), {
      minLength: 3,
      maxLength: 3,
    }),
    // Per-class level seeds; we'll redistribute to hit a total in [2, 20].
    levelSeeds: fc.array(fc.integer({ min: 1, max: 19 }), { minLength: 3, maxLength: 3 }),
    speciesId: fc.constantFrom(...SPECIES_IDS),
    backgroundId: fc.constantFrom(...BACKGROUND_IDS),
    STR: fc.integer({ min: 13, max: 20 }),
    DEX: fc.integer({ min: 13, max: 20 }),
    CON: ABILITY_SCORE,
    INT: fc.integer({ min: 13, max: 20 }),
    WIS: ABILITY_SCORE,
    CHA: fc.integer({ min: 13, max: 20 }),
    exhaustion: fc.integer({ min: 0, max: 6 }),
  }).map((spec) => {
    const scores = { STR: spec.STR, DEX: spec.DEX, CON: spec.CON, INT: spec.INT, WIS: spec.WIS, CHA: spec.CHA };
    // Pick distinct class IDs whose prereqs the ability spread meets.
    const picked: string[] = [];
    for (const seedIdx of spec.classSeed) {
      const prereq = MULTICLASS_PREREQS[seedIdx];
      if (prereq === undefined) continue;
      if (picked.includes(prereq.classId)) continue;
      if (!prereq.meets(scores)) continue;
      picked.push(prereq.classId);
      if (picked.length >= spec.classCount) break;
    }
    // If we couldn't get at least 2 distinct classes that meet prereqs,
    // fall back to fighter+wizard (their prereqs are met by the
    // generator's STR/DEX/INT floors of 13).
    if (picked.length < 2) {
      picked.length = 0;
      picked.push('fighter', 'wizard');
    }
    // Redistribute levels: clamp seeds to a small per-class range, then
    // normalize so totals stay in [picked.length, 20].
    const rawLevels = picked.map((_, idx) => Math.max(1, Math.min(10, spec.levelSeeds[idx] ?? 1)));
    let total = rawLevels.reduce((a, b) => a + b, 0);
    while (total > 20) {
      const maxIdx = rawLevels.indexOf(Math.max(...rawLevels));
      const cur = rawLevels[maxIdx];
      if (cur === undefined || cur <= 1) break;
      rawLevels[maxIdx] = cur - 1;
      total--;
    }
    const totalLevel = rawLevels.reduce((a, b) => a + b, 0);
    const hpMax = Math.max(1, 10 * totalLevel);
    return CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Multiclass Subject',
      speciesId: spec.speciesId,
      backgroundId: spec.backgroundId,
      classes: picked.map((classId, idx) => ({
        classId,
        level: rawLevels[idx] ?? 1,
        hitDiceRemaining: rawLevels[idx] ?? 1,
      })),
      abilityScores: scores,
      hp: { current: hpMax, max: hpMax, temp: 0 },
      exhaustion: spec.exhaustion,
      featsTaken: ['savage-attacker'],
    }) as Character;
  });

export { SMALL_LEVEL };
