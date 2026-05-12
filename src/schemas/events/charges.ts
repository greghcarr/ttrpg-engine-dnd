import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';

export const RECHARGE_CADENCES = ['dawn', 'dusk', 'shortRest', 'longRest', 'manual'] as const;
export const RechargeCadenceSchema = z.enum(RECHARGE_CADENCES);
export type RechargeCadence = z.infer<typeof RechargeCadenceSchema>;

export const ItemChargeConsumedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemChargeConsumed'),
  itemInstanceId: ULIDSchema,
  amount: z.number().int().min(1),
  byCharacterId: ULIDSchema.optional(),
  forEffect: z.string().optional(),
});
export type ItemChargeConsumedEvent = z.infer<typeof ItemChargeConsumedEventSchema>;

export const ItemRechargedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemRecharged'),
  itemInstanceId: ULIDSchema,
  amount: z.number().int().min(1),
  cadence: RechargeCadenceSchema,
});
export type ItemRechargedEvent = z.infer<typeof ItemRechargedEventSchema>;

export const SentientItemConflictEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SentientItemConflict'),
  itemInstanceId: ULIDSchema,
  wielderId: ULIDSchema,
  winner: z.enum(['item', 'wielder']),
  description: z.string().optional(),
});
export type SentientItemConflictEvent = z.infer<typeof SentientItemConflictEventSchema>;
