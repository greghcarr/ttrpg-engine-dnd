import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

// Slice 140: lifecycle events for monster breath weapons. The
// SaveRolled + DamageApplied chain per affected target is emitted
// alongside these events by planBreathWeapon; these two events
// carry the higher-level "this breath weapon fired / recharged"
// signal so reducers can flip the bearer's expended flag.

export const BreathWeaponFiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('BreathWeaponFired'),
  monsterId: ULIDSchema,
  // Stable id of the fired breath weapon (matches
  // `MonsterStatblock.breathWeapon.id`). Surfaced so consumers can
  // distinguish if a creature ever ships multiple breath weapons
  // (out of scope for slice 140, but the event shape doesn't lock
  // us in).
  breathWeaponId: z.string(),
});
export type BreathWeaponFiredEvent = z.infer<typeof BreathWeaponFiredEventSchema>;

export const BreathWeaponRechargedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('BreathWeaponRecharged'),
  monsterId: ULIDSchema,
  breathWeaponId: z.string(),
  // The d6 roll that returned the action to ready. Surfaced for
  // transcript display ("Adult Red Dragon's Fire Breath recharges
  // on a 6!").
  roll: z.number().int().min(1).max(6),
});
export type BreathWeaponRechargedEvent = z.infer<typeof BreathWeaponRechargedEventSchema>;
