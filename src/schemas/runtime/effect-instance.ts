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
  startedAtEventId: ULIDSchema,
});
export type EffectInstance = z.infer<typeof EffectInstanceSchema>;
