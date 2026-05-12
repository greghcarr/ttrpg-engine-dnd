import type { CampaignState } from '../schemas/runtime/campaign.js';
import type { Event } from '../schemas/events/index.js';
import { emptyCampaignState } from '../schemas/runtime/campaign.js';
import { applyAll } from './apply.js';

export const replay = (events: ReadonlyArray<Event>): CampaignState =>
  applyAll(emptyCampaignState(), events);
