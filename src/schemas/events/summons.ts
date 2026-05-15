import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';

// Emitted by planCastSpell when a spell with a `summon` mechanic is
// cast. The reducer materializes a Character in state.characters
// with `kind: 'creature'` and a `summonSource` pointer that ties
// the companion to its caster and (optionally) its concentration
// effect for automatic cleanup.
export const CompanionSummonedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CompanionSummoned'),
  companionId: ULIDSchema,
  controllerId: ULIDSchema,
  spellId: z.string(),
  slotLevel: z.number().int().min(1).max(9),
  name: z.string().min(1),
  ac: z.number().int().min(0),
  hp: z.number().int().min(1),
  speedFeet: z.number().int().min(0),
  effectInstanceId: ULIDSchema.optional(),
});
export type CompanionSummonedEvent = z.infer<typeof CompanionSummonedEventSchema>;

// Emitted explicitly by planDismissCompanion to remove a companion
// the consumer is keeping around. The reducer deletes the character
// from state.characters. Concentration-driven dismissal happens
// inside clearConcentrationEffect without emitting this event (it
// mirrors how condition cleanup works on concentration break).
export const CompanionDismissedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CompanionDismissed'),
  companionId: ULIDSchema,
});
export type CompanionDismissedEvent = z.infer<typeof CompanionDismissedEventSchema>;
