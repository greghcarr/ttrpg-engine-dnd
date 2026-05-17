import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { RNG } from '../../rng/index.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { D20_SIDES } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import { invariant } from '../../internal/invariants.js';
import { abilityModifier, proficiencyBonus } from '../../derive/ability.js';
import { computeTotalLevel } from '../../schemas/runtime/character.js';
import { computeSpellSaveDC } from '../../derive/spell-dc.js';
import type { ULID } from '../ids-utils.js';
import type {
  ActionEconomyConsumedEvent,
} from '../../schemas/events/action-economy.js';
import type {
  SpellCounteredEvent,
  SpellDispelledEvent,
  ItemIdentifiedEvent,
  ShieldCastEvent,
  AbsorbElementsCastEvent,
  GuidanceUsedEvent,
} from '../../schemas/events/reactive-spells.js';
import type { ConditionAppliedEvent, HealedEvent } from '../../schemas/events/combat.js';
import type { DamageType } from '../../schemas/primitives.js';
import type { ConcentrationBrokenEvent } from '../../schemas/events/concentration.js';
import { newAppliedConditionId } from '../../ids.js';
import type {
  SpellSlotConsumedEvent,
} from '../../schemas/events/spellcasting.js';
import type {
  SaveRolledEvent,
  AbilityCheckRolledEvent,
} from '../../schemas/events/checks.js';

const DC_ABOVE_AUTO_FAIL = 10;
const COUNTERSPELL_SLOT_LEVEL = 3;

const economyConsumedIfEncountered = (
  state: CampaignState,
  combatantId: string,
  at: string,
  kind: 'action' | 'reaction',
): ActionEconomyConsumedEvent | undefined => {
  if (state.activeEncounterId === undefined) return undefined;
  const encounter = state.encounters[state.activeEncounterId];
  if (encounter === undefined) return undefined;
  if (!encounter.combatants.some((c) => c.combatantId === combatantId)) return undefined;
  return {
    id: newEventId() as ULID,
    at,
    type: 'ActionEconomyConsumed',
    encounterId: encounter.id,
    combatantId,
    kind,
  };
};

/**
 * RAW 2024 PHB ch.1: "You can take only one Reaction per round." This
 * helper throws if the combatant has already used their reaction since
 * the last round boundary. Out-of-encounter (no active encounter) is a
 * no-op — reactions only exist inside initiative.
 */
const assertReactionAvailable = (state: CampaignState, combatantId: string, label: string): void => {
  if (state.activeEncounterId === undefined) return;
  const encounter = state.encounters[state.activeEncounterId];
  if (!encounter) return;
  const combatant = encounter.combatants.find((c) => c.combatantId === combatantId);
  if (!combatant) return;
  if (combatant.turnUsage.reactionUsedThisRound) {
    const name = state.characters[combatantId]?.name ?? combatantId;
    throw new Error(`${name} cannot ${label}: reaction already used this round`);
  }
};

export interface CounterspellIntent {
  readonly type: 'Counterspell';
  readonly counterCasterId: string;
  readonly targetCasterId: string;
  readonly originalSpellEventId: string;
  readonly spellId: string;
  readonly castingClassId: string;
  readonly slotLevelToConsume?: number;
  // The slot level the target caster used. Counterspell doesn't "save"
  // the original caster's slot — the act of casting still spent it,
  // even on a successful counter (2024 RAW). Set to 0 if the countered
  // spell was a cantrip. Required so the engine can emit the original
  // caster's SpellSlotConsumed and the transcript reflects the loss.
  readonly originalSpellLevel: number;
  readonly at?: string;
}

