import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { ItemDefinition } from '../schemas/content/item.js';

// Slice 112. Single source of truth for "is this weapon attack
// magical?" The engine reads two signals today:
//
// 1. `itemInstance.temporaryBuff` — populated by the Magic Weapon
//    spell, Elemental Weapon, and similar buffs. RAW makes those
//    attacks count as magical for the duration.
// 2. `itemDef.itemKind === 'magic'` — direct magic-item weapons
//    (Flametongue Longsword, etc.). The current starter pack lists
//    magic weapons as MagicItem rows with no weapon stats, so this
//    branch is dormant; it's wired up for future content that ships
//    a weapon as `itemKind: 'magic'`.
//
// "+1 / +2 / +3" enhancement-bonus weapons aren't yet modeled in
// content. When they land, the detector either gains a third branch
// or the modeling collapses one of the two existing branches.
export const isMagicWeaponAttack = (
  instance: ItemInstance,
  def: ItemDefinition,
): boolean => {
  if (instance.temporaryBuff !== undefined) return true;
  if (def.itemKind === 'magic') return true;
  return false;
};
