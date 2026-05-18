import { z } from 'zod';
import {
  DamageTypeSchema,
  DiceExpressionSchema,
  RechargeSchema,
  WeaponMasterySchema,
  WeaponPropertySchema,
} from '../primitives.js';
import { EffectSchema } from '../effects.js';

const ItemBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  weight: z.number().nonnegative().optional(),
  cost: z
    .object({
      amount: z.number().int().min(0),
      currency: z.enum(['cp', 'sp', 'ep', 'gp', 'pp']),
    })
    .optional(),
});

export const WeaponSchema = ItemBaseSchema.extend({
  itemKind: z.literal('weapon'),
  category: z.enum(['simple', 'martial']),
  attackKind: z.enum(['melee', 'ranged']),
  damageType: DamageTypeSchema,
  damageDice: DiceExpressionSchema,
  versatileDice: DiceExpressionSchema.optional(),
  properties: z.array(WeaponPropertySchema).default([]),
  mastery: WeaponMasterySchema.optional(),
  rangeNormal: z.number().int().optional(),
  rangeLong: z.number().int().optional(),
});
export type Weapon = z.infer<typeof WeaponSchema>;

export const ArmorSchema = ItemBaseSchema.extend({
  itemKind: z.literal('armor'),
  category: z.enum(['light', 'medium', 'heavy', 'shield']),
  baseAC: z.number().int().min(0),
  dexCap: z.number().int().optional(),
  strRequirement: z.number().int().optional(),
  stealthDisadvantage: z.boolean().default(false),
});
export type Armor = z.infer<typeof ArmorSchema>;

export const ToolSchema = ItemBaseSchema.extend({
  itemKind: z.literal('tool'),
  category: z.enum(['artisan', 'gaming', 'musical', 'other']),
});
export type Tool = z.infer<typeof ToolSchema>;

export const MagicItemSchema = ItemBaseSchema.extend({
  itemKind: z.literal('magic'),
  rarity: z.enum(['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact']),
  requiresAttunement: z.boolean().default(false),
  attunementCondition: z.string().optional(),
  charges: z
    .object({
      max: z.number().int().min(1),
      recharge: RechargeSchema,
      rechargeFormula: DiceExpressionSchema.optional(),
    })
    .optional(),
  effects: z.array(EffectSchema).default([]),
});
export type MagicItem = z.infer<typeof MagicItemSchema>;

// Slice 235: consumable-on-consume action set. Distinct from
// TriggerAction (which fires from OnEvent riders): consumption is a
// deliberate consumer-initiated act, not an event-triggered ride.
// Slice 236 added ApplyCondition (for buff potions). Future
// entries will add CastSpell (for spell-scroll consumption).
//
// Duration on ApplyCondition: the engine's auto-expiry primitive
// (slice 102 / 109) is round-based and source-keyed. Minute-based
// or hour-based potion durations are consumer-managed today —
// the planner emits ConditionApplied without expiresOnRound and
// the consumer removes it when the in-fiction timer runs out.
export const ConsumeActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('Heal'),
    dice: DiceExpressionSchema.optional(),
    flatAmount: z.number().int().min(0).optional(),
  }),
  z.object({
    kind: z.literal('ApplyCondition'),
    conditionId: z.string(),
  }),
]);
export type ConsumeAction = z.infer<typeof ConsumeActionSchema>;

export const ConsumableSchema = ItemBaseSchema.extend({
  itemKind: z.literal('consumable'),
  onConsume: z.array(ConsumeActionSchema).default([]),
  description: z.string().optional(),
});
export type Consumable = z.infer<typeof ConsumableSchema>;

export const GearSchema = ItemBaseSchema.extend({
  itemKind: z.literal('gear'),
  description: z.string().optional(),
});
export type Gear = z.infer<typeof GearSchema>;

export const ItemDefinitionSchema = z.discriminatedUnion('itemKind', [
  WeaponSchema,
  ArmorSchema,
  ToolSchema,
  MagicItemSchema,
  ConsumableSchema,
  GearSchema,
]);
export type ItemDefinition = z.infer<typeof ItemDefinitionSchema>;
