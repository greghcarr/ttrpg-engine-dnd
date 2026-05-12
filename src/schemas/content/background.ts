import { z } from 'zod';
import { AbilityScoreSchema, SkillSchema } from '../primitives.js';
import { EffectSchema } from '../effects.js';

export const BackgroundSchema = z.object({
  id: z.string(),
  name: z.string(),
  abilityScoreIncreases: z.object({
    options: z.array(AbilityScoreSchema).min(2),
    pattern: z.enum(['+2/+1', '+1/+1/+1']),
  }),
  skillProficiencies: z.array(SkillSchema).default([]),
  toolProficiencies: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  originFeatId: z.string(),
  traits: z.array(EffectSchema).default([]),
});
export type Background = z.infer<typeof BackgroundSchema>;
