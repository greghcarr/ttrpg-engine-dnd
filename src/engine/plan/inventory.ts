// Inventory-level planners.
//
// Currently just `planEquip`: content-aware validation of an item-slot
// assignment. The reducer (`applyItemEquipped`) doesn't have access
// to content packs, so it can't check weapon properties (`two-handed`,
// `light`, etc.) against the slot or against other equipped items.
// This planner wraps the `ItemEquipped` event with those checks.
//
// RAW 2024 PHB Equipment:
//   - Wielding a two-handed weapon requires both hands; a shield
//     occupies the off hand.
//   - You can't equip a two-handed weapon in mainHand while a shield
//     is equipped, and you can't equip a shield while mainHand holds
//     a two-handed weapon.
//   - Versatile weapons can be wielded one- or two-handed; the engine
//     doesn't track which mode is active per equip, so versatile +
//     shield is permitted (the consumer chooses one-handed mode).

import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type {
  ItemEquippedEvent,
  EquipSlot,
} from '../../schemas/events/inventory.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

export interface EquipIntent {
  readonly type: 'Equip';
  readonly characterId: string;
  readonly instanceId: string;
  readonly slot: EquipSlot;
  readonly at?: string;
}

const isTwoHandedWeapon = (
  state: CampaignState,
  content: ResolvedContent,
  instanceId: string,
): boolean => {
  const instance = state.itemInstances[instanceId];
  if (!instance) return false;
  const def = content.items.get(instance.definitionId);
  if (!def || def.itemKind !== 'weapon') return false;
  return def.properties.includes('two-handed');
};

const isShield = (
  state: CampaignState,
  content: ResolvedContent,
  instanceId: string,
): boolean => {
  const instance = state.itemInstances[instanceId];
  if (!instance) return false;
  const def = content.items.get(instance.definitionId);
  if (!def || def.itemKind !== 'armor') return false;
  return def.category === 'shield';
};

export const planEquip = (
  state: CampaignState,
  content: ResolvedContent,
  intent: EquipIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  const instance = state.itemInstances[intent.instanceId];
  if (!instance) throw new Error(`Unknown item instance ${intent.instanceId}`);
  const def = content.items.get(instance.definitionId);
  if (!def) throw new Error(`Unknown item definition ${instance.definitionId}`);

  if (intent.slot === 'mainHand') {
    // RAW: equipping a two-handed weapon while a shield is in the
    // shield slot is illegal — the shield's hand is occupied.
    const shieldId = character.equipped.shield;
    if (
      def.itemKind === 'weapon' &&
      def.properties.includes('two-handed') &&
      shieldId !== undefined
    ) {
      throw new Error(
        `${character.name} cannot equip ${def.name} (two-handed) while a shield is equipped`,
      );
    }
  } else if (intent.slot === 'shield') {
    // Equipping a shield while the main hand has a two-handed weapon
    // is the mirror of the rule above.
    if (def.itemKind === 'armor' && def.category === 'shield') {
      const mainHandId = character.equipped.mainHand;
      if (mainHandId !== undefined && isTwoHandedWeapon(state, content, mainHandId)) {
        throw new Error(
          `${character.name} cannot equip a shield while wielding a two-handed weapon`,
        );
      }
    }
  }
  // Other slots (armor, offHand) have no two-handed/shield conflict;
  // anything else the engine rejects elsewhere.
  void isShield;

  const at = intent.at ?? nowIso();
  const event: ItemEquippedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ItemEquipped',
    characterId: intent.characterId,
    instanceId: intent.instanceId,
    slot: intent.slot,
  };
  return [event];
};
