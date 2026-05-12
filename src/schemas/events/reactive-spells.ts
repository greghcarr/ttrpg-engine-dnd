import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';

export const SpellCounteredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SpellCountered'),
  originalSpellEventId: ULIDSchema,
  counterCasterId: ULIDSchema,
  targetCasterId: ULIDSchema,
  spellId: z.string(),
});
export type SpellCounteredEvent = z.infer<typeof SpellCounteredEventSchema>;

export const SpellDispelledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SpellDispelled'),
  effectInstanceId: ULIDSchema,
  dispelledByCharacterId: ULIDSchema,
});
export type SpellDispelledEvent = z.infer<typeof SpellDispelledEventSchema>;

export const ItemIdentifiedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemIdentified'),
  itemInstanceId: ULIDSchema,
  identifiedByCharacterId: ULIDSchema,
});
export type ItemIdentifiedEvent = z.infer<typeof ItemIdentifiedEventSchema>;
