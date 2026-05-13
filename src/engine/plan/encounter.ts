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
import type { DeathSaveRolledEvent } from '../../schemas/events/combat.js';
import type { RNG } from '../../rng/index.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId, newEncounterId } from '../../ids.js';
import { abilityModifier } from '../../derive/ability.js';
import { D20_SIDES, NAT_20 } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';
import type { Character } from '../../schemas/runtime/character.js';

const DEATH_SAVE_SUCCESS_THRESHOLD = 10;
const DEATH_SAVE_FAILURES_TO_DIE = 3;
const DEATH_SAVE_SUCCESSES_TO_STABILIZE = 3;

/**
 * RAW 2024 PHB ch.1: at the start of an unconscious creature's turn at 0 HP,
 * if it's neither stable nor already dead (3 failures), it rolls a death save.
 * The roll is part of the turn-start event chain.
 */
const planDeathSaveAtTurnStart = (
  character: Character | undefined,
  rng: RNG,
  causedByEventId: ULID,
  at: string,
): ReadonlyArray<DeathSaveRolledEvent> => {
  if (!character) return [];
  if (character.hp.current > 0) return [];
  if (character.deathSaves.stable) return [];
  if (character.deathSaves.failures >= DEATH_SAVE_FAILURES_TO_DIE) return [];
  if (character.deathSaves.successes >= DEATH_SAVE_SUCCESSES_TO_STABILIZE) return [];
  const d20 = rollDie(D20_SIDES, rng);
  const success = d20 >= DEATH_SAVE_SUCCESS_THRESHOLD;
  const critical = d20 === NAT_20;
  const save: DeathSaveRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DeathSaveRolled',
    targetId: character.id as ULID,
    d20,
    success,
    critical,
    causedByEventId,
  };
  return [save];
};

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
  rng: RNG,
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
    const deathSave = planDeathSaveAtTurnStart(
      state.characters[first.combatantId],
      rng,
      nextTurn.id,
      at,
    );
    return [turnEnd, roundEnd, nextTurn, ...deathSave];
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
  const deathSave = planDeathSaveAtTurnStart(
    state.characters[next.combatantId],
    rng,
    nextTurn.id,
    at,
  );
  return [turnEnd, nextTurn, ...deathSave];
};

export interface BeginFirstTurnIntent {
  readonly type: 'BeginFirstTurn';
  readonly encounterId: string;
  readonly at?: string;
}

export const planBeginFirstTurn = (
  state: CampaignState,
  _content: ResolvedContent,
  rng: RNG,
  intent: BeginFirstTurnIntent,
): ReadonlyArray<Event> => {
  const encounter = state.encounters[intent.encounterId];
  if (!encounter) throw new Error(`Unknown encounter ${intent.encounterId}`);
  const first = encounter.combatants[0];
  if (!first) throw new Error('No combatants');
  const at = intent.at ?? nowIso();
  const turnStart: TurnStartedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'TurnStarted',
    encounterId: intent.encounterId,
    combatantId: first.combatantId,
    round: encounter.round,
  };
  const deathSave = planDeathSaveAtTurnStart(
    state.characters[first.combatantId],
    rng,
    turnStart.id,
    at,
  );
  return [turnStart, ...deathSave];
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
