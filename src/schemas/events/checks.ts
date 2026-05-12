import { z } from 'zod';
import { AbilityScoreSchema, SkillSchema, ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const CheckAdvantageSchema = z.enum(['none', 'advantage', 'disadvantage']);
export type CheckAdvantage = z.infer<typeof CheckAdvantageSchema>;

export const SaveRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SaveRolled'),
  targetId: ULIDSchema,
  ability: AbilityScoreSchema,
  dc: z.number().int().min(1),
  d20: z.array(z.number().int().min(1).max(20)).min(1).max(2),
  used: CheckAdvantageSchema,
  bonus: z.number().int(),
  total: z.number().int(),
  success: z.boolean(),
});
export type SaveRolledEvent = z.infer<typeof SaveRolledEventSchema>;

export const AbilityCheckRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('AbilityCheckRolled'),
  characterId: ULIDSchema,
  ability: AbilityScoreSchema,
  skill: SkillSchema.optional(),
  dc: z.number().int().min(1).optional(),
  d20: z.array(z.number().int().min(1).max(20)).min(1).max(2),
  used: CheckAdvantageSchema,
  bonus: z.number().int(),
  total: z.number().int(),
  success: z.boolean().optional(),
});
export type AbilityCheckRolledEvent = z.infer<typeof AbilityCheckRolledEventSchema>;
