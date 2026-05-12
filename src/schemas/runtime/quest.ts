import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { CurrencySchema, emptyCurrency } from './currency.js';

export const QUEST_STATUSES = ['active', 'completed', 'failed', 'abandoned'] as const;
export const QuestStatusSchema = z.enum(QUEST_STATUSES);
export type QuestStatus = z.infer<typeof QuestStatusSchema>;

export const OBJECTIVE_STATUSES = ['pending', 'completed', 'failed'] as const;
export const ObjectiveStatusSchema = z.enum(OBJECTIVE_STATUSES);
export type ObjectiveStatus = z.infer<typeof ObjectiveStatusSchema>;

export const QuestObjectiveSchema = z.object({
  id: ULIDSchema,
  description: z.string().min(1),
  status: ObjectiveStatusSchema.default('pending'),
  optional: z.boolean().default(false),
  progress: z.number().int().min(0).default(0),
  required: z.number().int().min(1).optional(),
});
export type QuestObjective = z.infer<typeof QuestObjectiveSchema>;

export const QuestRewardSchema = z.object({
  xpPerCharacter: z.number().int().min(0).default(0),
  currency: CurrencySchema.default(emptyCurrency()),
  itemDefinitionIds: z.array(z.string()).default([]),
});
export type QuestReward = z.infer<typeof QuestRewardSchema>;

export const QuestSchema = z.object({
  id: ULIDSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  status: QuestStatusSchema.default('active'),
  partyId: ULIDSchema.optional(),
  objectives: z.array(QuestObjectiveSchema).default([]),
  reward: QuestRewardSchema.default({
    xpPerCharacter: 0,
    currency: emptyCurrency(),
    itemDefinitionIds: [],
  }),
  rewardClaimed: z.boolean().default(false),
  startedAtIso: z.string().optional(),
  endedAtIso: z.string().optional(),
});
export type Quest = z.infer<typeof QuestSchema>;
