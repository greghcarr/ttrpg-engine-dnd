import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  TravelLegCompletedEvent,
  NavigationCheckRolledEvent,
  ForagedForEvent,
} from '../../schemas/events/travel.js';
import { invariant } from '../../internal/invariants.js';

export const applyTravelLegCompleted = (
  state: Draft<CampaignState>,
  event: TravelLegCompletedEvent,
): void => {
  invariant(state.parties[event.partyId] !== undefined, `Party ${event.partyId} not found`);
  if (event.fromLocationId !== undefined) {
    invariant(
      state.locations[event.fromLocationId] !== undefined,
      `From-location ${event.fromLocationId} not found`,
    );
  }
  if (event.toLocationId !== undefined) {
    invariant(
      state.locations[event.toLocationId] !== undefined,
      `To-location ${event.toLocationId} not found`,
    );
  }
  state.travelLog.push({
    partyId: event.partyId,
    pace: event.pace,
    hours: event.hours,
    miles: event.miles,
    fromLocationId: event.fromLocationId,
    toLocationId: event.toLocationId,
    notes: event.notes,
    atIso: event.at,
  });
};

export const applyNavigationCheckRolled = (
  state: Draft<CampaignState>,
  event: NavigationCheckRolledEvent,
): void => {
  invariant(state.parties[event.partyId] !== undefined, `Party ${event.partyId} not found`);
  invariant(
    state.characters[event.navigatorId] !== undefined,
    `Navigator ${event.navigatorId} not found`,
  );
};

export const applyForagedFor = (state: Draft<CampaignState>, event: ForagedForEvent): void => {
  invariant(state.parties[event.partyId] !== undefined, `Party ${event.partyId} not found`);
  invariant(
    state.characters[event.foragerId] !== undefined,
    `Forager ${event.foragerId} not found`,
  );
};
