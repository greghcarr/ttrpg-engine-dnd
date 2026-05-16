import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  TrapArmedEvent,
  TrapTriggeredEvent,
  TrapExpiredEvent,
} from '../../schemas/events/traps.js';
import { invariant } from '../../internal/invariants.js';

export const applyTrapArmed = (
  state: Draft<CampaignState>,
  event: TrapArmedEvent,
): void => {
  invariant(
    state.traps[event.trapId] === undefined,
    `Trap ${event.trapId} already exists`,
  );
  state.traps[event.trapId] = {
    id: event.trapId,
    label: event.label,
    sourceCharacterId: event.sourceCharacterId,
    sourceSpellId: event.sourceSpellId,
    payload: event.payload,
    chargesRemaining: event.chargesRemaining,
  };
};

export const applyTrapTriggered = (
  state: Draft<CampaignState>,
  event: TrapTriggeredEvent,
): void => {
  const trap = state.traps[event.trapId];
  invariant(trap !== undefined, `Trap ${event.trapId} not found`);
  invariant(
    trap.chargesRemaining > 0,
    `Trap ${event.trapId} has no charges remaining`,
  );
  trap.chargesRemaining -= 1;
};

export const applyTrapExpired = (
  state: Draft<CampaignState>,
  event: TrapExpiredEvent,
): void => {
  // Tolerant: silently no-op on missing trap so a duplicate expiry
  // (e.g. dispelled AND charges-exhausted on the same tick) doesn't
  // throw.
  delete state.traps[event.trapId];
};
