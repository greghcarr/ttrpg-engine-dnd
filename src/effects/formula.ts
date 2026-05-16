import type { AbilityScore } from '../schemas/primitives.js';
import { parseDiceExpression } from '../rng/dice.js';
import type { Formula } from '../schemas/formula.js';

export interface FormulaContext {
  readonly abilityScores: Readonly<Record<AbilityScore, number>>;
  readonly proficiencyBonus: number;
  readonly classLevels: ReadonlyMap<string, number>;
  readonly classColumns?: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly totalLevel: number;
  // Stats of the *source* character of the effect this formula is
  // attached to. Populated by the effect-stack builder when an
  // AppliedCondition carries a `sourceCharacterId` link (auras,
  // Bless-from-X, etc.). The `sourceAbilityMod` formula kind reads
  // from this; absence evaluates to 0.
  readonly source?: {
    readonly abilityScores: Readonly<Record<AbilityScore, number>>;
  };
}

export const abilityModifier = (score: number): number => Math.floor((score - 10) / 2);

const averageOfDiceExpression = (expression: string): number => {
  const parsed = parseDiceExpression(expression);
  const perDieAverage = (parsed.die + 1) / 2;
  return parsed.count * perDieAverage + parsed.modifier;
};

export const evaluateFormula = (formula: Formula, ctx: FormulaContext): number => {
  switch (formula.kind) {
    case 'const':
      return formula.value;
    case 'ability':
      return ctx.abilityScores[formula.ability];
    case 'abilityMod':
      return abilityModifier(ctx.abilityScores[formula.ability]);
    case 'sourceAbilityMod':
      if (ctx.source === undefined) return 0;
      return abilityModifier(ctx.source.abilityScores[formula.ability]);
    case 'profBonus':
      return ctx.proficiencyBonus;
    case 'level': {
      if (formula.classId === undefined) return ctx.totalLevel;
      return ctx.classLevels.get(formula.classId) ?? 0;
    }
    case 'classCol': {
      const col = ctx.classColumns?.get(formula.classId)?.get(formula.column);
      return col ?? 0;
    }
    case 'dice':
      return averageOfDiceExpression(formula.expression);
    case 'add':
      return formula.terms.reduce((acc, term) => acc + evaluateFormula(term, ctx), 0);
    case 'multiply':
      return formula.terms.reduce((acc, term) => acc * evaluateFormula(term, ctx), 1);
    case 'max': {
      const values = formula.terms.map((t) => evaluateFormula(t, ctx));
      return Math.max(...values);
    }
    case 'min': {
      const values = formula.terms.map((t) => evaluateFormula(t, ctx));
      return Math.min(...values);
    }
    case 'floor':
      return Math.floor(evaluateFormula(formula.term, ctx));
    case 'ceil':
      return Math.ceil(evaluateFormula(formula.term, ctx));
  }
};
