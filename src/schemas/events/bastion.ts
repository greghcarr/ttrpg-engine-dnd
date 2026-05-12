import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';
import { BastionFacilityKindSchema, BastionFacilitySpaceSchema } from '../runtime/bastion.js';

export const BASTION_TURN_ORDERS = ['maintain', 'craft', 'recruit', 'research', 'trade', 'empower'] as const;
export const BastionTurnOrderSchema = z.enum(BASTION_TURN_ORDERS);
export type BastionTurnOrder = z.infer<typeof BastionTurnOrderSchema>;

export const BastionFoundedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('BastionFounded'),
  bastionId: ULIDSchema,
  name: z.string().min(1),
  ownerCharacterId: ULIDSchema,
  locationId: ULIDSchema.optional(),
  level: z.number().int().min(1).max(9).default(1),
  hpMax: z.number().int().min(1).default(50),
});
export type BastionFoundedEvent = z.infer<typeof BastionFoundedEventSchema>;

export const BastionFacilityAddedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('BastionFacilityAdded'),
  bastionId: ULIDSchema,
  facilityId: ULIDSchema,
  name: z.string().min(1),
  kind: BastionFacilityKindSchema,
  space: BastionFacilitySpaceSchema,
  description: z.string().optional(),
});
export type BastionFacilityAddedEvent = z.infer<typeof BastionFacilityAddedEventSchema>;

export const BastionHirelingAddedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('BastionHirelingAdded'),
  bastionId: ULIDSchema,
  hirelingId: ULIDSchema,
  name: z.string().min(1),
  role: z.string().min(1),
});
export type BastionHirelingAddedEvent = z.infer<typeof BastionHirelingAddedEventSchema>;

export const BastionTurnTakenEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('BastionTurnTaken'),
  bastionId: ULIDSchema,
  order: BastionTurnOrderSchema,
  treasuryDeltaGp: z.number().int().default(0),
  summary: z.string().optional(),
});
export type BastionTurnTakenEvent = z.infer<typeof BastionTurnTakenEventSchema>;

export const BastionDamagedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('BastionDamaged'),
  bastionId: ULIDSchema,
  amount: z.number().int().min(0),
  source: z.string().optional(),
});
export type BastionDamagedEvent = z.infer<typeof BastionDamagedEventSchema>;

export const BastionLevelChangedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('BastionLevelChanged'),
  bastionId: ULIDSchema,
  fromLevel: z.number().int().min(1).max(9),
  toLevel: z.number().int().min(1).max(9),
});
export type BastionLevelChangedEvent = z.infer<typeof BastionLevelChangedEventSchema>;
