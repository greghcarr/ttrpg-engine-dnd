import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const EncounterCreatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('EncounterCreated'),
  encounterId: ULIDSchema,
  name: z.string().optional(),
  combatantIds: z.array(ULIDSchema).min(1),
});
export type EncounterCreatedEvent = z.infer<typeof EncounterCreatedEventSchema>;

export const InitiativeRollSchema = z.object({
  combatantId: ULIDSchema,
  d20: z.number().int().min(1).max(20),
  modifier: z.number().int(),
  total: z.number().int(),
});
export type InitiativeRoll = z.infer<typeof InitiativeRollSchema>;

export const InitiativeRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('InitiativeRolled'),
  encounterId: ULIDSchema,
  rolls: z.array(InitiativeRollSchema).min(1),
});
export type InitiativeRolledEvent = z.infer<typeof InitiativeRolledEventSchema>;

export const EncounterStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('EncounterStarted'),
  encounterId: ULIDSchema,
});
export type EncounterStartedEvent = z.infer<typeof EncounterStartedEventSchema>;

export const TurnStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('TurnStarted'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
  round: z.number().int().min(1),
});
export type TurnStartedEvent = z.infer<typeof TurnStartedEventSchema>;

export const TurnEndedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('TurnEnded'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
  round: z.number().int().min(1),
});
export type TurnEndedEvent = z.infer<typeof TurnEndedEventSchema>;

export const RoundEndedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('RoundEnded'),
  encounterId: ULIDSchema,
  round: z.number().int().min(1),
});
export type RoundEndedEvent = z.infer<typeof RoundEndedEventSchema>;

export const EncounterEndedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('EncounterEnded'),
  encounterId: ULIDSchema,
  outcome: z.enum(['victory', 'defeat', 'fled', 'parley']),
});
export type EncounterEndedEvent = z.infer<typeof EncounterEndedEventSchema>;
