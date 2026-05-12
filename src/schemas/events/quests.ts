import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';
import { QuestObjectiveSchema, QuestRewardSchema } from '../runtime/quest.js';

export const QuestStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('QuestStarted'),
  questId: ULIDSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  partyId: ULIDSchema.optional(),
  objectives: z.array(QuestObjectiveSchema).default([]),
  reward: QuestRewardSchema.optional(),
});
export type QuestStartedEvent = z.infer<typeof QuestStartedEventSchema>;

export const ObjectiveProgressedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ObjectiveProgressed'),
  questId: ULIDSchema,
  objectiveId: ULIDSchema,
  delta: z.number().int().min(1).default(1),
});
export type ObjectiveProgressedEvent = z.infer<typeof ObjectiveProgressedEventSchema>;

export const ObjectiveCompletedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ObjectiveCompleted'),
  questId: ULIDSchema,
  objectiveId: ULIDSchema,
});
export type ObjectiveCompletedEvent = z.infer<typeof ObjectiveCompletedEventSchema>;

export const ObjectiveFailedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ObjectiveFailed'),
  questId: ULIDSchema,
  objectiveId: ULIDSchema,
});
export type ObjectiveFailedEvent = z.infer<typeof ObjectiveFailedEventSchema>;

export const QuestCompletedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('QuestCompleted'),
  questId: ULIDSchema,
});
export type QuestCompletedEvent = z.infer<typeof QuestCompletedEventSchema>;

export const QuestFailedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('QuestFailed'),
  questId: ULIDSchema,
  reason: z.string().optional(),
});
export type QuestFailedEvent = z.infer<typeof QuestFailedEventSchema>;

export const QuestAbandonedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('QuestAbandoned'),
  questId: ULIDSchema,
  reason: z.string().optional(),
});
export type QuestAbandonedEvent = z.infer<typeof QuestAbandonedEventSchema>;

export const QuestRewardClaimedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('QuestRewardClaimed'),
  questId: ULIDSchema,
  beneficiaryCharacterIds: z.array(ULIDSchema).default([]),
});
export type QuestRewardClaimedEvent = z.infer<typeof QuestRewardClaimedEventSchema>;

export const XPAwardedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('XPAwarded'),
  characterId: ULIDSchema,
  amount: z.number().int().min(1),
  source: z.string().optional(),
  questId: ULIDSchema.optional(),
});
export type XPAwardedEvent = z.infer<typeof XPAwardedEventSchema>;

export const MILESTONE_KINDS = ['minor', 'major', 'campaign'] as const;
export const MilestoneKindSchema = z.enum(MILESTONE_KINDS);
export type MilestoneKind = z.infer<typeof MilestoneKindSchema>;

export const MilestoneAwardedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('MilestoneAwarded'),
  kind: MilestoneKindSchema,
  title: z.string().min(1),
  partyId: ULIDSchema.optional(),
  questId: ULIDSchema.optional(),
});
export type MilestoneAwardedEvent = z.infer<typeof MilestoneAwardedEventSchema>;
