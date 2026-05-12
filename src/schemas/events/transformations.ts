import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema, AbilityScoresSchema } from '../primitives.js';

export const POLYMORPH_KINDS = ['polymorph', 'wild-shape', 'true-polymorph'] as const;
export const PolymorphKindSchema = z.enum(POLYMORPH_KINDS);
export type PolymorphKind = z.infer<typeof PolymorphKindSchema>;

export const PolymorphFormSchema = z.object({
  name: z.string().min(1),
  hp: z.number().int().min(1),
  ac: z.number().int().min(0),
  abilityScores: AbilityScoresSchema,
  speedFeet: z.number().int().min(0),
  speciesId: z.string().optional(),
});
export type PolymorphForm = z.infer<typeof PolymorphFormSchema>;

export const PolymorphAppliedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('PolymorphApplied'),
  targetId: ULIDSchema,
  casterId: ULIDSchema.optional(),
  kind: PolymorphKindSchema,
  form: PolymorphFormSchema,
});
export type PolymorphAppliedEvent = z.infer<typeof PolymorphAppliedEventSchema>;

export const PolymorphRevertedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('PolymorphReverted'),
  targetId: ULIDSchema,
  reason: z.enum(['voluntary', 'forced-zero-hp', 'duration-expired']).default('voluntary'),
});
export type PolymorphRevertedEvent = z.infer<typeof PolymorphRevertedEventSchema>;

export const SimulacrumCreatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SimulacrumCreated'),
  simulacrumId: ULIDSchema,
  originalId: ULIDSchema,
  hpMax: z.number().int().min(1),
});
export type SimulacrumCreatedEvent = z.infer<typeof SimulacrumCreatedEventSchema>;

export const WishGrantedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('WishGranted'),
  granterId: ULIDSchema,
  description: z.string().min(1),
  stressApplied: z.boolean().default(false),
});
export type WishGrantedEvent = z.infer<typeof WishGrantedEventSchema>;
