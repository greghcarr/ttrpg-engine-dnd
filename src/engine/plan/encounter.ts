import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type {
  EncounterCreatedEvent,
  EncounterEndedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  InitiativeRoll,
  RoundEndedEvent,
  TurnEndedEvent,
  TurnStartedEvent,
} from '../../schemas/events/encounter.js';
import type { RNG } from '../../rng/index.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId, newEncounterId } from '../../ids.js';
import { abilityModifier } from '../../derive/ability.js';
import { D20_SIDES } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

export interface CreateEncounterIntent {
  readonly type: 'CreateEncounter';
  readonly combatantIds: ReadonlyArray<string>;
  readonly name?: string;
  readonly encounterId?: string;
  readonly at?: string;
}

export const planCreateEncounter = (
  _state: CampaignState,
  _content: ResolvedContent,
  intent: CreateEncounterIntent,
): { events: ReadonlyArray<Event>; encounterId: string } => {
  const encounterId = intent.encounterId ?? newEncounterId();
  const at = intent.at ?? nowIso();
  const event: EncounterCreatedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'EncounterCreated',
    encounterId,
    ...(intent.name !== undefined ? { name: intent.name } : {}),
    combatantIds: [...intent.combatantIds],
  };
  return { events: [event], encounterId };
};

export interface RollInitiativeIntent {
  readonly type: 'RollInitiative';
  readonly encounterId: string;
  readonly at?: string;
}

export const planRollInitiative = (
  state: CampaignState,
  _content: ResolvedContent,
  rng: RNG,
  intent: RollInitiativeIntent,
): ReadonlyArray<Event> => {
  const encounter = state.encounters[intent.encounterId];
  if (!encounter) throw new Error(`Unknown encounter ${intent.encounterId}`);
  const at = intent.at ?? nowIso();
  const rolls: InitiativeRoll[] = encounter.combatants.map((c) => {
    const character = state.characters[c.combatantId];
    const dexMod = character ? abilityModifier(character.abilityScores.DEX) : 0;
    const d20 = rollDie(D20_SIDES, rng);
    return {
      combatantId: c.combatantId,
      d20,
      modifier: dexMod,
      total: d20 + dexMod,
    };
  });
  const event: InitiativeRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'InitiativeRolled',
    encounterId: intent.encounterId,
    rolls,
  };
  return [event];
};

export interface StartEncounterIntent {
  readonly type: 'StartEncounter';
  readonly encounterId: string;
  readonly at?: string;
}

export const planStartEncounter = (
  _state: CampaignState,
  _content: ResolvedContent,
  intent: StartEncounterIntent,
): ReadonlyArray<Event> => {
  const event: EncounterStartedEvent = {
    id: newEventId() as ULID,
    at: intent.at ?? nowIso(),
    type: 'EncounterStarted',
    encounterId: intent.encounterId,
  };
  return [event];
};

export interface AdvanceTurnIntent {
  readonly type: 'AdvanceTurn';
  readonly encounterId: string;
  readonly at?: string;
}

export const planAdvanceTurn = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: AdvanceTurnIntent,
): ReadonlyArray<Event> => {
  const encounter = state.encounters[intent.encounterId];
  if (!encounter) throw new Error(`Unknown encounter ${intent.encounterId}`);
  const at = intent.at ?? nowIso();
  const current = encounter.combatants[encounter.activeIndex];
  if (!current) throw new Error('No active combatant');
  const turnEnd: TurnEndedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'TurnEnded',
    encounterId: intent.encounterId,
    combatantId: current.combatantId,
    round: encounter.round,
  };
  const isLast = encounter.activeIndex >= encounter.combatants.length - 1;
  if (isLast) {
    const roundEnd: RoundEndedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'RoundEnded',
      encounterId: intent.encounterId,
      round: encounter.round,
    };
    const first = encounter.combatants[0];
    if (!first) throw new Error('No combatants');
    const nextTurn: TurnStartedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'TurnStarted',
      encounterId: intent.encounterId,
      combatantId: first.combatantId,
      round: encounter.round + 1,
    };
    return [turnEnd, roundEnd, nextTurn];
  }
  const next = encounter.combatants[encounter.activeIndex + 1];
  if (!next) throw new Error('Bad combatant index');
  const nextTurn: TurnStartedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'TurnStarted',
    encounterId: intent.encounterId,
    combatantId: next.combatantId,
    round: encounter.round,
  };
  return [turnEnd, nextTurn];
};

export interface BeginFirstTurnIntent {
  readonly type: 'BeginFirstTurn';
  readonly encounterId: string;
  readonly at?: string;
}

export const planBeginFirstTurn = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: BeginFirstTurnIntent,
): ReadonlyArray<Event> => {
  const encounter = state.encounters[intent.encounterId];
  if (!encounter) throw new Error(`Unknown encounter ${intent.encounterId}`);
  const first = encounter.combatants[0];
  if (!first) throw new Error('No combatants');
  const turnStart: TurnStartedEvent = {
    id: newEventId() as ULID,
    at: intent.at ?? nowIso(),
    type: 'TurnStarted',
    encounterId: intent.encounterId,
    combatantId: first.combatantId,
    round: encounter.round,
  };
  return [turnStart];
};

export interface EndEncounterIntent {
  readonly type: 'EndEncounter';
  readonly encounterId: string;
  readonly outcome: 'victory' | 'defeat' | 'fled' | 'parley';
  readonly at?: string;
}

export const planEndEncounter = (
  _state: CampaignState,
  _content: ResolvedContent,
  intent: EndEncounterIntent,
): ReadonlyArray<Event> => {
  const event: EncounterEndedEvent = {
    id: newEventId() as ULID,
    at: intent.at ?? nowIso(),
    type: 'EncounterEnded',
    encounterId: intent.encounterId,
    outcome: intent.outcome,
  };
  return [event];
};
