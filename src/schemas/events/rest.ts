import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const ShortRestStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ShortRestStarted'),
  participantIds: z.array(ULIDSchema).min(1),
  // The in-game minutes the rest is expected to last. Default standard
  // rules: 60 minutes for a short rest, 480 for a long rest. Gritty
  // realism (`CampaignSettings.grittyRest` true): 480 short / 10080
  // long. The planner stamps the value from the active settings so
  // consumers can advance the in-game clock by the right amount.
  expectedDurationMinutes: z.number().int().min(1).optional(),
});
export type ShortRestStartedEvent = z.infer<typeof ShortRestStartedEventSchema>;

export const ShortRestEndedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ShortRestEnded'),
});
export type ShortRestEndedEvent = z.infer<typeof ShortRestEndedEventSchema>;

export const LongRestStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('LongRestStarted'),
  participantIds: z.array(ULIDSchema).min(1),
  expectedDurationMinutes: z.number().int().min(1).optional(),
});
export type LongRestStartedEvent = z.infer<typeof LongRestStartedEventSchema>;

export const LongRestEndedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('LongRestEnded'),
});
export type LongRestEndedEvent = z.infer<typeof LongRestEndedEventSchema>;
