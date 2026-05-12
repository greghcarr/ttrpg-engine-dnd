import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';
import { AppliedConditionRefSchema } from '../runtime/effect-instance.js';

export const ConcentrationStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ConcentrationStarted'),
  effectInstanceId: ULIDSchema,
  casterId: ULIDSchema,
  spellId: z.string(),
  targetIds: z.array(ULIDSchema).default([]),
  conditionsApplied: z.array(AppliedConditionRefSchema).default([]),
  durationRounds: z.number().int().min(0).optional(),
});
export type ConcentrationStartedEvent = z.infer<typeof ConcentrationStartedEventSchema>;

export const ConcentrationBrokenReasonSchema = z.enum([
  'failedSave',
  'newConcentrationSpell',
  'voluntary',
  'incapacitated',
  'dead',
  'durationEnded',
]);
export type ConcentrationBrokenReason = z.infer<typeof ConcentrationBrokenReasonSchema>;

export const ConcentrationBrokenEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ConcentrationBroken'),
  effectInstanceId: ULIDSchema,
  casterId: ULIDSchema,
  reason: ConcentrationBrokenReasonSchema,
});
export type ConcentrationBrokenEvent = z.infer<typeof ConcentrationBrokenEventSchema>;
