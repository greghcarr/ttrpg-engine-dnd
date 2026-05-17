import { z } from 'zod';
import { ULIDSchema, DamageTypeSchema, DiceExpressionSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const AttackAdvantageSchema = z.enum(['none', 'advantage', 'disadvantage']);
export type AttackAdvantage = z.infer<typeof AttackAdvantageSchema>;

export const AttackKindSchema = z.enum(['melee', 'ranged']);
export type AttackKind = z.infer<typeof AttackKindSchema>;

export const AttackRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('AttackRolled'),
  attackerId: ULIDSchema,
  targetId: ULIDSchema,
  weaponInstanceId: ULIDSchema,
  d20: z.array(z.number().int().min(1).max(20)).min(1).max(2),
  used: AttackAdvantageSchema,
  attackBonus: z.number().int(),
  total: z.number().int(),
  targetAC: z.number().int(),
  hit: z.boolean(),
  critical: z.boolean(),
  // Mirror of WeaponDefinition.attackKind for the swung weapon. Surfaced
  // on the event so OnEvent rider filters (Armor of Agathys, Fire Shield)
  // can gate on melee-only retaliation via the `event.attackKind` fact.
  // Thrown weapons (dagger, handaxe) classify as 'melee' here — the
  // engine doesn't model whether a thrown-capable weapon was hurled or
  // jabbed this turn. Slice 123.
  attackKind: AttackKindSchema,
  // True when any other positioned, non-incapacitated combatant was
  // within 5 ft of the target at attack time. Surfaced so content
  // predicates (e.g. Rogue Sneak Attack's "ally adjacent" trigger
  // branch) can fire without baking class-specific logic into the
  // engine. The engine doesn't model team/hostility, so this flag
  // treats any third party as an "ally" — content with stricter
  // hostility models can layer additional predicates. Undefined when
  // attacker/target positions are unknown.
  attackerHasAllyAdjacentToTarget: z.boolean().optional(),
});
export type AttackRolledEvent = z.infer<typeof AttackRolledEventSchema>;

// Record-only event surfaced by planAttack when a weapon with the
// `loading` property fires. The reducer adds the weapon instance id to
// the attacker's turnUsage.loadedWeaponsFiredThisTurn array so a
// subsequent attempt to fire the same weapon in the same turn rejects.
// Reset alongside the other per-turn flags at TurnStarted.
export const WeaponLoadedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('WeaponLoaded'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
  weaponInstanceId: ULIDSchema,
});
export type WeaponLoadedEvent = z.infer<typeof WeaponLoadedEventSchema>;

export const DamageRollSchema = z.object({
  expression: DiceExpressionSchema,
  rolls: z.array(z.number().int().min(1)),
  modifier: z.number().int(),
  type: DamageTypeSchema,
});
export type DamageRoll = z.infer<typeof DamageRollSchema>;

export const DamageRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('DamageRolled'),
  attackerId: ULIDSchema,
  targetId: ULIDSchema,
  weaponInstanceId: ULIDSchema,
  rolls: z.array(DamageRollSchema).min(1),
  critical: z.boolean(),
});
export type DamageRolledEvent = z.infer<typeof DamageRolledEventSchema>;
