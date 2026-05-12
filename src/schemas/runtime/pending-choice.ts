import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EffectSchema } from '../effects.js';

export const ChoiceOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  effects: z.array(EffectSchema).default([]),
});
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

export const PendingChoiceSchema = z.object({
  id: ULIDSchema,
  prompt: z.string(),
  options: z.array(ChoiceOptionSchema).min(1),
  oneOf: z.number().int().min(1).default(1),
  forCharacterId: ULIDSchema,
  triggerEventId: ULIDSchema,
  resolution: z
    .object({
      selectedOptionIds: z.array(z.string()).min(1),
      atEventId: ULIDSchema,
    })
    .optional(),
});
export type PendingChoice = z.infer<typeof PendingChoiceSchema>;
