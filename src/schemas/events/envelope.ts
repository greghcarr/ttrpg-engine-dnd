import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

export const EventEnvelopeSchema = z.object({
  id: ULIDSchema,
  at: z.string(),
  sessionId: ULIDSchema.optional(),
  causedByEventId: ULIDSchema.optional(),
  actorId: ULIDSchema.optional(),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
