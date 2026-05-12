import { z } from 'zod';
import {
  AbilityScoreSchema,
  DamageTypeSchema,
  DiceExpressionSchema,
  SpellLevelSchema,
  SpellSchoolSchema,
} from '../primitives.js';

const CANTRIP_SCALING_THRESHOLDS = [5, 11, 17] as const;

const SpellAttackMechanicSchema = z.object({
  kind: z.literal('attack'),
  damageDice: DiceExpressionSchema,
  damageType: DamageTypeSchema,
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
  cantripScalingDice: DiceExpressionSchema.optional(),
});

const SpellSaveMechanicSchema = z.object({
  kind: z.literal('save'),
  ability: AbilityScoreSchema,
  damageDice: DiceExpressionSchema.optional(),
  damageType: DamageTypeSchema.optional(),
  halfOnSuccess: z.boolean().optional(),
  conditionOnFail: z.string().optional(),
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
  cantripScalingDice: DiceExpressionSchema.optional(),
});

const SpellHealMechanicSchema = z.object({
  kind: z.literal('heal'),
  amountDice: DiceExpressionSchema,
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
});

export const SPELL_AREA_SHAPES = ['cone', 'cube', 'line', 'sphere', 'cylinder'] as const;
export const SpellAreaShapeSchema = z.enum(SPELL_AREA_SHAPES);
export type SpellAreaShape = z.infer<typeof SpellAreaShapeSchema>;

export const SpellTargetingSchema = z.object({
  shape: SpellAreaShapeSchema,
  size: z.number().int().min(1),
});
export type SpellTargeting = z.infer<typeof SpellTargetingSchema>;

export const cantripExtraDice = (characterLevel: number): number => {
  let extra = 0;
  for (const threshold of CANTRIP_SCALING_THRESHOLDS) {
    if (characterLevel >= threshold) extra += 1;
  }
  return extra;
};

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
  targeting: SpellTargetingSchema.optional(),
});
export type Spell = z.infer<typeof SpellSchema>;
