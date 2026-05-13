import { z } from 'zod';
import {
  AbilityScoresSchema,
  CharacterLevelSchema,
  ExhaustionLevelSchema,
  ULIDSchema,
} from '../primitives.js';

export const ResourceStateSchema = z.object({
  resourceId: z.string(),
  current: z.number().int().min(0),
  max: z.number().int().min(0),
});
export type ResourceState = z.infer<typeof ResourceStateSchema>;

export const AppliedConditionSchema = z.object({
  id: ULIDSchema,
  conditionId: z.string(),
  sourceEventId: ULIDSchema.optional(),
  level: z.number().int().min(1).optional(),
  expiresOnRound: z.number().int().optional(),
});
export type AppliedCondition = z.infer<typeof AppliedConditionSchema>;

export const HPSchema = z.object({
  current: z.number().int(),
  max: z.number().int().min(1),
  temp: z.number().int().min(0).default(0),
});
export type HP = z.infer<typeof HPSchema>;

export const DeathSavesSchema = z.object({
  successes: z.number().int().min(0).max(3).default(0),
  failures: z.number().int().min(0).max(3).default(0),
  stable: z.boolean().default(false),
});
export type DeathSaves = z.infer<typeof DeathSavesSchema>;

export const ClassEnrollmentSchema = z.object({
  classId: z.string(),
  subclassId: z.string().optional(),
  level: CharacterLevelSchema,
  hitDiceRemaining: z.number().int().min(0),
});
export type ClassEnrollment = z.infer<typeof ClassEnrollmentSchema>;

export const CHARACTER_KINDS = ['pc', 'npc', 'creature'] as const;
export const CharacterKindSchema = z.enum(CHARACTER_KINDS);
export type CharacterKind = z.infer<typeof CharacterKindSchema>;

export const MultiattackPatternSchema = z.object({
  name: z.string(),
  attacks: z.array(
    z.object({
      weaponInstanceId: ULIDSchema,
      count: z.number().int().min(1),
    }),
  ).min(1),
});
export type MultiattackPattern = z.infer<typeof MultiattackPatternSchema>;

export const CharacterSchema = z.object({
  id: ULIDSchema,
  kind: CharacterKindSchema.default('pc'),
  statblockId: z.string().optional(),
  multiattack: MultiattackPatternSchema.optional(),
  name: z.string().min(1),
  playerId: z.string().optional(),
  speciesId: z.string(),
  backgroundId: z.string(),
  classes: z.array(ClassEnrollmentSchema).min(1),
  abilityScores: AbilityScoresSchema,
  hp: HPSchema,
  deathSaves: DeathSavesSchema.default({ successes: 0, failures: 0, stable: false }),
  exhaustion: ExhaustionLevelSchema.default(0),
  speedFeet: z.number().int().min(0).default(30),
  // Optional natural-armor AC. When set, computeAC uses this in place of
  // the armor + DEX computation. Intended for creatures whose AC comes
  // from a statblock (hide, scales, plate-skin) rather than worn armor.
  // PCs leave it undefined.
  armorClass: z.number().int().min(0).optional(),
  inventory: z.array(ULIDSchema).default([]),
  equipped: z
    .object({
      mainHand: ULIDSchema.optional(),
      offHand: ULIDSchema.optional(),
      armor: ULIDSchema.optional(),
      shield: ULIDSchema.optional(),
      attuned: z.array(ULIDSchema).max(3).default([]),
    })
    .default({ attuned: [] }),
  resources: z.array(ResourceStateSchema).default([]),
  appliedConditions: z.array(AppliedConditionSchema).default([]),
  knownSpells: z.array(z.string()).default([]),
  preparedSpells: z.array(z.string()).default([]),
  spellSlotsUsed: z
    .record(
      z.string().regex(/^[1-9]$/, 'Slot level keys must be 1..9'),
      z.number().int().min(0),
    )
    .default({}),
  pactSlotsUsed: z.number().int().min(0).default(0),
  concentrationEffectId: ULIDSchema.optional(),
  triggerCounters: z
    .record(
      z.string(),
      z.object({
        firedThisTurn: z.boolean().optional(),
        firedThisRound: z.boolean().optional(),
        firedThisShortRest: z.boolean().optional(),
        firedThisLongRest: z.boolean().optional(),
      }),
    )
    .default({}),
  featsTaken: z.array(z.string()).default([]),
  pendingChoiceIds: z.array(ULIDSchema).default([]),
  xp: z.number().int().min(0).default(0),
  mountedOnId: ULIDSchema.optional(),
  attitude: z.enum(['hostile', 'unfriendly', 'indifferent', 'friendly', 'helpful']).optional(),
  morale: z
    .object({
      current: z.number().int(),
      max: z.number().int().min(1),
    })
    .optional(),
  moraleBroken: z.boolean().default(false),
  polymorphedSnapshot: z
    .object({
      hp: z.object({
        current: z.number().int(),
        max: z.number().int().min(1),
        temp: z.number().int().min(0).default(0),
      }),
      abilityScores: AbilityScoresSchema,
      speedFeet: z.number().int().min(0),
      speciesId: z.string(),
      kind: z.enum(['polymorph', 'wild-shape', 'true-polymorph']),
      formName: z.string(),
      armorClass: z.number().int().min(0).optional(),
    })
    .optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const computeTotalLevel = (character: Character): number =>
  character.classes.reduce((acc, enrollment) => acc + enrollment.level, 0);
