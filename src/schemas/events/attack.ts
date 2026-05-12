import { z } from 'zod';
import { ULIDSchema, DamageTypeSchema, DiceExpressionSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const AttackAdvantageSchema = z.enum(['none', 'advantage', 'disadvantage']);
export type AttackAdvantage = z.infer<typeof AttackAdvantageSchema>;

export const AttackRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('AttackRolled'),
  attackerId: ULIDSchema,
  targetId: ULIDSchema,
  weaponInstanceId: ULIDSchema,
  d20: z.array(z.number().int().min(1).max(20)).min(1).max(2),
  used: AttackAdvantageSchema,
  attackBonus: z.number().int(),
  total: z.number().int(),
  targetAC: z.number().int(),
  hit: z.boolean(),
  critical: z.boolean(),
});
export type AttackRolledEvent = z.infer<typeof AttackRolledEventSchema>;

export const DamageRollSchema = z.object({
  expression: DiceExpressionSchema,
  rolls: z.array(z.number().int().min(1)),
  modifier: z.number().int(),
  type: DamageTypeSchema,
});
export type DamageRoll = z.infer<typeof DamageRollSchema>;

export const DamageRolledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('DamageRolled'),
  attackerId: ULIDSchema,
  targetId: ULIDSchema,
  weaponInstanceId: ULIDSchema,
  rolls: z.array(DamageRollSchema).min(1),
  critical: z.boolean(),
});
export type DamageRolledEvent = z.infer<typeof DamageRolledEventSchema>;
