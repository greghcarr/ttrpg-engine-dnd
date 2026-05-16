import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';
import { TrapPayloadSchema } from '../runtime/trap.js';

// A trap is primed at cast time (TrapArmed) and fires later when the
// consumer reports the trigger condition (TrapTriggered). Charges go
// down by one per fire; when they reach zero, TrapExpired removes
// the trap from state. The payload is pre-baked at arm time so the
// trap is self-contained at trigger time.

export const TrapArmedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('TrapArmed'),
  trapId: ULIDSchema,
  label: z.string(),
  sourceCharacterId: ULIDSchema,
  sourceSpellId: z.string(),
  payload: TrapPayloadSchema,
  chargesRemaining: z.number().int().min(1),
});
export type TrapArmedEvent = z.infer<typeof TrapArmedEventSchema>;

export const TrapTriggeredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('TrapTriggered'),
  trapId: ULIDSchema,
  triggeringCharacterId: ULIDSchema,
});
export type TrapTriggeredEvent = z.infer<typeof TrapTriggeredEventSchema>;

export const TRAP_EXPIRY_REASONS = ['chargesExhausted', 'dispelled', 'duration'] as const;
export const TrapExpiryReasonSchema = z.enum(TRAP_EXPIRY_REASONS);
export type TrapExpiryReason = z.infer<typeof TrapExpiryReasonSchema>;

export const TrapExpiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('TrapExpired'),
  trapId: ULIDSchema,
  reason: TrapExpiryReasonSchema,
});
export type TrapExpiredEvent = z.infer<typeof TrapExpiredEventSchema>;
