import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { RNG } from '../../rng/index.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { D20_SIDES } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import { invariant } from '../../internal/invariants.js';
import { computeAbilityCheck } from '../../derive/ability-check.js';
import type { ULID } from '../ids-utils.js';
import type { ForagedForEvent, NavigationCheckRolledEvent } from '../../schemas/events/travel.js';

const FORAGE_FOOD_ON_SUCCESS = 4;
const FORAGE_WATER_ON_SUCCESS = 4;

export interface ForageIntent {
  readonly type: 'Forage';
  readonly partyId: string;
  readonly foragerId: string;
  readonly dc: number;
  readonly at?: string;
}

export const planForage = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: ForageIntent,
): ReadonlyArray<Event> => {
  invariant(state.parties[intent.partyId] !== undefined, `Party ${intent.partyId} not found`);
  const forager = state.characters[intent.foragerId];
  invariant(forager !== undefined, `Forager ${intent.foragerId} not found`);
  const derivation = computeAbilityCheck({
    character: forager,
    itemInstances: state.itemInstances,
    content,
    ability: 'WIS',
    skill: 'survival',
    pendingChoices: state.pendingChoices,
  });
  const d20 = rollDie(D20_SIDES, rng);
  const total = d20 + derivation.total;
  const success = total >= intent.dc;
  const at = intent.at ?? nowIso();
  const event: ForagedForEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ForagedFor',
    partyId: intent.partyId,
    foragerId: intent.foragerId,
    d20,
    bonus: derivation.total,
    total,
    dc: intent.dc,
    success,
    foodPounds: success ? FORAGE_FOOD_ON_SUCCESS : 0,
    waterPounds: success ? FORAGE_WATER_ON_SUCCESS : 0,
  };
  return [event];
};

export interface NavigationCheckIntent {
  readonly type: 'NavigationCheck';
  readonly partyId: string;
  readonly navigatorId: string;
  readonly dc: number;
  readonly at?: string;
}

export const planNavigationCheck = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: NavigationCheckIntent,
): ReadonlyArray<Event> => {
  invariant(state.parties[intent.partyId] !== undefined, `Party ${intent.partyId} not found`);
  const navigator = state.characters[intent.navigatorId];
  invariant(navigator !== undefined, `Navigator ${intent.navigatorId} not found`);
  const derivation = computeAbilityCheck({
    character: navigator,
    itemInstances: state.itemInstances,
    content,
    ability: 'WIS',
    skill: 'survival',
    pendingChoices: state.pendingChoices,
  });
  const d20 = rollDie(D20_SIDES, rng);
  const total = d20 + derivation.total;
  const at = intent.at ?? nowIso();
  const event: NavigationCheckRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'NavigationCheckRolled',
    partyId: intent.partyId,
    navigatorId: intent.navigatorId,
    d20,
    bonus: derivation.total,
    total,
    dc: intent.dc,
    success: total >= intent.dc,
  };
  return [event];
};
