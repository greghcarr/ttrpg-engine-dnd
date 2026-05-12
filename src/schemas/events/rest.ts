import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const ShortRestStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ShortRestStarted'),
  participantIds: z.array(ULIDSchema).min(1),
});
export type ShortRestStartedEvent = z.infer<typeof ShortRestStartedEventSchema>;

export const ShortRestEndedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ShortRestEnded'),
});
export type ShortRestEndedEvent = z.infer<typeof ShortRestEndedEventSchema>;

export const LongRestStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('LongRestStarted'),
  participantIds: z.array(ULIDSchema).min(1),
});
export type LongRestStartedEvent = z.infer<typeof LongRestStartedEventSchema>;

export const LongRestEndedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('LongRestEnded'),
});
export type LongRestEndedEvent = z.infer<typeof LongRestEndedEventSchema>;
