import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { Character } from '../../schemas/runtime/character.js';
import type { TriggerFiredEvent } from '../../schemas/events/triggers.js';
import { invariant } from '../../internal/invariants.js';

type CadenceField =
  | 'firedThisTurn'
  | 'firedThisRound'
  | 'firedThisShortRest'
  | 'firedThisLongRest';

const ALL_CADENCE_FIELDS: ReadonlyArray<CadenceField> = [
  'firedThisTurn',
  'firedThisRound',
  'firedThisShortRest',
  'firedThisLongRest',
];

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
  const merged: Character['triggerCounters'][string] = { ...prior };
  for (const field of ALL_CADENCE_FIELDS) {
    const incoming = event.cadence[field];
    if (incoming !== undefined) merged[field] = incoming;
  }
  character.triggerCounters[event.triggerId] = merged;
};

const clearCadenceFields = (
  character: Draft<Character>,
  fields: ReadonlyArray<CadenceField>,
): void => {
  for (const triggerId of Object.keys(character.triggerCounters)) {
    const counter = character.triggerCounters[triggerId];
    if (counter === undefined) continue;
    for (const field of fields) {
      counter[field] = false;
    }
  }
};

const clearForParticipants = (
  state: Draft<CampaignState>,
  characterIds: ReadonlyArray<string>,
  fields: ReadonlyArray<CadenceField>,
): void => {
  for (const id of characterIds) {
    const character = state.characters[id];
    if (character !== undefined) clearCadenceFields(character, fields);
  }
};

export const clearTurnCountersForCharacter = (
  state: Draft<CampaignState>,
  characterId: string,
): void => {
  const character = state.characters[characterId];
  if (!character) return;
  clearCadenceFields(character, ['firedThisTurn']);
};

export const clearRoundCountersForCharacters = (
  state: Draft<CampaignState>,
  characterIds: ReadonlyArray<string>,
): void => clearForParticipants(state, characterIds, ['firedThisRound']);

export const clearShortRestCountersForCharacters = (
  state: Draft<CampaignState>,
  characterIds: ReadonlyArray<string>,
): void => clearForParticipants(state, characterIds, ['firedThisShortRest']);

export const clearLongRestCountersForCharacters = (
  state: Draft<CampaignState>,
  characterIds: ReadonlyArray<string>,
): void => clearForParticipants(state, characterIds, ALL_CADENCE_FIELDS);
