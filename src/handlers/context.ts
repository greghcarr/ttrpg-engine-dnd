import type { CampaignState } from '../schemas/runtime/campaign.js';
import type { RNG } from '../rng/index.js';

export interface HandlerContext {
  readonly state: CampaignState;
  readonly rng: RNG;
}
