import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { Character } from '../../schemas/runtime/character.js';
import type {
  HitDieSpentEvent,
  ResourceRestoredEvent,
  ResourceSpentEvent,
} from '../../schemas/events/resources.js';
import { invariant } from '../../internal/invariants.js';

const requireCharacter = (state: Draft<CampaignState>, id: string): Draft<Character> => {
  const c = state.characters[id];
  invariant(c !== undefined, `Character ${id} not found`);
  return c;
};

export const applyResourceSpent = (
  state: Draft<CampaignState>,
  event: ResourceSpentEvent,
): void => {
  const character = requireCharacter(state, event.characterId);
  const resource = character.resources.find((r) => r.resourceId === event.resourceId);
  invariant(resource !== undefined, `Resource ${event.resourceId} not on character`);
  invariant(
    resource.current >= event.amount,
    `Resource ${event.resourceId} insufficient: have ${resource.current}, spend ${event.amount}`,
  );
  resource.current -= event.amount;
};

export const applyResourceRestored = (
  state: Draft<CampaignState>,
  event: ResourceRestoredEvent,
): void => {
  const character = requireCharacter(state, event.characterId);
  const resource = character.resources.find((r) => r.resourceId === event.resourceId);
  invariant(resource !== undefined, `Resource ${event.resourceId} not on character`);
  const restored = event.amount === 'all' ? resource.max : event.amount;
  resource.current = Math.min(resource.current + restored, resource.max);
};

export const applyHitDieSpent = (
  state: Draft<CampaignState>,
  event: HitDieSpentEvent,
): void => {
  const character = requireCharacter(state, event.characterId);
  const enrollment = character.classes.find((c) => c.hitDiceRemaining > 0);
  invariant(enrollment !== undefined, `No hit dice remaining for ${event.characterId}`);
  enrollment.hitDiceRemaining -= 1;
  if (character.hp.current > 0) {
    character.hp.current = Math.min(character.hp.current + event.healed, character.hp.max);
  }
};
