import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { CharacterSchema } from './character.js';
import { ItemInstanceSchema } from './item-instance.js';
import { PendingChoiceSchema } from './pending-choice.js';
import { EncounterSchema } from './encounter.js';
import { EffectInstanceSchema } from './effect-instance.js';
import { PartySchema } from './party.js';
import { SessionSchema, JournalEntrySchema } from './session.js';
import { InGameTimeSchema } from './in-game-time.js';

export const CampaignStateSchema = z.object({
  characters: z.record(ULIDSchema, CharacterSchema).default({}),
  itemInstances: z.record(ULIDSchema, ItemInstanceSchema).default({}),
  pendingChoices: z.record(ULIDSchema, PendingChoiceSchema).default({}),
  encounters: z.record(ULIDSchema, EncounterSchema).default({}),
  effectInstances: z.record(ULIDSchema, EffectInstanceSchema).default({}),
  parties: z.record(ULIDSchema, PartySchema).default({}),
  sessions: z.record(ULIDSchema, SessionSchema).default({}),
  journalEntries: z.record(ULIDSchema, JournalEntrySchema).default({}),
  inGameTime: InGameTimeSchema.default({ totalMinutes: 0 }),
  activeSessionId: ULIDSchema.optional(),
  activeShortRest: z
    .object({
      startedAtEventId: ULIDSchema,
      participantIds: z.array(ULIDSchema),
    })
    .optional(),
  activeLongRest: z
    .object({
      startedAtEventId: ULIDSchema,
      participantIds: z.array(ULIDSchema),
    })
    .optional(),
  activeEncounterId: ULIDSchema.optional(),
  version: z.number().int().min(0).default(0),
});
export type CampaignState = z.infer<typeof CampaignStateSchema>;

export const emptyCampaignState = (): CampaignState => ({
  characters: {},
  itemInstances: {},
  pendingChoices: {},
  encounters: {},
  effectInstances: {},
  parties: {},
  sessions: {},
  journalEntries: {},
  inGameTime: { totalMinutes: 0 },
  version: 0,
});
