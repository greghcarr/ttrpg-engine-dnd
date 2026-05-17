import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { MirrorImageDeflectedEvent } from '../../schemas/events/mirror-image.js';
import { invariant } from '../../internal/invariants.js';

// Slice 124. Decrements the bearer's `mirror-image-active` condition
// level to `duplicatesAfter` when the redirected attack hit the
// duplicate's AC. Deflection misses (duplicateHit === false) leave
// the level untouched. The planner emits a follow-up
// `ConditionRemoved` when the level hits 0 — this reducer doesn't
// auto-remove (one reducer / one event).
export const applyMirrorImageDeflected = (
  state: Draft<CampaignState>,
  event: MirrorImageDeflectedEvent,
): void => {
  if (!event.duplicateHit) return;
  const bearer = state.characters[event.bearerId];
  invariant(bearer !== undefined, `Mirror Image bearer ${event.bearerId} not found`);
  const applied = bearer.appliedConditions.find(
    (c) => c.id === event.appliedConditionId,
  );
  invariant(
    applied !== undefined,
    `Mirror Image AppliedCondition ${event.appliedConditionId} not found on bearer`,
  );
  applied.level = event.duplicatesAfter;
};
