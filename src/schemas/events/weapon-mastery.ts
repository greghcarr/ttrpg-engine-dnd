import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema, WeaponMasterySchema } from '../primitives.js';

export const WeaponMasteryActivatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('WeaponMasteryActivated'),
  mastery: WeaponMasterySchema,
  attackerId: ULIDSchema,
  targetId: ULIDSchema.optional(),
  weaponInstanceId: ULIDSchema,
});
export type WeaponMasteryActivatedEvent = z.infer<typeof WeaponMasteryActivatedEventSchema>;
