import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';

export const DOWNTIME_KINDS = [
  'crafting',
  'training',
  'recuperating',
  'research',
  'work',
  'other',
] as const;
export const DowntimeKindSchema = z.enum(DOWNTIME_KINDS);
export type DowntimeKind = z.infer<typeof DowntimeKindSchema>;

export const DOWNTIME_OUTCOMES = ['success', 'partial', 'failure'] as const;
export const DowntimeOutcomeSchema = z.enum(DOWNTIME_OUTCOMES);
export type DowntimeOutcome = z.infer<typeof DowntimeOutcomeSchema>;

export const DowntimeActivityResolvedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('DowntimeActivityResolved'),
  characterId: ULIDSchema,
  kind: DowntimeKindSchema,
  days: z.number().int().min(1),
  outcome: DowntimeOutcomeSchema,
  summary: z.string().min(1),
  producedItemDefinitionId: z.string().optional(),
  toolProficiencyGained: z.string().optional(),
});
export type DowntimeActivityResolvedEvent = z.infer<typeof DowntimeActivityResolvedEventSchema>;
