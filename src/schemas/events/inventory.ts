import { z } from 'zod';
import { ItemInstanceSchema } from '../runtime/item-instance.js';
import { ULIDSchema } from '../primitives.js';
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
  sourceEffectInstanceId: ULIDSchema,
  source: z.string().optional(),
});
export type ItemBuffAppliedEvent = z.infer<typeof ItemBuffAppliedEventSchema>;

export const ItemBuffRemovedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemBuffRemoved'),
  instanceId: ULIDSchema,
});
export type ItemBuffRemovedEvent = z.infer<typeof ItemBuffRemovedEventSchema>;
