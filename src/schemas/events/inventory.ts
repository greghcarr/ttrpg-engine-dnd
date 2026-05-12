import { z } from 'zod';
import { ItemInstanceSchema } from '../runtime/item-instance.js';
import { EventEnvelopeSchema } from './envelope.js';

export const ItemAcquiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemAcquired'),
  instance: ItemInstanceSchema,
});
export type ItemAcquiredEvent = z.infer<typeof ItemAcquiredEventSchema>;
