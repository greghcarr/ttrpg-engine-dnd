import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  ItemAcquiredEvent,
  ItemAttunedEvent,
  ItemEquippedEvent,
  ItemUnattunedEvent,
  ItemUnequippedEvent,
} from '../../schemas/events/inventory.js';
import { invariant } from '../../internal/invariants.js';

const MAX_ATTUNED_ITEMS = 3;

export const applyItemAcquired = (
  state: Draft<CampaignState>,
  event: ItemAcquiredEvent,
): void => {
  invariant(
    state.itemInstances[event.instance.id] === undefined,
    `Item instance ${event.instance.id} already exists`,
  );
  state.itemInstances[event.instance.id] = event.instance;
};

export const applyItemEquipped = (
  state: Draft<CampaignState>,
  event: ItemEquippedEvent,
): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  const instance = state.itemInstances[event.instanceId];
  invariant(instance !== undefined, `Item instance ${event.instanceId} not found`);
  character.equipped[event.slot] = event.instanceId;
  instance.equippedBy = event.characterId;
};

export const applyItemUnequipped = (
  state: Draft<CampaignState>,
  event: ItemUnequippedEvent,
): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  const priorInstanceId = character.equipped[event.slot];
  if (priorInstanceId !== undefined) {
    const instance = state.itemInstances[priorInstanceId];
    if (instance !== undefined) instance.equippedBy = undefined;
  }
  character.equipped[event.slot] = undefined;
};

export const applyItemAttuned = (
  state: Draft<CampaignState>,
  event: ItemAttunedEvent,
): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  const instance = state.itemInstances[event.instanceId];
  invariant(instance !== undefined, `Item instance ${event.instanceId} not found`);
  invariant(!instance.attuned, `Item ${event.instanceId} already attuned`);
  invariant(
    character.equipped.attuned.length < MAX_ATTUNED_ITEMS,
    `Character already has the maximum of ${MAX_ATTUNED_ITEMS} attuned items`,
  );
  instance.attuned = true;
  instance.attunedTo = event.characterId;
  character.equipped.attuned.push(event.instanceId);
};

export const applyItemUnattuned = (
  state: Draft<CampaignState>,
  event: ItemUnattunedEvent,
): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  const instance = state.itemInstances[event.instanceId];
  invariant(instance !== undefined, `Item instance ${event.instanceId} not found`);
  invariant(instance.attuned, `Item ${event.instanceId} not attuned`);
  instance.attuned = false;
  instance.attunedTo = undefined;
  character.equipped.attuned = character.equipped.attuned.filter(
    (id) => id !== event.instanceId,
  );
};
