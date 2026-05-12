import { z } from 'zod';
import {
  AbilityScoresSchema,
  AlignmentSchema,
  CreatureTypeSchema,
  DamageTypeSchema,
  SensesSchema,
  SizeSchema,
  SkillSchema,
  SpeedSchema,
} from '../primitives.js';
import { EffectSchema } from '../effects.js';

export const MonsterStatblockSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: SizeSchema,
  type: CreatureTypeSchema,
  subtype: z.string().optional(),
  alignment: AlignmentSchema.default('unaligned'),
  ac: z.number().int().min(0),
  hp: z.object({
    average: z.number().int().min(1),
    formula: z.string(),
  }),
  speed: SpeedSchema,
  abilityScores: AbilityScoresSchema,
  savingThrows: z.record(z.string(), z.number().int()).optional(),
  skills: z.record(SkillSchema, z.number().int()).optional(),
  damageResistances: z.array(DamageTypeSchema).default([]),
  damageImmunities: z.array(DamageTypeSchema).default([]),
  damageVulnerabilities: z.array(DamageTypeSchema).default([]),
  conditionImmunities: z.array(z.string()).default([]),
  senses: SensesSchema.optional(),
  languages: z.array(z.string()).default([]),
  cr: z.number().min(0),
  xp: z.number().int().min(0),
  proficiencyBonus: z.number().int().min(2).max(9),
  traits: z.array(EffectSchema).default([]),
});
export type MonsterStatblock = z.infer<typeof MonsterStatblockSchema>;
