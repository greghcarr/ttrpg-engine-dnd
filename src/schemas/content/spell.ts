import { z } from 'zod';
import {
  AbilityScoreSchema,
  DamageTypeSchema,
  DiceExpressionSchema,
  SpellLevelSchema,
  SpellSchoolSchema,
} from '../primitives.js';

const SpellAttackMechanicSchema = z.object({
  kind: z.literal('attack'),
  damageDice: DiceExpressionSchema,
  damageType: DamageTypeSchema,
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
});

const SpellSaveMechanicSchema = z.object({
  kind: z.literal('save'),
  ability: AbilityScoreSchema,
  damageDice: DiceExpressionSchema.optional(),
  damageType: DamageTypeSchema.optional(),
  halfOnSuccess: z.boolean().optional(),
  conditionOnFail: z.string().optional(),
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
});

const SpellHealMechanicSchema = z.object({
  kind: z.literal('heal'),
  amountDice: DiceExpressionSchema,
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
});

export const SpellMechanicSchema = z.discriminatedUnion('kind', [
  SpellAttackMechanicSchema,
  SpellSaveMechanicSchema,
  SpellHealMechanicSchema,
]);
export type SpellMechanic = z.infer<typeof SpellMechanicSchema>;

export const SpellSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: SpellLevelSchema,
  school: SpellSchoolSchema,
  castingTime: z.string(),
  range: z.string(),
  components: z.object({
    verbal: z.boolean().default(false),
    somatic: z.boolean().default(false),
    material: z.string().optional(),
  }),
  duration: z.string(),
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  classes: z.array(z.string()).default([]),
  description: z.string().optional(),
  mechanicalEffects: z.array(SpellMechanicSchema).default([]),
});
export type Spell = z.infer<typeof SpellSchema>;
