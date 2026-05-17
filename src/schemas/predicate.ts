import { z } from 'zod';
import { DamageTypeSchema, WeaponPropertySchema } from './primitives.js';

const EqNodeSchema = z.object({
  kind: z.literal('eq'),
  path: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

// Slice 122: numeric-comparison predicates. The fact at `path` must
// resolve to a number; if it's missing or non-numeric, the predicate
// returns false. `gt` is strict greater-than; `gte` is at-least.
// Canonical user: Armor of Agathys's "while temp HP > 0" retaliation
// gate, using `bearer.tempHp` (populated in the trigger dispatcher).
const GtNodeSchema = z.object({
  kind: z.literal('gt'),
  path: z.string(),
  value: z.number(),
});

const GteNodeSchema = z.object({
  kind: z.literal('gte'),
  path: z.string(),
  value: z.number(),
});

const SelfNodeSchema = z.object({
  kind: z.literal('self'),
});

const HasPropertyNodeSchema = z.object({
  kind: z.literal('hasProperty'),
  property: WeaponPropertySchema,
});

const HasConditionNodeSchema = z.object({
  kind: z.literal('hasCondition'),
  conditionId: z.string(),
});

const DamageTypeNodeSchema = z.object({
  kind: z.literal('damageType'),
  type: DamageTypeSchema,
});

const NotNodeSchema = z.lazy(() =>
  z.object({
    kind: z.literal('not'),
    term: PredicateSchema,
  }),
);

interface AllNode {
  kind: 'all';
  terms: Predicate[];
}
interface AnyNode {
  kind: 'any';
  terms: Predicate[];
}
interface NotNode {
  kind: 'not';
  term: Predicate;
}

export type Predicate =
  | z.infer<typeof EqNodeSchema>
  | z.infer<typeof GtNodeSchema>
  | z.infer<typeof GteNodeSchema>
  | z.infer<typeof SelfNodeSchema>
  | z.infer<typeof HasPropertyNodeSchema>
  | z.infer<typeof HasConditionNodeSchema>
  | z.infer<typeof DamageTypeNodeSchema>
  | AllNode
  | AnyNode
  | NotNode
  | { kind: 'always' }
  | { kind: 'never' };

export const PredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    EqNodeSchema,
    GtNodeSchema,
    GteNodeSchema,
    SelfNodeSchema,
    HasPropertyNodeSchema,
    HasConditionNodeSchema,
    DamageTypeNodeSchema,
    z.object({
      kind: z.literal('all'),
      terms: z.array(PredicateSchema),
    }),
    z.object({
      kind: z.literal('any'),
      terms: z.array(PredicateSchema),
    }),
    NotNodeSchema,
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('never') }),
  ]),
);

export const isPredicate = (value: unknown): value is Predicate =>
  PredicateSchema.safeParse(value).success;
