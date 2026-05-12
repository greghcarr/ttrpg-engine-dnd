import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  ItemChargeConsumedEvent,
  ItemRechargedEvent,
  SentientItemConflictEvent,
} from '../../schemas/events/charges.js';
import { invariant } from '../../internal/invariants.js';

export const applyItemChargeConsumed = (
  state: Draft<CampaignState>,
  event: ItemChargeConsumedEvent,
): void => {
  const item = state.itemInstances[event.itemInstanceId];
  invariant(item !== undefined, `Item ${event.itemInstanceId} not found`);
  const current = item.chargesRemaining ?? 0;
  invariant(current >= event.amount, `Item ${event.itemInstanceId} has only ${current} charges`);
  item.chargesRemaining = current - event.amount;
  if (event.byCharacterId !== undefined) {
    invariant(
      state.characters[event.byCharacterId] !== undefined,
      `Wielder ${event.byCharacterId} not found`,
    );
  }
};

export const applyItemRecharged = (
  state: Draft<CampaignState>,
  event: ItemRechargedEvent,
): void => {
  const item = state.itemInstances[event.itemInstanceId];
  invariant(item !== undefined, `Item ${event.itemInstanceId} not found`);
  const current = item.chargesRemaining ?? 0;
  const cap = item.maxCharges ?? current + event.amount;
  item.chargesRemaining = Math.min(cap, current + event.amount);
};

export const applySentientItemConflict = (
  state: Draft<CampaignState>,
  event: SentientItemConflictEvent,
): void => {
  const item = state.itemInstances[event.itemInstanceId];
  invariant(item !== undefined, `Item ${event.itemInstanceId} not found`);
  invariant(item.sentient !== undefined, `Item ${event.itemInstanceId} is not sentient`);
  invariant(
    state.characters[event.wielderId] !== undefined,
    `Wielder ${event.wielderId} not found`,
  );
};