export const planCounterspell = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: CounterspellIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.counterCasterId];
  invariant(caster !== undefined, `Counter caster ${intent.counterCasterId} not found`);
  const target = state.characters[intent.targetCasterId];
  invariant(target !== undefined, `Target caster ${intent.targetCasterId} not found`);
  assertReactionAvailable(state, intent.counterCasterId, 'cast Counterspell');
  const at = intent.at ?? nowIso();
  const dcResult = computeSpellSaveDC({
    character: caster,
    itemInstances: state.itemInstances,
    content,
    pendingChoices: state.pendingChoices,
    classId: intent.castingClassId,
    characters: state.characters,
  });
  const dc = dcResult.total;
  const conBonus = abilityModifier(target.abilityScores.CON);
  const d20 = rollDie(D20_SIDES, rng);
  const total = d20 + conBonus;
  const saveSucceeded = total >= dc;
  const slotLevel = intent.slotLevelToConsume ?? COUNTERSPELL_SLOT_LEVEL;
  invariant(slotLevel >= COUNTERSPELL_SLOT_LEVEL, `Counterspell requires a 3rd-level or higher slot`);

  const events: Event[] = [];
  const reaction = economyConsumedIfEncountered(state, intent.counterCasterId, at, 'reaction');
  if (reaction !== undefined) events.push(reaction);
  // The original caster spent their slot the moment they began casting;
  // RAW the slot is lost even when the spell is countered. Emit that
  // first so the transcript reads in cast-then-react order.
  if (intent.originalSpellLevel > 0) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'SpellSlotConsumed',
      characterId: intent.targetCasterId,
      slotLevel: intent.originalSpellLevel,
    } satisfies SpellSlotConsumedEvent);
  }
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'SpellSlotConsumed',
    characterId: intent.counterCasterId,
    slotLevel,
  } satisfies SpellSlotConsumedEvent);
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'SaveRolled',
    targetId: intent.targetCasterId,
    ability: 'CON',
    dc,
    d20: [d20],
    used: 'none',
    bonus: conBonus,
    total,
    success: saveSucceeded,
  } satisfies SaveRolledEvent);
  if (!saveSucceeded) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'SpellCountered',
      originalSpellEventId: intent.originalSpellEventId,
      counterCasterId: intent.counterCasterId,
      targetCasterId: intent.targetCasterId,
      spellId: intent.spellId,
    } satisfies SpellCounteredEvent);
  }
  return events;
};

export interface DispelMagicIntent {
  readonly type: 'DispelMagic';
  readonly casterId: string;
  readonly effectInstanceId: string;
  readonly targetSpellLevel: number;
  readonly slotLevel: number;
  readonly castingClassId: string;
  readonly at?: string;
}

export const planDispelMagic = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: DispelMagicIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.casterId];
  invariant(caster !== undefined, `Caster ${intent.casterId} not found`);
  const effect = state.effectInstances[intent.effectInstanceId];
  invariant(effect !== undefined, `EffectInstance ${intent.effectInstanceId} not found`);
  invariant(intent.slotLevel >= 3, `Dispel Magic requires a 3rd-level or higher slot`);
  const at = intent.at ?? nowIso();

  const events: Event[] = [];
  const action = economyConsumedIfEncountered(state, intent.casterId, at, 'action');
  if (action !== undefined) events.push(action);
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'SpellSlotConsumed',
    characterId: intent.casterId,
    slotLevel: intent.slotLevel,
  } satisfies SpellSlotConsumedEvent);

  const autoSucceed = intent.targetSpellLevel <= intent.slotLevel;
  let dispelSucceeds = autoSucceed;
  if (!autoSucceed) {
    const dc = DC_ABOVE_AUTO_FAIL + intent.targetSpellLevel;
    const cls = content.classes.get(intent.castingClassId);
    const rawAbility = cls?.spellcasting?.ability;
    const ability: 'INT' | 'WIS' | 'CHA' =
      rawAbility === 'INT' || rawAbility === 'WIS' || rawAbility === 'CHA' ? rawAbility : 'INT';
    const totalLevel = computeTotalLevel(caster);
    const bonus = abilityModifier(caster.abilityScores[ability]) + proficiencyBonus(totalLevel);
    const d20 = rollDie(D20_SIDES, rng);
    const total = d20 + bonus;
    dispelSucceeds = total >= dc;
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'AbilityCheckRolled',
      characterId: intent.casterId,
      ability,
      dc,
      success: dispelSucceeds,
      d20: [d20],
      used: 'none',
      bonus,
      total,
    } satisfies AbilityCheckRolledEvent);
  }
  if (dispelSucceeds) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'SpellDispelled',
      effectInstanceId: intent.effectInstanceId,
      dispelledByCharacterId: intent.casterId,
    } satisfies SpellDispelledEvent);
  }
  return events;
};

