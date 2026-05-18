import { z } from 'zod';
import { ItemInstanceSchema } from '../runtime/item-instance.js';
import { DamageTypeSchema, ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const ItemAcquiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemAcquired'),
  instance: ItemInstanceSchema,
});
export type ItemAcquiredEvent = z.infer<typeof ItemAcquiredEventSchema>;

export const EQUIP_SLOTS = ['mainHand', 'offHand', 'armor', 'shield'] as const;
export const EquipSlotSchema = z.enum(EQUIP_SLOTS);
export type EquipSlot = z.infer<typeof EquipSlotSchema>;

export const ItemEquippedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemEquipped'),
  characterId: ULIDSchema,
  instanceId: ULIDSchema,
  slot: EquipSlotSchema,
});
export type ItemEquippedEvent = z.infer<typeof ItemEquippedEventSchema>;

export const ItemUnequippedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemUnequipped'),
  characterId: ULIDSchema,
  slot: EquipSlotSchema,
});
export type ItemUnequippedEvent = z.infer<typeof ItemUnequippedEventSchema>;

export const ItemAttunedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemAttuned'),
  characterId: ULIDSchema,
  instanceId: ULIDSchema,
});
export type ItemAttunedEvent = z.infer<typeof ItemAttunedEventSchema>;

export const ItemUnattunedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemUnattuned'),
  characterId: ULIDSchema,
  instanceId: ULIDSchema,
});
export type ItemUnattunedEvent = z.infer<typeof ItemUnattunedEventSchema>;

export const ItemBuffAppliedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemBuffApplied'),
  instanceId: ULIDSchema,
  attackBonus: z.number().int().default(0),
  damageBonus: z.number().int().default(0),
  extraDamageDice: z.string().optional(),
  extraDamageType: DamageTypeSchema.optional(),
  sourceEffectInstanceId: ULIDSchema,
  source: z.string().optional(),
});
export type ItemBuffAppliedEvent = z.infer<typeof ItemBuffAppliedEventSchema>;

export const ItemBuffRemovedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemBuffRemoved'),
  instanceId: ULIDSchema,
});
export type ItemBuffRemovedEvent = z.infer<typeof ItemBuffRemovedEventSchema>;

// Slice 235: a consumable item is consumed by a character. The
// reducer removes the instance from the character's inventory and
// from state.itemInstances. The planner emits the item's
// onConsume effects (Healed events, etc.) before this event in the
// chain. `targetId` is the recipient of those effects (defaults to
// the consumer when the consumer drinks the potion themselves; can
// be a different character when one character feeds a potion to
// another, as RAW permits).
export const ItemConsumedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemConsumed'),
  characterId: ULIDSchema,
  instanceId: ULIDSchema,
  definitionId: z.string(),
  targetId: ULIDSchema,
});
export type ItemConsumedEvent = z.infer<typeof ItemConsumedEventSchema>;

// Slice 240: a magic item is used by a character (activate-as-action
// shape). Unlike ItemConsumed, the instance persists after use; this
// event is a journal marker for the use, after the planner has
// already emitted the charge decrement (ItemChargeConsumed) and the
// onUse action effects (ConditionApplied for ApplyCondition variants,
// etc.). The reducer is a sanity check rather than a state mutator.
// `targetId` is the recipient of the onUse effects (defaults to the
// user when the user activates an item on themselves; can be a
// different character when one character activates an item on
// another).
export const ItemUsedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemUsed'),
  characterId: ULIDSchema,
  instanceId: ULIDSchema,
  definitionId: z.string(),
  targetId: ULIDSchema,
});
export type ItemUsedEvent = z.infer<typeof ItemUsedEventSchema>;
