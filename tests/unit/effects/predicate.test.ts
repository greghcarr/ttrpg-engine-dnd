import { describe, expect, it } from 'vitest';
import { evaluatePredicate } from '../../../src/effects/predicate.js';
import { PredicateSchema } from '../../../src/schemas/predicate.js';
import type { ConditionId } from '../../../src/ids.js';

describe('evaluatePredicate', () => {
  it('always returns true', () => {
    expect(evaluatePredicate({ kind: 'always' }, {})).toBe(true);
  });
  it('never returns false', () => {
    expect(evaluatePredicate({ kind: 'never' }, {})).toBe(false);
  });
  it('self', () => {
    expect(evaluatePredicate({ kind: 'self' }, { self: true })).toBe(true);
    expect(evaluatePredicate({ kind: 'self' }, { self: false })).toBe(false);
    expect(evaluatePredicate({ kind: 'self' }, {})).toBe(false);
  });
  it('eq matches fact path', () => {
    const facts = new Map<string, unknown>([['weather', 'sunny']]);
    expect(evaluatePredicate({ kind: 'eq', path: 'weather', value: 'sunny' }, { facts })).toBe(true);
    expect(evaluatePredicate({ kind: 'eq', path: 'weather', value: 'rainy' }, { facts })).toBe(false);
    expect(evaluatePredicate({ kind: 'eq', path: 'missing', value: null }, { facts })).toBe(false);
    expect(evaluatePredicate({ kind: 'eq', path: 'weather', value: 'sunny' }, {})).toBe(false);
  });
  it('hasProperty', () => {
    expect(
      evaluatePredicate(
        { kind: 'hasProperty', property: 'finesse' },
        { weaponProperties: new Set(['finesse', 'light']) },
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: 'hasProperty', property: 'heavy' },
        { weaponProperties: new Set(['finesse']) },
      ),
    ).toBe(false);
    expect(evaluatePredicate({ kind: 'hasProperty', property: 'finesse' }, {})).toBe(false);
  });
  it('hasCondition', () => {
    const conditions = new Set<ConditionId>(['prone' as ConditionId]);
    expect(
      evaluatePredicate(
        { kind: 'hasCondition', conditionId: 'prone' },
        { activeConditions: conditions },
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: 'hasCondition', conditionId: 'blinded' },
        { activeConditions: conditions },
      ),
    ).toBe(false);
    expect(evaluatePredicate({ kind: 'hasCondition', conditionId: 'prone' }, {})).toBe(false);
  });
  it('damageType', () => {
    expect(evaluatePredicate({ kind: 'damageType', type: 'fire' }, { damageType: 'fire' })).toBe(true);
    expect(evaluatePredicate({ kind: 'damageType', type: 'fire' }, { damageType: 'cold' })).toBe(false);
    expect(evaluatePredicate({ kind: 'damageType', type: 'fire' }, {})).toBe(false);
  });
  it('not inverts', () => {
    expect(evaluatePredicate({ kind: 'not', term: { kind: 'always' } }, {})).toBe(false);
    expect(evaluatePredicate({ kind: 'not', term: { kind: 'never' } }, {})).toBe(true);
  });
  it('all (AND)', () => {
    expect(
      evaluatePredicate(
        { kind: 'all', terms: [{ kind: 'always' }, { kind: 'always' }] },
        {},
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: 'all', terms: [{ kind: 'always' }, { kind: 'never' }] },
        {},
      ),
    ).toBe(false);
    expect(evaluatePredicate({ kind: 'all', terms: [] }, {})).toBe(true);
  });
  it('any (OR)', () => {
    expect(
      evaluatePredicate(
        { kind: 'any', terms: [{ kind: 'never' }, { kind: 'always' }] },
        {},
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: 'any', terms: [{ kind: 'never' }, { kind: 'never' }] },
        {},
      ),
    ).toBe(false);
    expect(evaluatePredicate({ kind: 'any', terms: [] }, {})).toBe(false);
  });
  it('schema rejects malformed predicates', () => {
    expect(PredicateSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
  });
});
