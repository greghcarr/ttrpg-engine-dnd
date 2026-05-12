import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  AttitudeChangedEvent,
  MoraleCheckRolledEvent,
  MoraleBrokenEvent,
} from '../../schemas/events/npc.js';
import { invariant } from '../../internal/invariants.js';

export const applyAttitudeChanged = (
  state: Draft<CampaignState>,
  event: AttitudeChangedEvent,
): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  character.attitude = event.toAttitude;
};

export const applyMoraleCheckRolled = (
  state: Draft<CampaignState>,
  event: MoraleCheckRolledEvent,
): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  if (!event.success && character.morale !== undefined) {
    character.morale.current = Math.max(0, character.morale.current - 1);
  }
};

export const applyMoraleBroken = (
  state: Draft<CampaignState>,
  event: MoraleBrokenEvent,
): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  character.moraleBroken = true;
};
