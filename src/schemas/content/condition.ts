import { z } from 'zod';
import { EffectSchema } from '../effects.js';

export const ConditionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  effects: z.array(EffectSchema).default([]),
  stackable: z.boolean().default(false),
  endsOn: z
    .array(
      z.union([
        z.object({ kind: z.literal('shortRest') }),
        z.object({ kind: z.literal('longRest') }),
        z.object({ kind: z.literal('turnEnd'), ownerId: z.string().optional() }),
        z.object({ kind: z.literal('saveSuccess'), ability: z.string(), dc: z.number().int() }),
        z.object({ kind: z.literal('damageTaken') }),
      ]),
    )
    .default([]),
});
export type Condition = z.infer<typeof ConditionSchema>;
