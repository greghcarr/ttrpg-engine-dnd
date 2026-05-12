import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';

export const ATTITUDES = ['hostile', 'unfriendly', 'indifferent', 'friendly', 'helpful'] as const;
export const AttitudeSchema = z.enum(ATTITUDES);
export type Attitude = z.infer<typeof AttitudeSchema>;

export const AttitudeChangedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('AttitudeChanged'),
  characterId: ULIDSchema,
  fromAttitude: AttitudeSchema.optional(),
  toAttitude: AttitudeSchema,
  cause: z.string().optional(),
});
export type AttitudeChangedEvent = z.infer<typeof AttitudeChangedEventSchema>;

export const MoraleCheckRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('MoraleCheckRolled'),
  characterId: ULIDSchema,
  d20: z.number().int().min(1).max(20),
  bonus: z.number().int(),
  total: z.number().int(),
  dc: z.number().int(),
  success: z.boolean(),
});
export type MoraleCheckRolledEvent = z.infer<typeof MoraleCheckRolledEventSchema>;

export const MoraleBrokenEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('MoraleBroken'),
  characterId: ULIDSchema,
  action: z.enum(['flee', 'surrender']),
});
export type MoraleBrokenEvent = z.infer<typeof MoraleBrokenEventSchema>;
