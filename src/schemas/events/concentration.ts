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
  // Wall-clock duration in in-game minutes (parsed from the spell's
  // duration string at plan time). The reducer pairs this with the
  // current state.inGameTime to populate EffectInstance.durationMinutes
  // and startedAtMinutes, used by planExpireSpellDurations.
  durationMinutes: z.number().int().min(0).optional(),
  // The slot level the spell was cast at, copied onto the EffectInstance
  // so later planners (planTickAura for Spirit Guardians, etc.) can
  // scale per-cast effects without the consumer holding onto the cast
  // intent.
  slotLevel: z.number().int().min(0).optional(),
});
export type ConcentrationStartedEvent = z.infer<typeof ConcentrationStartedEventSchema>;

export const ConcentrationBrokenReasonSchema = z.enum([
  'failedSave',
  'newConcentrationSpell',
  'voluntary',
  'incapacitated',
  'unconscious',
  'dead',
  'durationEnded',
  'used',
]);
export type ConcentrationBrokenReason = z.infer<typeof ConcentrationBrokenReasonSchema>;

export const ConcentrationBrokenEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ConcentrationBroken'),
  effectInstanceId: ULIDSchema,
  casterId: ULIDSchema,
  reason: ConcentrationBrokenReasonSchema,
});
export type ConcentrationBrokenEvent = z.infer<typeof ConcentrationBrokenEventSchema>;
