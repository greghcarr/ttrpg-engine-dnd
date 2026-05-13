import { z } from 'zod';
import { ULIDSchema, DamageTypeSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const DAMAGE_MITIGATION_KINDS = ['resisted', 'immune', 'vulnerable'] as const;
export const DamageMitigationKindSchema = z.enum(DAMAGE_MITIGATION_KINDS);
export type DamageMitigationKind = z.infer<typeof DamageMitigationKindSchema>;

export const DamageComponentSchema = z.object({
  amount: z.number().int().min(0),
  type: DamageTypeSchema,
  rawAmount: z.number().int().min(0).optional(),
  mitigation: DamageMitigationKindSchema.optional(),
});
export type DamageComponent = z.infer<typeof DamageComponentSchema>;

export const DamageAppliedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('DamageApplied'),
  targetId: ULIDSchema,
  components: z.array(DamageComponentSchema).min(1),
  sourceCharacterId: ULIDSchema.optional(),
  source: z.string().optional(),
});
export type DamageAppliedEvent = z.infer<typeof DamageAppliedEventSchema>;

export const HealedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('Healed'),
  targetId: ULIDSchema,
  amount: z.number().int().min(0),
  source: z.string().optional(),
});
export type HealedEvent = z.infer<typeof HealedEventSchema>;

export const TempHPGrantedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('TempHPGranted'),
  targetId: ULIDSchema,
  amount: z.number().int().min(0),
  source: z.string().optional(),
});
export type TempHPGrantedEvent = z.infer<typeof TempHPGrantedEventSchema>;

export const ConditionAppliedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ConditionApplied'),
  targetId: ULIDSchema,
  conditionId: z.string(),
  level: z.number().int().min(1).optional(),
  expiresOnRound: z.number().int().optional(),
  appliedConditionId: ULIDSchema.optional(),
});
export type ConditionAppliedEvent = z.infer<typeof ConditionAppliedEventSchema>;

export const ConditionRemovedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ConditionRemoved'),
  targetId: ULIDSchema,
  conditionId: z.string(),
});
export type ConditionRemovedEvent = z.infer<typeof ConditionRemovedEventSchema>;

export const ExhaustionChangedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ExhaustionChanged'),
  targetId: ULIDSchema,
  fromLevel: z.number().int().min(0).max(6),
  toLevel: z.number().int().min(0).max(6),
});
export type ExhaustionChangedEvent = z.infer<typeof ExhaustionChangedEventSchema>;

export const DeathSaveRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('DeathSaveRolled'),
  targetId: ULIDSchema,
  d20: z.number().int().min(1).max(20),
  success: z.boolean(),
  critical: z.boolean().default(false),
});
export type DeathSaveRolledEvent = z.infer<typeof DeathSaveRolledEventSchema>;

export const StabilizedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('Stabilized'),
  targetId: ULIDSchema,
});
export type StabilizedEvent = z.infer<typeof StabilizedEventSchema>;
