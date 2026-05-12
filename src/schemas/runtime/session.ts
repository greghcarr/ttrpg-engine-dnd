import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { InGameTimeSchema } from './in-game-time.js';

export const SessionSchema = z.object({
  id: ULIDSchema,
  name: z.string().min(1),
  startedAtIso: z.string(),
  endedAtIso: z.string().optional(),
  inGameStart: InGameTimeSchema,
  inGameEnd: InGameTimeSchema.optional(),
  summary: z.string().optional(),
  journalEntryIds: z.array(ULIDSchema).default([]),
});
export type Session = z.infer<typeof SessionSchema>;

export const JOURNAL_AUTHOR_KINDS = ['player', 'dm'] as const;
export const JournalAuthorKindSchema = z.enum(JOURNAL_AUTHOR_KINDS);
export type JournalAuthorKind = z.infer<typeof JournalAuthorKindSchema>;

export const JOURNAL_VISIBILITIES = ['party', 'dm-only', 'character'] as const;
export const JournalVisibilitySchema = z.enum(JOURNAL_VISIBILITIES);
export type JournalVisibility = z.infer<typeof JournalVisibilitySchema>;

export const JournalEntrySchema = z.object({
  id: ULIDSchema,
  sessionId: ULIDSchema.optional(),
  authorKind: JournalAuthorKindSchema,
  authorCharacterId: ULIDSchema.optional(),
  visibility: JournalVisibilitySchema,
  visibleToCharacterIds: z.array(ULIDSchema).default([]),
  title: z.string().min(1),
  body: z.string(),
  createdAtIso: z.string(),
  inGameAt: InGameTimeSchema,
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
