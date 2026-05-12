import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  PartyCreatedEvent,
  PartyMembersChangedEvent,
  CurrencyAcquiredEvent,
  CurrencySpentEvent,
  ItemDepositedToPartyEvent,
  ItemWithdrawnFromPartyEvent,
} from '../../schemas/events/party.js';
import { invariant } from '../../internal/invariants.js';
import { addCurrency, subtractCurrency, emptyCurrency } from '../../schemas/runtime/currency.js';

export const applyPartyCreated = (
  state: Draft<CampaignState>,
  event: PartyCreatedEvent,
): void => {
  invariant(state.parties[event.partyId] === undefined, `Party ${event.partyId} already exists`);
  for (const memberId of event.memberIds) {
    invariant(state.characters[memberId] !== undefined, `Member ${memberId} not found`);
  }
  state.parties[event.partyId] = {
    id: event.partyId,
    name: event.name,
    memberIds: [...event.memberIds],
    sharedInventory: [],
    purse: emptyCurrency(),
  };
};

export const applyPartyMembersChanged = (
  state: Draft<CampaignState>,
  event: PartyMembersChangedEvent,
): void => {
  const party = state.parties[event.partyId];
  invariant(party !== undefined, `Party ${event.partyId} not found`);
  for (const addedId of event.added) {
    invariant(state.characters[addedId] !== undefined, `Member ${addedId} not found`);
    if (!party.memberIds.includes(addedId)) party.memberIds.push(addedId);
  }
  if (event.removed.length > 0) {
    party.memberIds = party.memberIds.filter((id) => !event.removed.includes(id));
  }
};

export const applyCurrencyAcquired = (
  state: Draft<CampaignState>,
  event: CurrencyAcquiredEvent,
): void => {
  const party = state.parties[event.partyId];
  invariant(party !== undefined, `Party ${event.partyId} not found`);
  party.purse = addCurrency(party.purse, event.amounts);
};

export const applyCurrencySpent = (
  state: Draft<CampaignState>,
  event: CurrencySpentEvent,
): void => {
  const party = state.parties[event.partyId];
  invariant(party !== undefined, `Party ${event.partyId} not found`);
  party.purse = subtractCurrency(party.purse, event.amounts);
};

export const applyItemDepositedToParty = (
  state: Draft<CampaignState>,
  event: ItemDepositedToPartyEvent,
): void => {
  const party = state.parties[event.partyId];
  invariant(party !== undefined, `Party ${event.partyId} not found`);
  invariant(
    state.itemInstances[event.itemInstanceId] !== undefined,
    `Item instance ${event.itemInstanceId} not found`,
  );
  if (event.sourceCharacterId !== undefined) {
    const source = state.characters[event.sourceCharacterId];
    invariant(source !== undefined, `Character ${event.sourceCharacterId} not found`);
    source.inventory = source.inventory.filter((id) => id !== event.itemInstanceId);
  }
  if (!party.sharedInventory.includes(event.itemInstanceId)) {
    party.sharedInventory.push(event.itemInstanceId);
  }
};

export const applyItemWithdrawnFromParty = (
  state: Draft<CampaignState>,
  event: ItemWithdrawnFromPartyEvent,
): void => {
  const party = state.parties[event.partyId];
  invariant(party !== undefined, `Party ${event.partyId} not found`);
  invariant(
    party.sharedInventory.includes(event.itemInstanceId),
    `Item ${event.itemInstanceId} not in party ${event.partyId} inventory`,
  );
  party.sharedInventory = party.sharedInventory.filter((id) => id !== event.itemInstanceId);
  if (event.recipientCharacterId !== undefined) {
    const recipient = state.characters[event.recipientCharacterId];
    invariant(recipient !== undefined, `Character ${event.recipientCharacterId} not found`);
    if (!recipient.inventory.includes(event.itemInstanceId)) {
      recipient.inventory.push(event.itemInstanceId);
    }
  }
};
