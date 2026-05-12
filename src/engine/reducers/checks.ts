import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  AbilityCheckRolledEvent,
  SaveRolledEvent,
} from '../../schemas/events/checks.js';

// Record-only resolution events. The rolled result is consumed by the
// surrounding planner (spell save, contested check, etc.) and any state
// change is emitted as separate notification events.

export const applySaveRolled = (
  _state: Draft<CampaignState>,
  _event: SaveRolledEvent,
): void => {};

export const applyAbilityCheckRolled = (
  _state: Draft<CampaignState>,
  _event: AbilityCheckRolledEvent,
): void => {};
