import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { DamageType } from '../../schemas/primitives.js';
import type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../schemas/events/spellcasting.js';
import type { ConcentrationStartedEvent, ConcentrationBrokenEvent } from '../../schemas/events/concentration.js';
import type { ItemBuffAppliedEvent } from '../../schemas/events/inventory.js';
import { newEffectInstanceId, newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';
import { computeAvailableSpellSlots } from '../../derive/spell-slots.js';
import { assertActorCanAct } from './_actor-state.js';

const SPELL_ID = 'elemental-weapon';
const SPELL_DURATION_MINUTES = 60;
const ALLOWED_DAMAGE_TYPES: readonly DamageType[] = [
  'acid',
  'cold',
  'fire',
  'lightning',
  'thunder',
];

export interface ElementalWeaponIntent {
  readonly type: 'ElementalWeapon';
  readonly casterId: string;
  // The weapon instance to enhance. Must be a non-magical weapon
  // per RAW; the engine currently doesn't gate on a "magical" flag,
  // so the consumer is responsible for the RAW check.
  readonly weaponInstanceId: string;
  readonly slotLevel: number;
  // Caster-chosen at cast time. Restricted to acid / cold / fire /
  // lightning / thunder per RAW; the planner throws on anything else.
  readonly damageType: DamageType;
  readonly at?: string;
}

// Slot-level → enhancement bonus per RAW: +1 at 3-4, +2 at 5-6, +3 at 7+.
// The extra damage scales with the bonus: bonus×1d4 of the chosen type.
const enhancementForSlotLevel = (slotLevel: number): number => {
  if (slotLevel >= 7) return 3;
  if (slotLevel >= 5) return 2;
  return 1;
};

// Casts Elemental Weapon. Validates the caster + weapon + damage type,
// consumes a level-3+ slot, breaks any prior concentration, stamps a
// temporary buff on the named weapon instance (attack/damage bonus +
// per-hit extra elemental dice), and starts concentration on the new
// effect. The buff's `sourceEffectInstanceId` lets
// `clearConcentrationEffect` auto-strip it on drop.
export const planElementalWeapon = (
  state: CampaignState,
  content: ResolvedContent,
  intent: ElementalWeaponIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.casterId];
  if (!caster) throw new Error(`Unknown caster ${intent.casterId}`);
  assertActorCanAct(caster, 'cast Elemental Weapon');

  const spell = content.spells.get(SPELL_ID);
  if (!spell) throw new Error('elemental-weapon spell not in content');

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

  if (!ALLOWED_DAMAGE_TYPES.includes(intent.damageType)) {
    throw new Error(
      `Elemental Weapon damage type '${intent.damageType}' not in allowed list [${ALLOWED_DAMAGE_TYPES.join(', ')}]`,
    );
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
    damageBonus: 0,
    extraDamageDice: `${bonus}d4`,
    extraDamageType: intent.damageType,
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
    durationMinutes: SPELL_DURATION_MINUTES,
    slotLevel: intent.slotLevel,
    causedByEventId: declared.id,
  };
  events.push(started);

  return events;
};
