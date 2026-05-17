import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';
import { IllusionKindSchema } from '../runtime/illusion.js';

// Slice 137: lifecycle events for illusion entities (Silent Image,
// Major Image, future illusion spells). The illusion is created at
// cast time (IllusionCreated), creatures study it to disbelieve
// (IllusionInvestigated), and the illusion is removed on
// concentration drop or voluntary dismissal (IllusionDismissed).

export const IllusionCreatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('IllusionCreated'),
  illusionId: ULIDSchema,
  label: z.string(),
  location: z.string(),
  kind: IllusionKindSchema,
  casterId: ULIDSchema,
  sourceSpellId: z.string(),
  sourceEffectInstanceId: ULIDSchema.optional(),
  investigationDC: z.number().int().min(1),
});
export type IllusionCreatedEvent = z.infer<typeof IllusionCreatedEventSchema>;

// An investigator used the Study action on an illusion. The event
// carries the d20 + bonus + DC for the rolled check; consumers can
// read the outcome via `success`. When `success` is true the
// reducer adds the investigator to the illusion's `disbelievedBy`
// list.
export const IllusionInvestigatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('IllusionInvestigated'),
  illusionId: ULIDSchema,
  investigatorId: ULIDSchema,
  d20: z.array(z.number().int().min(1).max(20)).min(1).max(2),
  used: z.enum(['none', 'advantage', 'disadvantage']),
  bonus: z.number().int(),
  dc: z.number().int().min(1),
  total: z.number().int(),
  success: z.boolean(),
});
export type IllusionInvestigatedEvent = z.infer<typeof IllusionInvestigatedEventSchema>;

export const ILLUSION_DISMISSAL_REASONS = [
  'concentrationDropped',
  'spellEnded',
  'casterAction',
  'dispelled',
] as const;
export const IllusionDismissalReasonSchema = z.enum(ILLUSION_DISMISSAL_REASONS);
export type IllusionDismissalReason = z.infer<typeof IllusionDismissalReasonSchema>;

export const IllusionDismissedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('IllusionDismissed'),
  illusionId: ULIDSchema,
  reason: IllusionDismissalReasonSchema,
});
export type IllusionDismissedEvent = z.infer<typeof IllusionDismissedEventSchema>;
