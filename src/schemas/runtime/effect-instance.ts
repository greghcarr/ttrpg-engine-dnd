import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

export const AppliedConditionRefSchema = z.object({
  targetId: ULIDSchema,
  conditionId: z.string(),
  appliedConditionId: ULIDSchema,
});
export type AppliedConditionRef = z.infer<typeof AppliedConditionRefSchema>;

export const EffectInstanceSchema = z.object({
  id: ULIDSchema,
  spellId: z.string(),
  casterId: ULIDSchema,
  targetIds: z.array(ULIDSchema).default([]),
  conditionsApplied: z.array(AppliedConditionRefSchema).default([]),
  requiresConcentration: z.boolean(),
  durationRounds: z.number().int().min(0).optional(),
  // Wall-clock duration of the spell in in-game minutes. Set when the
  // effect starts; used by planExpireSpellDurations to clear effects
  // whose listed duration has elapsed (Bless 1 min, Heroes' Feast 24h).
  durationMinutes: z.number().int().min(0).optional(),
  // In-game time (state.inGameTime.totalMinutes) at which the effect
  // started. Combined with durationMinutes to determine expiry.
  startedAtMinutes: z.number().int().min(0).optional(),
  // The slot level the spell was cast at. Needed by planTickAura (and
  // any future planner that needs to scale per-cast effects based on the
  // upcasted slot level) since the consumer doesn't always have the cast
  // intent in hand at tick time.
  slotLevel: z.number().int().min(0).optional(),
  startedAtEventId: ULIDSchema,
});
export type EffectInstance = z.infer<typeof EffectInstanceSchema>;
