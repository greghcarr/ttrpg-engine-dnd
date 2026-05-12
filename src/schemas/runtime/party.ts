import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { CurrencySchema, emptyCurrency } from './currency.js';

export const PartySchema = z.object({
  id: ULIDSchema,
  name: z.string().min(1),
  memberIds: z.array(ULIDSchema).default([]),
  sharedInventory: z.array(ULIDSchema).default([]),
  purse: CurrencySchema.default(emptyCurrency()),
});
export type Party = z.infer<typeof PartySchema>;
