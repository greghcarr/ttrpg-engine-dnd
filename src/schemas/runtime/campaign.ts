import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { CharacterSchema } from './character.js';
import { ItemInstanceSchema } from './item-instance.js';
import { PendingChoiceSchema } from './pending-choice.js';
import { EncounterSchema } from './encounter.js';

export const CampaignStateSchema = z.object({
  characters: z.record(ULIDSchema, CharacterSchema).default({}),
  itemInstances: z.record(ULIDSchema, ItemInstanceSchema).default({}),
  pendingChoices: z.record(ULIDSchema, PendingChoiceSchema).default({}),
  encounters: z.record(ULIDSchema, EncounterSchema).default({}),
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
  version: 0,
});
