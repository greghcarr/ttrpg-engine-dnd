import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';
import { TravelPaceSchema } from '../runtime/travel.js';

export const TravelLegCompletedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('TravelLegCompleted'),
  partyId: ULIDSchema,
  pace: TravelPaceSchema,
  hours: z.number().min(0),
  miles: z.number().min(0),
  fromLocationId: ULIDSchema.optional(),
  toLocationId: ULIDSchema.optional(),
  notes: z.string().optional(),
});
export type TravelLegCompletedEvent = z.infer<typeof TravelLegCompletedEventSchema>;

export const NavigationCheckRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('NavigationCheckRolled'),
  partyId: ULIDSchema,
  navigatorId: ULIDSchema,
  d20: z.number().int().min(1).max(20),
  bonus: z.number().int(),
  total: z.number().int(),
  dc: z.number().int(),
  success: z.boolean(),
});
export type NavigationCheckRolledEvent = z.infer<typeof NavigationCheckRolledEventSchema>;

export const ForagedForEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ForagedFor'),
  partyId: ULIDSchema,
  foragerId: ULIDSchema,
  d20: z.number().int().min(1).max(20),
  bonus: z.number().int(),
  total: z.number().int(),
  dc: z.number().int(),
  success: z.boolean(),
  foodPounds: z.number().int().min(0).default(0),
  waterPounds: z.number().int().min(0).default(0),
});
export type ForagedForEvent = z.infer<typeof ForagedForEventSchema>;
