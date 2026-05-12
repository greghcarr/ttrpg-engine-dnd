import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { CharacterResurrectedEvent } from '../../schemas/events/resurrection.js';
import { invariant } from '../../internal/invariants.js';

export const applyCharacterResurrected = (
  state: Draft<CampaignState>,
  event: CharacterResurrectedEvent,
): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  character.hp.current = event.hpAfter;
  character.hp.temp = 0;
  character.deathSaves = { successes: 0, failures: 0, stable: false };
  character.exhaustion = 0;
  if (event.newSpeciesId !== undefined) {
    character.speciesId = event.newSpeciesId;
  }
  if (event.byCharacterId !== undefined) {
    invariant(
      state.characters[event.byCharacterId] !== undefined,
      `Caster ${event.byCharacterId} not found`,
    );
  }
};
