import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';

// Slice 124. Emitted by planAttack / planOffHandAttack when the target
// has a `mirror-image-active` condition and the deflection d20 meets
// the duplicate-pool threshold (6 / 8 / 11 at 3 / 2 / 1 duplicates
// remaining per PHB 2024). The companion `AttackRolled` event records
// the original attacker's roll against the duplicate's AC and stamps
// `hit: false` so bearer-side retaliation riders (Armor of Agathys,
// Fire Shield) don't fire. This event captures the duplicate-side
// math + the resulting pool state.
//
// Reducer: when `duplicateHit` is true, decrement the bearing
// AppliedCondition.level to `duplicatesAfter`. On deflection misses
// the level is unchanged. The planner is responsible for following up
// with a `ConditionRemoved` when `duplicatesAfter === 0`.
export const MirrorImageDeflectedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('MirrorImageDeflected'),
  bearerId: ULIDSchema,
  attackerId: ULIDSchema,
  // The AppliedCondition.id of the bearer's mirror-image-active entry.
  // Identifies which instance to decrement when the bearer carries
  // multiple stacked illusion buffs in the future.
  appliedConditionId: ULIDSchema,
  // The d20 rolled to determine redirect. Threshold inclusive.
  deflectionD20: z.number().int().min(1).max(20),
  deflectionThreshold: z.number().int().min(6).max(11),
  // 10 + bearer DEX modifier. Recomputed at deflection time.
  duplicateAC: z.number().int(),
  // The attack roll vs the duplicate. Mirrors AttackRolled fields so
  // a transcript reader can verify hit/miss math without cross-
  // referencing two events.
  attackD20: z.number().int().min(1).max(20),
  attackTotal: z.number().int(),
  duplicateHit: z.boolean(),
  duplicatesAfter: z.number().int().min(0).max(3),
});
export type MirrorImageDeflectedEvent = z.infer<typeof MirrorImageDeflectedEventSchema>;
