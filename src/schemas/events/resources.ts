import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const ResourceSpentEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ResourceSpent'),
  characterId: ULIDSchema,
  resourceId: z.string(),
  amount: z.number().int().min(1),
});
export type ResourceSpentEvent = z.infer<typeof ResourceSpentEventSchema>;

export const ResourceRestoredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ResourceRestored'),
  characterId: ULIDSchema,
  resourceId: z.string(),
  amount: z.union([z.number().int().min(0), z.literal('all')]),
});
export type ResourceRestoredEvent = z.infer<typeof ResourceRestoredEventSchema>;

export const HitDieSpentEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('HitDieSpent'),
  characterId: ULIDSchema,
  die: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  rolled: z.number().int().min(1),
  conMod: z.number().int(),
  healed: z.number().int().min(0),
});
export type HitDieSpentEvent = z.infer<typeof HitDieSpentEventSchema>;
