import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

export const VEHICLE_KINDS = ['land', 'water', 'air'] as const;
export const VehicleKindSchema = z.enum(VEHICLE_KINDS);
export type VehicleKind = z.infer<typeof VehicleKindSchema>;

export const VehicleSchema = z.object({
  id: ULIDSchema,
  name: z.string().min(1),
  kind: VehicleKindSchema,
  speedFeet: z.number().int().min(0),
  ac: z.number().int().min(0),
  hp: z.object({
    current: z.number().int(),
    max: z.number().int().min(1),
  }),
  capacity: z.number().int().min(1),
  occupantIds: z.array(ULIDSchema).default([]),
});
export type Vehicle = z.infer<typeof VehicleSchema>;
