import { describe, expect, it } from 'vitest';
import { evaluateFormula } from '../../../src/effects/formula.js';
import { FormulaSchema, type Formula } from '../../../src/schemas/formula.js';
import type { FormulaContext } from '../../../src/effects/formula.js';

const ctx: FormulaContext = {
  abilityScores: { STR: 16, DEX: 14, CON: 12, INT: 10, WIS: 8, CHA: 6 },
  proficiencyBonus: 3,
  classLevels: new Map([['fighter', 5]]),
  classColumns: new Map([['fighter', new Map([['extraAttacks', 1]])]]),
  totalLevel: 5,
};

describe('evaluateFormula', () => {
  it('const', () => {
    expect(evaluateFormula({ kind: 'const', value: 7 }, ctx)).toBe(7);
  });
  it('ability raw', () => {
    expect(evaluateFormula({ kind: 'ability', ability: 'STR' }, ctx)).toBe(16);
  });
  it('abilityMod', () => {
    expect(evaluateFormula({ kind: 'abilityMod', ability: 'STR' }, ctx)).toBe(3);
    expect(evaluateFormula({ kind: 'abilityMod', ability: 'WIS' }, ctx)).toBe(-1);
  });
  it('profBonus', () => {
    expect(evaluateFormula({ kind: 'profBonus' }, ctx)).toBe(3);
  });
  it('level without classId returns total level', () => {
    expect(evaluateFormula({ kind: 'level' }, ctx)).toBe(5);
  });
  it('level with classId returns class level', () => {
    expect(evaluateFormula({ kind: 'level', classId: 'fighter' }, ctx)).toBe(5);
    expect(evaluateFormula({ kind: 'level', classId: 'wizard' }, ctx)).toBe(0);
  });
  it('classCol lookups', () => {
    expect(evaluateFormula({ kind: 'classCol', classId: 'fighter', column: 'extraAttacks' }, ctx)).toBe(1);
    expect(evaluateFormula({ kind: 'classCol', classId: 'fighter', column: 'missing' }, ctx)).toBe(0);
    expect(evaluateFormula({ kind: 'classCol', classId: 'missing', column: 'extraAttacks' }, ctx)).toBe(0);
  });
  it('dice returns average', () => {
    expect(evaluateFormula({ kind: 'dice', expression: '2d6' }, ctx)).toBe(7);
    expect(evaluateFormula({ kind: 'dice', expression: '1d8+3' }, ctx)).toBe(7.5);
  });
  it('add sums all terms', () => {
    expect(
      evaluateFormula(
        {
          kind: 'add',
          terms: [
            { kind: 'const', value: 1 },
            { kind: 'const', value: 2 },
            { kind: 'profBonus' },
          ],
        },
        ctx,
      ),
    ).toBe(6);
  });
  it('add with empty terms is 0', () => {
    expect(evaluateFormula({ kind: 'add', terms: [] }, ctx)).toBe(0);
  });
  it('multiply', () => {
    expect(
      evaluateFormula(
        { kind: 'multiply', terms: [{ kind: 'const', value: 3 }, { kind: 'const', value: 4 }] },
        ctx,
      ),
    ).toBe(12);
  });
  it('max', () => {
    expect(
      evaluateFormula(
        { kind: 'max', terms: [{ kind: 'const', value: 1 }, { kind: 'const', value: 9 }] },
        ctx,
      ),
    ).toBe(9);
  });
  it('min', () => {
    expect(
      evaluateFormula(
        { kind: 'min', terms: [{ kind: 'const', value: 1 }, { kind: 'const', value: 9 }] },
        ctx,
      ),
    ).toBe(1);
  });
  it('floor', () => {
    expect(
      evaluateFormula({ kind: 'floor', term: { kind: 'const', value: 3.7 } }, ctx),
    ).toBe(3);
  });
  it('ceil', () => {
    expect(
      evaluateFormula({ kind: 'ceil', term: { kind: 'const', value: 3.2 } }, ctx),
    ).toBe(4);
  });

  it('nested expressions evaluate left-to-right', () => {
    const formula: Formula = {
      kind: 'add',
      terms: [
        { kind: 'abilityMod', ability: 'STR' },
        { kind: 'profBonus' },
        { kind: 'max', terms: [{ kind: 'const', value: 1 }, { kind: 'const', value: -3 }] },
      ],
    };
    expect(evaluateFormula(formula, ctx)).toBe(3 + 3 + 1);
  });

  it('schema rejects malformed formulas', () => {
    expect(FormulaSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
    expect(FormulaSchema.safeParse({ kind: 'const' }).success).toBe(false);
  });
  it('schema round-trips a valid formula', () => {
    const formula: Formula = {
      kind: 'add',
      terms: [{ kind: 'const', value: 1 }, { kind: 'profBonus' }],
    };
    const parsed = FormulaSchema.parse(formula);
    expect(parsed).toEqual(formula);
  });
});
