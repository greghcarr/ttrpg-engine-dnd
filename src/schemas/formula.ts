import { z } from 'zod';
import { AbilityScoreSchema, DiceExpressionSchema } from './primitives.js';

const ConstNodeSchema = z.object({
  kind: z.literal('const'),
  value: z.number(),
});

const AbilityNodeSchema = z.object({
  kind: z.literal('ability'),
  ability: AbilityScoreSchema,
});

const AbilityModNodeSchema = z.object({
  kind: z.literal('abilityMod'),
  ability: AbilityScoreSchema,
});

// Resolves to the ability modifier of the *source* character of the
// effect this formula is attached to (e.g., an aura condition's
// AddModifier reading the aura source's CHA mod). The link is via
// AppliedCondition.sourceCharacterId at the runtime layer; this
// formula kind evaluates to 0 if no source character is in scope.
const SourceAbilityModNodeSchema = z.object({
  kind: z.literal('sourceAbilityMod'),
  ability: AbilityScoreSchema,
});

const ProfBonusNodeSchema = z.object({
  kind: z.literal('profBonus'),
});

const LevelNodeSchema = z.object({
  kind: z.literal('level'),
  classId: z.string().optional(),
});

const ClassColumnNodeSchema = z.object({
  kind: z.literal('classCol'),
  classId: z.string(),
  column: z.string(),
});

const DiceNodeSchema = z.object({
  kind: z.literal('dice'),
  expression: DiceExpressionSchema,
  average: z.boolean().optional(),
});

interface AddNode {
  kind: 'add';
  terms: Formula[];
}

interface MaxNode {
  kind: 'max';
  terms: Formula[];
}

interface MinNode {
  kind: 'min';
  terms: Formula[];
}

interface MultiplyNode {
  kind: 'multiply';
  terms: Formula[];
}

interface FloorNode {
  kind: 'floor';
  term: Formula;
}

interface CeilNode {
  kind: 'ceil';
  term: Formula;
}

export type Formula =
  | z.infer<typeof ConstNodeSchema>
  | z.infer<typeof AbilityNodeSchema>
  | z.infer<typeof AbilityModNodeSchema>
  | z.infer<typeof SourceAbilityModNodeSchema>
  | z.infer<typeof ProfBonusNodeSchema>
  | z.infer<typeof LevelNodeSchema>
  | z.infer<typeof ClassColumnNodeSchema>
  | z.infer<typeof DiceNodeSchema>
  | AddNode
  | MaxNode
  | MinNode
  | MultiplyNode
  | FloorNode
  | CeilNode;

export const FormulaSchema: z.ZodType<Formula> = z.lazy(() =>
  z.union([
    ConstNodeSchema,
    AbilityNodeSchema,
    AbilityModNodeSchema,
    SourceAbilityModNodeSchema,
    ProfBonusNodeSchema,
    LevelNodeSchema,
    ClassColumnNodeSchema,
    DiceNodeSchema,
    z.object({
      kind: z.literal('add'),
      terms: z.array(FormulaSchema),
    }),
    z.object({
      kind: z.literal('max'),
      terms: z.array(FormulaSchema).min(1),
    }),
    z.object({
      kind: z.literal('min'),
      terms: z.array(FormulaSchema).min(1),
    }),
    z.object({
      kind: z.literal('multiply'),
      terms: z.array(FormulaSchema),
    }),
    z.object({
      kind: z.literal('floor'),
      term: FormulaSchema,
    }),
    z.object({
      kind: z.literal('ceil'),
      term: FormulaSchema,
    }),
  ]),
);

export const isFormula = (value: unknown): value is Formula =>
  FormulaSchema.safeParse(value).success;
