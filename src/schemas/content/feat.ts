import { z } from 'zod';
import { EffectSchema } from '../effects.js';

export const FeatSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['origin', 'general', 'fighting-style', 'epic-boon']),
  repeatable: z.boolean().default(false),
  prerequisites: z.array(z.string()).default([]),
  effects: z.array(EffectSchema).default([]),
});
export type Feat = z.infer<typeof FeatSchema>;
