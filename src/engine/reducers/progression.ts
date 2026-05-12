import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { CharacterCreatedEvent } from '../../schemas/events/progression.js';
import { invariant } from '../../internal/invariants.js';

export const applyCharacterCreated = (
  state: Draft<CampaignState>,
  event: CharacterCreatedEvent,
): void => {
  invariant(
    state.characters[event.snapshot.id] === undefined,
    `Character ${event.snapshot.id} already exists`,
  );
  state.characters[event.snapshot.id] = event.snapshot;
};
