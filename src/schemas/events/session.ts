import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';
import { InGameTimeSchema } from '../runtime/in-game-time.js';
import { JournalAuthorKindSchema, JournalVisibilitySchema } from '../runtime/session.js';

export const SessionStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SessionStarted'),
  sessionId: ULIDSchema,
  name: z.string().min(1),
  inGameStart: InGameTimeSchema.optional(),
});
export type SessionStartedEvent = z.infer<typeof SessionStartedEventSchema>;

export const SessionEndedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SessionEnded'),
  sessionId: ULIDSchema,
  summary: z.string().optional(),
});
export type SessionEndedEvent = z.infer<typeof SessionEndedEventSchema>;

export const JournalEntryAddedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('JournalEntryAdded'),
  entryId: ULIDSchema,
  sessionId: ULIDSchema.optional(),
  authorKind: JournalAuthorKindSchema,
  authorCharacterId: ULIDSchema.optional(),
  visibility: JournalVisibilitySchema,
  visibleToCharacterIds: z.array(ULIDSchema).default([]),
  title: z.string().min(1),
  body: z.string(),
});
export type JournalEntryAddedEvent = z.infer<typeof JournalEntryAddedEventSchema>;

export const InGameTimeAdvancedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('InGameTimeAdvanced'),
  minutes: z.number().int().min(1),
  reason: z.string().optional(),
});
export type InGameTimeAdvancedEvent = z.infer<typeof InGameTimeAdvancedEventSchema>;
