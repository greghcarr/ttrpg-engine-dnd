import { z } from 'zod';
import { CreatureTypeSchema, SizeSchema, SpeedSchema } from '../primitives.js';
import { EffectSchema } from '../effects.js';

export const SpeciesSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: SizeSchema,
  creatureType: CreatureTypeSchema.default('Humanoid'),
  speed: SpeedSchema,
  languages: z.array(z.string()).default([]),
  traits: z.array(EffectSchema).default([]),
});
export type Species = z.infer<typeof SpeciesSchema>;
