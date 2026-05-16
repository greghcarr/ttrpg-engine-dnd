import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

// Spell-applied temporary buff stamped onto a specific item instance.
// Magic Weapon (+1 / +2 / +3 attack and damage) and similar effects
// flow through here: a concentration spell's planner emits
// `ItemBuffApplied` with these fields, the item-instance state stores
// them, and the attack derive (attack bonus) + damage roll (damage
// bonus) read them back when this instance is used as the weapon.
// `sourceEffectInstanceId` links the buff to the concentration effect
// so `clearConcentrationEffect` lifts it when concentration ends.
export const ItemTemporaryBuffSchema = z.object({
  attackBonus: z.number().int().default(0),
  damageBonus: z.number().int().default(0),
  sourceEffectInstanceId: ULIDSchema,
  source: z.string().optional(),
});
export type ItemTemporaryBuff = z.infer<typeof ItemTemporaryBuffSchema>;

export const ItemInstanceSchema = z.object({
  id: ULIDSchema,
  definitionId: z.string(),
  customName: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  chargesRemaining: z.number().int().min(0).optional(),
  attuned: z.boolean().default(false),
  attunedTo: ULIDSchema.optional(),
  equippedBy: ULIDSchema.optional(),
  containerId: ULIDSchema.optional(),
  acquiredAtEventId: ULIDSchema.optional(),
  identifiedByCharacterIds: z.array(ULIDSchema).default([]),
  maxCharges: z.number().int().min(0).optional(),
  sentient: z
    .object({
      ego: z.number().int().min(0),
      alignment: z.string(),
      personality: z.string().optional(),
    })
    .optional(),
  temporaryBuff: ItemTemporaryBuffSchema.optional(),
});
export type ItemInstance = z.infer<typeof ItemInstanceSchema>;
