import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ItemAcquiredEvent } from '../../schemas/events/inventory.js';
import { invariant } from '../../internal/invariants.js';

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
