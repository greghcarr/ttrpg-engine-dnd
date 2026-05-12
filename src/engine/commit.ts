import type { CampaignState } from '../schemas/runtime/campaign.js';
import type { Event } from '../schemas/events/index.js';
import { apply } from './apply.js';

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly state: CampaignState;
  readonly events: ReadonlyArray<Event>;
  readonly cursor: number;
  readonly schemaVersion: number;
}

export const commit = (campaign: Campaign, events: ReadonlyArray<Event>): Campaign => {
  let nextState = campaign.state;
  for (const event of events) {
    nextState = apply(nextState, event);
  }
  const before = campaign.events.slice(0, campaign.cursor);
  const nextEvents = [...before, ...events];
  return {
    ...campaign,
    state: nextState,
    events: nextEvents,
    cursor: nextEvents.length,
  };
};