export interface IdentifyIntent {
  readonly type: 'Identify';
  readonly casterId: string;
  readonly itemInstanceId: string;
  readonly slotLevel?: number;
  readonly at?: string;
}

export const planIdentify = (
  state: CampaignState,
  _content: ResolvedContent,
  _rng: RNG,
  intent: IdentifyIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.casterId];
  invariant(caster !== undefined, `Caster ${intent.casterId} not found`);
  const item = state.itemInstances[intent.itemInstanceId];
  invariant(item !== undefined, `Item ${intent.itemInstanceId} not found`);
  const at = intent.at ?? nowIso();
  const events: Event[] = [];
  const action = economyConsumedIfEncountered(state, intent.casterId, at, 'action');
  if (action !== undefined) events.push(action);
  if (intent.slotLevel !== undefined && intent.slotLevel >= 1) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'SpellSlotConsumed',
      characterId: intent.casterId,
      slotLevel: intent.slotLevel,
    } satisfies SpellSlotConsumedEvent);
  }
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'ItemIdentified',
    itemInstanceId: intent.itemInstanceId,
    identifiedByCharacterId: intent.casterId,
  } satisfies ItemIdentifiedEvent);
  return events;
};

const SHIELD_AC_BONUS = 5;
const SHIELD_MIN_SLOT_LEVEL = 1;

export interface ShieldIntent {
  readonly type: 'Shield';
  readonly casterId: string;
  // The AttackRolled event id that triggered the reaction. Recorded on
  // the ShieldCast event for the transcript and for later auditing.
  readonly triggeringAttackEventId: string;
  // The d20 total (d20 + all attack modifiers) on the triggering attack.
  // Consumers extract this from the AttackRolledEvent. Used to determine
  // whether +5 AC would reduce the hit to a miss.
  readonly triggeringAttackTotal: number;
  // The AC of the caster against which the attack resolved (pre-shield).
  // Consumers extract this from the AttackRolledEvent.
  readonly originalAC: number;
  readonly slotLevel?: number;
  readonly at?: string;
}

export interface ShieldOutcome {
  readonly events: ReadonlyArray<Event>;
  readonly preventedHit: boolean;
}

/**
 * RAW 2024 PHB Shield: reaction triggered when you're hit by an attack or
 * targeted by Magic Missile. +5 to AC against the triggering attack and
 * until the start of your next turn; immune to Magic Missile damage for
 * the duration.
 *
 * The planner emits the reaction, slot, and ConditionApplied('shielded')
 * events, plus a ShieldCast notification with `preventedHit` set to
 * indicate whether the +5 was enough to convert the hit into a miss.
 * The consumer is responsible for omitting the DamageRolled/DamageApplied
 * chain when `preventedHit === true`.
 *
 * Magic Missile immunity is not yet modeled (would need per-spell
 * immunity primitive); the AC bonus is.
 */
export const planShield = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: ShieldIntent,
): ShieldOutcome => {
  const caster = state.characters[intent.casterId];
  invariant(caster !== undefined, `Caster ${intent.casterId} not found`);
  const slotLevel = intent.slotLevel ?? SHIELD_MIN_SLOT_LEVEL;
  invariant(slotLevel >= SHIELD_MIN_SLOT_LEVEL, 'Shield is a 1st-level spell');
  assertReactionAvailable(state, intent.casterId, 'cast Shield');
  const at = intent.at ?? nowIso();

  const events: Event[] = [];
  const reaction = economyConsumedIfEncountered(state, intent.casterId, at, 'reaction');
  if (reaction !== undefined) events.push(reaction);
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'SpellSlotConsumed',
    characterId: intent.casterId,
    slotLevel,
  } satisfies SpellSlotConsumedEvent);
  const shieldedApplied: ConditionAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ConditionApplied',
    targetId: intent.casterId,
    conditionId: 'shielded',
    appliedConditionId: newAppliedConditionId(),
  };
  events.push(shieldedApplied);
  const preventedHit = intent.triggeringAttackTotal < intent.originalAC + SHIELD_AC_BONUS;
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'ShieldCast',
    casterId: intent.casterId,
    triggeringAttackEventId: intent.triggeringAttackEventId,
    preventedHit,
  } satisfies ShieldCastEvent);
  return { events, preventedHit };
};

