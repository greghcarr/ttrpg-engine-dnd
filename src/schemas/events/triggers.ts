import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const TriggerFiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('TriggerFired'),
  characterId: ULIDSchema,
  triggerId: z.string(),
  cadence: z
    .object({
      firedThisTurn: z.boolean().optional(),
      firedThisRound: z.boolean().optional(),
      firedThisShortRest: z.boolean().optional(),
      firedThisLongRest: z.boolean().optional(),
    })
    .default({}),
});
export type TriggerFiredEvent = z.infer<typeof TriggerFiredEventSchema>;
