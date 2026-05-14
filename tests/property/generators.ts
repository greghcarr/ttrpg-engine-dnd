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

export { SMALL_LEVEL };
