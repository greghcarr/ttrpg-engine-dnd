import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { ChoiceOptionSchema } from '../runtime/pending-choice.js';
import { EventEnvelopeSchema } from './envelope.js';

export const HPStrategySchema = z.enum(['roll', 'average']);
export type HPStrategy = z.infer<typeof HPStrategySchema>;

export const LevelUpResolvedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('LevelUpResolved'),
  characterId: ULIDSchema,
  classId: z.string(),
  newClassLevel: z.number().int().min(2).max(20),
  hpStrategy: HPStrategySchema,
  hpRoll: z.number().int().min(1).optional(),
  hpGained: z.number().int().min(1),
});
export type LevelUpResolvedEvent = z.infer<typeof LevelUpResolvedEventSchema>;

export const ChoiceRequiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ChoiceRequired'),
  choiceId: ULIDSchema,
  characterId: ULIDSchema,
  promptKey: z.string(),
  prompt: z.string(),
  options: z.array(ChoiceOptionSchema).min(1),
  oneOf: z.number().int().min(1),
});
export type ChoiceRequiredEvent = z.infer<typeof ChoiceRequiredEventSchema>;

export const ChoiceResolvedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ChoiceResolved'),
  choiceId: ULIDSchema,
  characterId: ULIDSchema,
  selectedOptionIds: z.array(z.string()).min(1),
});
export type ChoiceResolvedEvent = z.infer<typeof ChoiceResolvedEventSchema>;
