import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { Character } from '../../schemas/runtime/character.js';
import type { TriggerFiredEvent } from '../../schemas/events/triggers.js';
import { invariant } from '../../internal/invariants.js';

const requireCharacter = (state: Draft<CampaignState>, id: string): Draft<Character> => {
  const c = state.characters[id];
  invariant(c !== undefined, `Character ${id} not found`);
  return c;
};

export const applyTriggerFired = (
  state: Draft<CampaignState>,
  event: TriggerFiredEvent,
): void => {
  const character = requireCharacter(state, event.characterId);
  const prior = character.triggerCounters[event.triggerId] ?? {};
  character.triggerCounters[event.triggerId] = {
    ...prior,
    ...(event.cadence.firedThisTurn !== undefined
      ? { firedThisTurn: event.cadence.firedThisTurn }
      : {}),
    ...(event.cadence.firedThisRound !== undefined
      ? { firedThisRound: event.cadence.firedThisRound }
      : {}),
    ...(event.cadence.firedThisShortRest !== undefined
      ? { firedThisShortRest: event.cadence.firedThisShortRest }
      : {}),
    ...(event.cadence.firedThisLongRest !== undefined
      ? { firedThisLongRest: event.cadence.firedThisLongRest }
      : {}),
  };
};

const clearTurnCounters = (character: Draft<Character>): void => {
  for (const key of Object.keys(character.triggerCounters)) {
    const counter = character.triggerCounters[key];
    if (counter !== undefined) counter.firedThisTurn = false;
  }
};

const clearRoundCounters = (character: Draft<Character>): void => {
  for (const key of Object.keys(character.triggerCounters)) {
    const counter = character.triggerCounters[key];
    if (counter !== undefined) counter.firedThisRound = false;
  }
};

const clearShortRestCounters = (character: Draft<Character>): void => {
  for (const key of Object.keys(character.triggerCounters)) {
    const counter = character.triggerCounters[key];
    if (counter !== undefined) counter.firedThisShortRest = false;
  }
};

const clearLongRestCounters = (character: Draft<Character>): void => {
  for (const key of Object.keys(character.triggerCounters)) {
    const counter = character.triggerCounters[key];
    if (counter !== undefined) {
      counter.firedThisTurn = false;
      counter.firedThisRound = false;
      counter.firedThisShortRest = false;
      counter.firedThisLongRest = false;
    }
  }
};

export const clearTurnCountersForCharacter = (
  state: Draft<CampaignState>,
  characterId: string,
): void => {
  const character = state.characters[characterId];
  if (!character) return;
  clearTurnCounters(character);
};

export const clearRoundCountersForCharacters = (
  state: Draft<CampaignState>,
  characterIds: ReadonlyArray<string>,
): void => {
  for (const id of characterIds) {
    const character = state.characters[id];
    if (character !== undefined) clearRoundCounters(character);
  }
};

export const clearShortRestCountersForCharacters = (
  state: Draft<CampaignState>,
  characterIds: ReadonlyArray<string>,
): void => {
  for (const id of characterIds) {
    const character = state.characters[id];
    if (character !== undefined) clearShortRestCounters(character);
  }
};

export const clearLongRestCountersForCharacters = (
  state: Draft<CampaignState>,
  characterIds: ReadonlyArray<string>,
): void => {
  for (const id of characterIds) {
    const character = state.characters[id];
    if (character !== undefined) clearLongRestCounters(character);
  }
};