const ABSORB_ELEMENTS_SPELL_ID = 'absorb-elements';
const ABSORB_ELEMENTS_MIN_SLOT_LEVEL = 1;
const ABSORB_ELEMENTS_TYPES: readonly DamageType[] = [
  'acid',
  'cold',
  'fire',
  'lightning',
  'thunder',
];

export interface AbsorbElementsIntent {
  readonly type: 'AbsorbElements';
  readonly casterId: string;
  // The DamageApplied event id whose damage prompted the reaction.
  // Recorded on the AbsorbElementsCast event for the transcript.
  readonly triggeringDamageEventId: string;
  // The damage type to absorb. Must be one of acid, cold, fire,
  // lightning, thunder; the planner throws otherwise.
  readonly damageType: DamageType;
  // The original damage amount of that type from the triggering event.
  // The planner halves it (rounded down) and emits a compensating
  // `Healed` event so the caster's HP refund flows through the existing
  // healing path.
  readonly damageAmount: number;
  readonly slotLevel?: number;
  readonly at?: string;
}

export interface AbsorbElementsOutcome {
  readonly events: ReadonlyArray<Event>;
  // The damage absorbed back via the `Healed` event. Returned in the
  // outcome for transcript / consumer convenience; also surfaced on
  // the AbsorbElementsCast notification.
  readonly halvedAmount: number;
}

const absorbChargedConditionId = (damageType: DamageType): string =>
  `absorb-elements-charged-${damageType}-active`;

/**
 * RAW 2024 PHB Absorb Elements: reaction triggered when you take acid,
 * cold, fire, lightning, or thunder damage. The damage you take is
 * halved; the first time you hit with a melee attack on your next turn,
 * the target takes an extra 1d6 damage of the triggering type.
 *
 * Event-sourcing approach: the triggering DamageApplied event has
 * already committed when this planner runs. Rather than mutate that
 * event, we emit a compensating `Healed` event for the absorbed half,
 * so the caster's HP nets out at half the original damage. The
 * `absorb-elements-charged-<type>-active` condition carries the
 * on-next-hit rider (OnEvent + AddDamage + consumeOnTrigger: true).
 *
 * Slot-level scaling not modeled: the rider always adds 1d6. Higher-
 * level slots' +1d6 per slot above 1st would need either
 * parameterized conditions or a slot-aware AddDamage variant.
 */
export const planAbsorbElements = (
  state: CampaignState,
  content: ResolvedContent,
  intent: AbsorbElementsIntent,
): AbsorbElementsOutcome => {
  const caster = state.characters[intent.casterId];
  invariant(caster !== undefined, `Caster ${intent.casterId} not found`);

  if (!ABSORB_ELEMENTS_TYPES.includes(intent.damageType)) {
    throw new Error(
      `Absorb Elements damage type '${intent.damageType}' not in allowed list [${ABSORB_ELEMENTS_TYPES.join(', ')}]`,
    );
  }
  if (intent.damageAmount < 0) {
    throw new Error('Absorb Elements damageAmount must be non-negative');
  }

  const slotLevel = intent.slotLevel ?? ABSORB_ELEMENTS_MIN_SLOT_LEVEL;
  invariant(slotLevel >= ABSORB_ELEMENTS_MIN_SLOT_LEVEL, 'Absorb Elements is a 1st-level spell');

  const spell = content.spells.get(ABSORB_ELEMENTS_SPELL_ID);
  invariant(spell !== undefined, 'absorb-elements spell not in content');

  assertReactionAvailable(state, intent.casterId, 'cast Absorb Elements');
  const at = intent.at ?? nowIso();

  const halvedAmount = Math.floor(intent.damageAmount / 2);
  const events: Event[] = [];

  const reaction = economyConsumedIfEncountered(state, intent.casterId, at, 'reaction');
  if (reaction !== undefined) events.push(reaction);

  events.push({
    id: newEventId() as ULID,
    at,
    type: 'SpellSlotConsumed',
    characterId: intent.casterId,
    slotLevel,
  } satisfies SpellSlotConsumedEvent);

  if (halvedAmount > 0) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'Healed',
      targetId: intent.casterId as ULID,
      amount: halvedAmount,
      source: ABSORB_ELEMENTS_SPELL_ID,
    } satisfies HealedEvent);
  }

  const conditionId = absorbChargedConditionId(intent.damageType);
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'ConditionApplied',
    targetId: intent.casterId,
    conditionId,
    appliedConditionId: newAppliedConditionId(),
  } satisfies ConditionAppliedEvent);

  events.push({
    id: newEventId() as ULID,
    at,
    type: 'AbsorbElementsCast',
    casterId: intent.casterId as ULID,
    triggeringDamageEventId: intent.triggeringDamageEventId as ULID,
    damageType: intent.damageType,
    halvedAmount,
  } satisfies AbsorbElementsCastEvent);

  return { events, halvedAmount };
};

