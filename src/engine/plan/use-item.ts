import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ItemUsedEvent } from '../../schemas/events/inventory.js';
import type { ConditionAppliedEvent } from '../../schemas/events/combat.js';
import type { ItemChargeConsumedEvent } from '../../schemas/events/charges.js';
import { newAppliedConditionId, newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

export interface UseItemIntent {
  readonly type: 'UseItem';
  readonly characterId: string;
  readonly instanceId: string;
  // Defaults to characterId when omitted: activating the item on
  // yourself (the common case for boots, cloaks, rings). When set to
  // another character, models "use the item on an adjacent ally"
  // (rare; not all items support it, but the planner stays
  // shape-agnostic about RAW range).
  readonly targetId?: string;
  readonly at?: string;
}

/**
 * Slice 240. Activates a magic item: validates the instance, decrements
 * charges (if the definition carries the `charges` shape), walks the
 * item's `onUse` action list emitting the corresponding effect events
 * (ConditionApplied for ApplyCondition variants), then emits an
 * ItemUsed event as a journal marker.
 *
 * Unlike planConsumeItem, the instance persists after activation.
 *
 * Canonical user: Wings of Flying (rare wondrous, attunement; 1/dawn
 * charges; onUse applies the `flying-active` condition). Future
 * users include Boots of Speed, Boots of Levitation, Cloak of the
 * Bat, and any other activate-as-action toggle item.
 *
 * Validation:
 * - Instance exists in state.itemInstances and in the character's
 *   inventory.
 * - Instance's definition is itemKind = 'magic'.
 * - If the definition has `charges`, the instance has at least 1
 *   charge remaining.
 *
 * RAW deviations to be tightened later: no action-economy cost (RAW
 * varies — bonus action for Wings of Flying, action for some others);
 * no attunement gate (the engine has attunement state but consumers
 * can use unattuned items freely through this planner); no range
 * check when targetId !== characterId (engine doesn't model
 * position).
 */
export const planUseItem = (
  state: CampaignState,
  content: ResolvedContent,
  intent: UseItemIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  if (!character.inventory.includes(intent.instanceId)) {
    throw new Error(`Item ${intent.instanceId} not in ${character.name}'s inventory`);
  }
  const instance = state.itemInstances[intent.instanceId];
  if (!instance) throw new Error(`Unknown item instance ${intent.instanceId}`);
  const def = content.items.get(instance.definitionId);
  if (!def) throw new Error(`Unknown item definition ${instance.definitionId}`);
  if (def.itemKind !== 'magic') {
    throw new Error(`Item ${def.id} is not a magic item (itemKind: ${def.itemKind})`);
  }

  const at = intent.at ?? nowIso();
  const targetId = intent.targetId ?? intent.characterId;
  const events: Event[] = [];

  // Charge gate: when the definition carries `charges`, require at
  // least one charge remaining and emit the decrement before the
  // action effects. When the definition has no `charges`, the item
  // is freely activatable.
  if (def.charges !== undefined) {
    const remaining = instance.chargesRemaining ?? 0;
    if (remaining < 1) {
      throw new Error(`Item ${def.id} has no charges remaining`);
    }
    const charge: ItemChargeConsumedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'ItemChargeConsumed',
      itemInstanceId: intent.instanceId as ULID,
      amount: 1,
      byCharacterId: intent.characterId as ULID,
      forEffect: `use:${def.id}`,
    };
    events.push(charge);
  }

  for (const action of def.onUse) {
    if (action.kind === 'ApplyCondition') {
      // Mirror of slice 236's ConsumeAction ApplyCondition: stamp
      // `sourceCharacterId` to the user so the condition can be
      // traced back. No `expiresOnRound` — minute / hour durations
      // are consumer-managed.
      const condApplied: ConditionAppliedEvent = {
        id: newEventId() as ULID,
        at,
        type: 'ConditionApplied',
        targetId: targetId as ULID,
        conditionId: action.conditionId,
        appliedConditionId: newAppliedConditionId(),
        sourceCharacterId: intent.characterId as ULID,
      };
      events.push(condApplied);
    }
  }

  const used: ItemUsedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ItemUsed',
    characterId: intent.characterId as ULID,
    instanceId: intent.instanceId as ULID,
    definitionId: instance.definitionId,
    targetId: targetId as ULID,
  };
  events.push(used);
  return events;
};
