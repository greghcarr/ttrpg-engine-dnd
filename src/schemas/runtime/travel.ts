import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

export const TRAVEL_PACES = ['slow', 'normal', 'fast'] as const;
export const TravelPaceSchema = z.enum(TRAVEL_PACES);
export type TravelPace = z.infer<typeof TravelPaceSchema>;

export const TravelLegSchema = z.object({
  partyId: ULIDSchema,
  pace: TravelPaceSchema,
  hours: z.number().min(0),
  miles: z.number().min(0),
  fromLocationId: ULIDSchema.optional(),
  toLocationId: ULIDSchema.optional(),
  notes: z.string().optional(),
  atIso: z.string(),
});
export type TravelLeg = z.infer<typeof TravelLegSchema>;
