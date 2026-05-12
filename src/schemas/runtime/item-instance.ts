import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

export const ItemInstanceSchema = z.object({
  id: ULIDSchema,
  definitionId: z.string(),
  customName: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  chargesRemaining: z.number().int().min(0).optional(),
  attuned: z.boolean().default(false),
  attunedTo: ULIDSchema.optional(),
  equippedBy: ULIDSchema.optional(),
  containerId: ULIDSchema.optional(),
  acquiredAtEventId: ULIDSchema.optional(),
  identifiedByCharacterIds: z.array(ULIDSchema).default([]),
});
export type ItemInstance = z.infer<typeof ItemInstanceSchema>;
