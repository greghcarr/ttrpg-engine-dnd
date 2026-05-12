import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';
import { VehicleKindSchema } from '../runtime/vehicle.js';

export const MountedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('Mounted'),
  riderId: ULIDSchema,
  mountId: ULIDSchema,
});
export type MountedEvent = z.infer<typeof MountedEventSchema>;

export const DismountedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('Dismounted'),
  riderId: ULIDSchema,
  mountId: ULIDSchema,
  voluntary: z.boolean().default(true),
});
export type DismountedEvent = z.infer<typeof DismountedEventSchema>;

export const VehicleAcquiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('VehicleAcquired'),
  vehicleId: ULIDSchema,
  name: z.string().min(1),
  kind: VehicleKindSchema,
  speedFeet: z.number().int().min(0),
  ac: z.number().int().min(0),
  maxHp: z.number().int().min(1),
  capacity: z.number().int().min(1),
});
export type VehicleAcquiredEvent = z.infer<typeof VehicleAcquiredEventSchema>;

export const VehicleBoardedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('VehicleBoarded'),
  vehicleId: ULIDSchema,
  characterId: ULIDSchema,
});
export type VehicleBoardedEvent = z.infer<typeof VehicleBoardedEventSchema>;

export const VehicleDepartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('VehicleDeparted'),
  vehicleId: ULIDSchema,
  characterId: ULIDSchema,
});
export type VehicleDepartedEvent = z.infer<typeof VehicleDepartedEventSchema>;

export const VehicleDamagedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('VehicleDamaged'),
  vehicleId: ULIDSchema,
  amount: z.number().int().min(0),
  source: z.string().optional(),
});
export type VehicleDamagedEvent = z.infer<typeof VehicleDamagedEventSchema>;

export const VehicleRepairedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('VehicleRepaired'),
  vehicleId: ULIDSchema,
  amount: z.number().int().min(0),
});
export type VehicleRepairedEvent = z.infer<typeof VehicleRepairedEventSchema>;
