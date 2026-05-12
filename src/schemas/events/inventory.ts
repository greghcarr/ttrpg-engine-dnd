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
