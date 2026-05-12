import { z } from 'zod';
import {
  AbilityScoreSchema,
  CHARACTER_LEVEL_MAX,
  CHARACTER_LEVEL_MIN,
  HitDieSchema,
  SkillSchema,
} from '../primitives.js';
import { EffectSchema } from '../effects.js';

export const ClassFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  effects: z.array(EffectSchema).default([]),
});
export type ClassFeature = z.infer<typeof ClassFeatureSchema>;

const LevelEntrySchema = z.object({
  proficiencyBonus: z.number().int().min(2).max(6),
  features: z.array(ClassFeatureSchema).default([]),
  columns: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
});
export type LevelEntry = z.infer<typeof LevelEntrySchema>;

export const SpellcastingProgressionSchema = z.object({
  ability: AbilityScoreSchema,
  type: z.enum(['full', 'half', 'third', 'pact']),
  preparedFormula: z.string().optional(),
});
export type SpellcastingProgression = z.infer<typeof SpellcastingProgressionSchema>;

export const ClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  hitDie: HitDieSchema,
  primaryAbility: z.array(AbilityScoreSchema).min(1),
  savingThrowProficiencies: z.array(AbilityScoreSchema).length(2),
  armorProficiencies: z.array(z.string()).default([]),
  weaponProficiencies: z.array(z.string()).default([]),
  toolProficiencies: z.array(z.string()).default([]),
  skillChoices: z
    .object({
      choices: z.number().int().min(0),
      from: z.array(SkillSchema),
    })
    .optional(),
  levelTable: z
    .record(
      z
        .string()
        .regex(/^([1-9]|1[0-9]|20)$/, 'Level keys must be 1..20'),
      LevelEntrySchema,
    )
    .superRefine((val, ctx) => {
      for (const key of Object.keys(val)) {
        const n = Number.parseInt(key, 10);
        if (n < CHARACTER_LEVEL_MIN || n > CHARACTER_LEVEL_MAX) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Level key ${key} out of range`,
          });
        }
      }
    }),
  subclassLevel: z.number().int().min(1).max(CHARACTER_LEVEL_MAX).optional(),
  spellcasting: SpellcastingProgressionSchema.optional(),
});
export type Class = z.infer<typeof ClassSchema>;

export const SubclassSchema = z.object({
  id: z.string(),
  parentClassId: z.string(),
  name: z.string(),
  levelGrants: z.record(z.string(), z.array(ClassFeatureSchema)).default({}),
});
export type Subclass = z.infer<typeof SubclassSchema>;
