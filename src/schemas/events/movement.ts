import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { PositionSchema } from '../runtime/encounter.js';
import { EventEnvelopeSchema } from './envelope.js';

export const CombatantMovedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CombatantMoved'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
  fromPosition: PositionSchema.optional(),
  toPosition: PositionSchema,
  feetTraveled: z.number().min(0),
});
export type CombatantMovedEvent = z.infer<typeof CombatantMovedEventSchema>;

export const DashedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('Dashed'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
});
export type DashedEvent = z.infer<typeof DashedEventSchema>;

export const DisengagedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('Disengaged'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
});
export type DisengagedEvent = z.infer<typeof DisengagedEventSchema>;
