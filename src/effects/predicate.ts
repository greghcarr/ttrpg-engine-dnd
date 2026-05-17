import type { Predicate } from '../schemas/predicate.js';
import type { ConditionId } from '../ids.js';
import type { WeaponProperty, DamageType } from '../schemas/primitives.js';

export interface PredicateContext {
  readonly self?: boolean;
  readonly weaponProperties?: ReadonlySet<WeaponProperty>;
  readonly activeConditions?: ReadonlySet<ConditionId>;
  readonly damageType?: DamageType;
  readonly facts?: ReadonlyMap<string, unknown>;
}

const getPath = (facts: ReadonlyMap<string, unknown> | undefined, path: string): unknown =>
  facts?.get(path);

export const evaluatePredicate = (predicate: Predicate, ctx: PredicateContext): boolean => {
  switch (predicate.kind) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'self':
      return ctx.self === true;
    case 'eq':
      return getPath(ctx.facts, predicate.path) === predicate.value;
    case 'gt': {
      const v = getPath(ctx.facts, predicate.path);
      return typeof v === 'number' && v > predicate.value;
    }
    case 'gte': {
      const v = getPath(ctx.facts, predicate.path);
      return typeof v === 'number' && v >= predicate.value;
    }
    case 'hasProperty':
      return ctx.weaponProperties?.has(predicate.property) === true;
    case 'hasCondition':
      return ctx.activeConditions?.has(predicate.conditionId as ConditionId) === true;
    case 'damageType':
      return ctx.damageType === predicate.type;
    case 'not':
      return !evaluatePredicate(predicate.term, ctx);
    case 'all':
      return predicate.terms.every((t) => evaluatePredicate(t, ctx));
    case 'any':
      return predicate.terms.some((t) => evaluatePredicate(t, ctx));
  }
};
