import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { PositionSchema } from './encounter.js';

export const TERRAIN_KINDS = ['normal', 'difficult', 'impassable', 'water'] as const;
export const TerrainKindSchema = z.enum(TERRAIN_KINDS);
export type TerrainKind = z.infer<typeof TerrainKindSchema>;

export const DEFAULT_CELL_SIZE_FEET = 5;
export const NORMAL_MOVEMENT_COST = 1;
export const DIFFICULT_MOVEMENT_COST = 2;

export const LocationMapSchema = z.object({
  widthCells: z.number().int().min(1),
  heightCells: z.number().int().min(1),
  cellSizeFeet: z.number().int().min(1).default(DEFAULT_CELL_SIZE_FEET),
  terrain: z.array(z.array(TerrainKindSchema)),
});
export type LocationMap = z.infer<typeof LocationMapSchema>;

export const DOOR_STATES = ['open', 'closed', 'locked'] as const;
export const DoorStateSchema = z.enum(DOOR_STATES);
export type DoorState = z.infer<typeof DoorStateSchema>;

export const DoorSchema = z.object({
  id: ULIDSchema,
  locationId: ULIDSchema,
  name: z.string().optional(),
  position: PositionSchema,
  state: DoorStateSchema,
});
export type Door = z.infer<typeof DoorSchema>;

export const LocationSchema = z.object({
  id: ULIDSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  parentLocationId: ULIDSchema.optional(),
  map: LocationMapSchema.optional(),
  doorIds: z.array(ULIDSchema).default([]),
});
export type Location = z.infer<typeof LocationSchema>;
