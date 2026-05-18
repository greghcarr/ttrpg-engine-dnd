import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ConditionRemovedEvent } from '../../schemas/events/combat.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import { invariant } from '../../internal/invariants.js';
import { buildEffectStack } from '../../derive/effect-stack.js';
import type { ULID } from '../ids-utils.js';

// RAW 2024 PHB Monk L10 Self-Restoration: "Through sheer force of
// will, you can remove one of the following conditions from yourself
// at the end of each of your turns: Charmed, Frightened, or Poisoned."
// The set is fixed; the planner throws on anything outside it.
const SELF_RESTORATION_REMOVABLE: ReadonlySet<string> = new Set([
  'charmed',
  'frightened',
  'poisoned',
]);

export interface SelfRestorationIntent {
  readonly type: 'SelfRestoration';
  readonly characterId: string;
  // One of: charmed, frightened, poisoned. Other condition ids throw.
  readonly conditionId: string;
  readonly at?: string;
}

/**
 * Monk L10 Self-Restoration. The consumer calls this planner at the
 * end of the bearer's turn (RAW timing is consumer-side: the engine
 * doesn't schedule auto-restorations). The planner validates that
 * the bearer has the `GrantSelfRestoration` marker, that the
 * requested condition is one of the three eligible ones, and that
 * the bearer currently carries it; then emits a single
 * `ConditionRemoved`. No resource cost, no action cost, no save.
 *
 * The RAW "forgoing food and drink doesn't give you levels of
 * Exhaustion" arm of the same feature is consumer-side narrative
 * state and is not modeled in the engine.
 */
export const planSelfRestoration = (
  state: CampaignState,
  content: ResolvedContent,
  intent: SelfRestorationIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.characterId];
  invariant(character !== undefined, `Character ${intent.characterId} not found`);

  if (!SELF_RESTORATION_REMOVABLE.has(intent.conditionId)) {
    throw new Error(
      `Self-Restoration can only remove Charmed, Frightened, or Poisoned (got '${intent.conditionId}')`,
    );
  }

  const effects = buildEffectStack({
    character,
    content,
    itemInstances: state.itemInstances,
    pendingChoices: state.pendingChoices,
  });
  if (!effects.hasSelfRestoration()) {
    throw new Error(`${character.name} does not have Self-Restoration`);
  }

  const hasCondition = character.appliedConditions.some((c) => c.conditionId === intent.conditionId);
  if (!hasCondition) {
    throw new Error(`${character.name} is not currently affected by '${intent.conditionId}'`);
  }

  const at = intent.at ?? nowIso();
  const removed: ConditionRemovedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ConditionRemoved',
    targetId: intent.characterId as ULID,
    conditionId: intent.conditionId,
  };
  return [removed];
};
