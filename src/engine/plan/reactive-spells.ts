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
} from '../../schemas/events/reactive-spells.js';
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
  const at = intent.at ?? nowIso();
  const dcResult = computeSpellSaveDC({
    character: caster,
    itemInstances: state.itemInstances,
    content,
    pendingChoices: state.pendingChoices,
    classId: intent.castingClassId,
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
