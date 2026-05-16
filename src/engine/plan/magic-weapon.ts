import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../schemas/events/spellcasting.js';
import type { ConcentrationStartedEvent, ConcentrationBrokenEvent } from '../../schemas/events/concentration.js';
import type {
  ItemBuffAppliedEvent,
} from '../../schemas/events/inventory.js';
import { newEffectInstanceId, newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';
import { computeAvailableSpellSlots } from '../../derive/spell-slots.js';
import { assertActorCanAct } from './_actor-state.js';

const SPELL_ID = 'magic-weapon';

export interface MagicWeaponIntent {
  readonly type: 'MagicWeapon';
  readonly casterId: string;
  // The specific weapon instance to buff. Must be a weapon (not
  // armor, shield, etc.) and exist in state.itemInstances. RAW says
  // the caster must touch the weapon; the engine treats whichever
  // instance the consumer names as the touched weapon.
  readonly weaponInstanceId: string;
  readonly slotLevel: number;
  readonly at?: string;
}

// Slot-level → enhancement bonus: +1 at 2nd / 3rd, +2 at 4th / 5th,
// +3 at 6th+. Capped at +3 for upcasts beyond 6th.
const enhancementForSlotLevel = (slotLevel: number): number =>
  Math.min(3, 1 + Math.floor((slotLevel - 2) / 2));

// Casts Magic Weapon. Validates the caster + weapon, consumes a
// slot (2nd-level or higher), breaks any prior concentration,
// stamps a temporary buff on the named weapon instance, and starts
// concentration on the new effect. The concentration ID is carried
// on the ItemBuffApplied event so `clearConcentrationEffect` can
// auto-strip the buff when concentration ends.
export const planMagicWeapon = (
  state: CampaignState,
  content: ResolvedContent,
  intent: MagicWeaponIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.casterId];
  if (!caster) throw new Error(`Unknown caster ${intent.casterId}`);
  assertActorCanAct(caster, 'cast Magic Weapon');

  const spell = content.spells.get(SPELL_ID);
  if (!spell) throw new Error('magic-weapon spell not in content');

  if (intent.slotLevel < spell.level) {
    throw new Error(
      `Slot level ${intent.slotLevel} insufficient for spell level ${spell.level}`,
    );
  }
  const available = computeAvailableSpellSlots(caster, content.classes);
  const slotsLeft = available.standardByLevel[intent.slotLevel - 1] ?? 0;
  if (slotsLeft <= 0) {
    throw new Error(`No spell slots of level ${intent.slotLevel} available`);
  }

  const weapon = state.itemInstances[intent.weaponInstanceId];
  if (!weapon) throw new Error(`Unknown weapon instance ${intent.weaponInstanceId}`);
  const weaponDef = content.items.get(weapon.definitionId);
  if (!weaponDef || weaponDef.itemKind !== 'weapon') {
    throw new Error(
      `Item instance ${intent.weaponInstanceId} is not a weapon (definition ${weapon.definitionId})`,
    );
  }

  const at = intent.at ?? nowIso();
  const bonus = enhancementForSlotLevel(intent.slotLevel);
  const events: Event[] = [];

  const declared: SpellCastDeclaredEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SpellCastDeclared',
    characterId: intent.casterId,
    spellId: SPELL_ID,
    slotLevel: intent.slotLevel,
    slotSource: 'standard',
    targetIds: [intent.weaponInstanceId],
    castAsRitual: false,
  };
  events.push(declared);

  const slotConsumed: SpellSlotConsumedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SpellSlotConsumed',
    characterId: intent.casterId,
    slotLevel: intent.slotLevel,
    causedByEventId: declared.id,
  };
  events.push(slotConsumed);

  // Break any prior concentration before the new one starts.
  if (caster.concentrationEffectId !== undefined) {
    const broken: ConcentrationBrokenEvent = {
      id: newEventId() as ULID,
      at,
      type: 'ConcentrationBroken',
      effectInstanceId: caster.concentrationEffectId,
      casterId: intent.casterId as ULID,
      reason: 'newConcentrationSpell',
      causedByEventId: declared.id,
    };
    events.push(broken);
  }

  const effectInstanceId = newEffectInstanceId();

  const buff: ItemBuffAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ItemBuffApplied',
    instanceId: intent.weaponInstanceId as ULID,
    attackBonus: bonus,
    damageBonus: bonus,
    sourceEffectInstanceId: effectInstanceId as ULID,
    source: SPELL_ID,
    causedByEventId: declared.id,
  };
  events.push(buff);

  const started: ConcentrationStartedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ConcentrationStarted',
    effectInstanceId: effectInstanceId as ULID,
    casterId: intent.casterId as ULID,
    spellId: SPELL_ID,
    targetIds: [],
    conditionsApplied: [],
    durationMinutes: 60,
    slotLevel: intent.slotLevel,
    causedByEventId: declared.id,
  };
  events.push(started);

  return events;
};
