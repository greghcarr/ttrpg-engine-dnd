import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

export const BASTION_FACILITY_KINDS = ['basic', 'special'] as const;
export const BastionFacilityKindSchema = z.enum(BASTION_FACILITY_KINDS);
export type BastionFacilityKind = z.infer<typeof BastionFacilityKindSchema>;

export const BASTION_FACILITY_SPACES = ['cramped', 'roomy', 'vast'] as const;
export const BastionFacilitySpaceSchema = z.enum(BASTION_FACILITY_SPACES);
export type BastionFacilitySpace = z.infer<typeof BastionFacilitySpaceSchema>;

export const BastionFacilitySchema = z.object({
  id: ULIDSchema,
  name: z.string().min(1),
  kind: BastionFacilityKindSchema,
  space: BastionFacilitySpaceSchema,
  description: z.string().optional(),
});
export type BastionFacility = z.infer<typeof BastionFacilitySchema>;

export const BastionHirelingSchema = z.object({
  id: ULIDSchema,
  name: z.string().min(1),
  role: z.string().min(1),
});
export type BastionHireling = z.infer<typeof BastionHirelingSchema>;

export const BastionSchema = z.object({
  id: ULIDSchema,
  name: z.string().min(1),
  ownerCharacterId: ULIDSchema,
  locationId: ULIDSchema.optional(),
  level: z.number().int().min(1).max(9),
  facilities: z.array(BastionFacilitySchema).default([]),
  hirelings: z.array(BastionHirelingSchema).default([]),
  defenders: z.number().int().min(0).default(0),
  treasuryGp: z.number().int().min(0).default(0),
  hpCurrent: z.number().int().min(0),
  hpMax: z.number().int().min(1),
});
export type Bastion = z.infer<typeof BastionSchema>;