const GUIDANCE_DIE_SIDES = 4;

export interface ConsumeGuidanceIntent {
  readonly type: 'ConsumeGuidance';
  readonly targetId: string;
  // Optional reference to the AbilityCheckRolledEvent the d4 is being
  // added to — purely informational, surfaces on the GuidanceUsed event
  // for transcript clarity.
  readonly abilityCheckEventId?: string;
  readonly at?: string;
}

export interface ConsumeGuidanceOutcome {
  readonly events: ReadonlyArray<Event>;
  readonly d4: number;
}

/**
 * RAW 2024 Guidance: cantrip, V/S, touch, concentration up to 1 minute.
 * The target rolls a d4 and adds the result to one ability check of
 * their choice; can roll before or after making the check; the spell
 * then ends.
 *
 * Implementation: the consumer calls this planner when the target wants
 * to spend their Guidance d4. The engine rolls the d4 and emits a
 * `GuidanceUsed` event with the value, plus a `ConcentrationBroken`
 * (reason='used') that lifts the `guided` condition from the target
 * via the standard concentration-cleanup path.
 *
 * The d4 value is returned in the outcome so the consumer can add it
 * to whichever ability check they're applying it to. The engine does
 * not modify the check's stored bonus — Guidance is the player's
 * choice to apply, and the consumer is responsible for the addition.
 */
export const planConsumeGuidance = (
  state: CampaignState,
  _content: ResolvedContent,
  rng: RNG,
  intent: ConsumeGuidanceIntent,
): ConsumeGuidanceOutcome => {
  const target = state.characters[intent.targetId];
  invariant(target !== undefined, `Target ${intent.targetId} not found`);
  const applied = target.appliedConditions.find((c) => c.conditionId === 'guided');
  invariant(
    applied !== undefined,
    `Target ${intent.targetId} does not have the guided condition`,
  );
  const effectInstanceId = (() => {
    for (const inst of Object.values(state.effectInstances)) {
      if (inst.spellId !== 'guidance') continue;
      if (inst.conditionsApplied.some((c) => c.appliedConditionId === applied.id)) {
        return inst.id;
      }
    }
    return undefined;
  })();
  invariant(
    effectInstanceId !== undefined,
    'No active Guidance effect instance backs the guided condition',
  );
  const caster = (() => {
    const inst = state.effectInstances[effectInstanceId];
    return inst === undefined ? undefined : state.characters[inst.casterId];
  })();
  invariant(caster !== undefined, 'Guidance caster not found');

  const at = intent.at ?? nowIso();
  const d4 = rollDie(GUIDANCE_DIE_SIDES, rng);
  const events: Event[] = [];
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'GuidanceUsed',
    targetId: intent.targetId as ULID,
    d4,
    ...(intent.abilityCheckEventId !== undefined
      ? { abilityCheckEventId: intent.abilityCheckEventId as ULID }
      : {}),
  } satisfies GuidanceUsedEvent);
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'ConcentrationBroken',
    effectInstanceId: effectInstanceId as ULID,
    casterId: caster.id as ULID,
    reason: 'used',
  } satisfies ConcentrationBrokenEvent);
  return { events, d4 };
};
