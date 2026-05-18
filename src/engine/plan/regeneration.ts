import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { HealedEvent } from '../../schemas/events/combat.js';
import { buildEffectStack } from '../../derive/effect-stack.js';
import { newEventId } from '../../ids.js';
import type { ULID } from '../ids-utils.js';

/**
 * Slice 232. Helper called from planAdvanceTurn / planBeginFirstTurn
 * at the start of an actor's turn. If the active combatant carries a
 * `Regeneration` trait via the effect stack, and none of the damage
 * types they took since their last turn-start appear in any of the
 * trait's `suppressedBy` lists, emit a Healed event for the trait's
 * `perTurn` HP amount. Multiple Regeneration entries on the same
 * bearer each emit their own Healed (rare in RAW but supported).
 *
 * The `damageTypesTakenThisTurn` array is cleared by the TurnStarted
 * reducer regardless of suppression outcome; this planner only reads
 * it. The TurnStarted event is emitted by the caller before this
 * helper's events in the chain, so the reducer-side clear happens
 * after the read-time check (apply() is event-by-event).
 *
 * Canonical users: Troll (15 HP/turn, suppressed by Acid/Fire),
 * Troll Limb (5 HP/turn, same suppression).
 */
export const planRegenerationAtTurnStart = (
  state: CampaignState,
  content: ResolvedContent,
  combatantId: string,
  at: string,
): ReadonlyArray<HealedEvent> => {
  const character = state.characters[combatantId];
  if (character === undefined) return [];
  const effects = buildEffectStack({
    character,
    content,
    itemInstances: state.itemInstances,
    pendingChoices: state.pendingChoices,
  });
  const regenerations = effects.regenerations();
  if (regenerations.length === 0) return [];
  const events: HealedEvent[] = [];
  const damageTaken = new Set(character.damageTypesTakenThisTurn);
  for (const regen of regenerations) {
    const suppressed = regen.suppressedBy.some((d) => damageTaken.has(d));
    if (suppressed) continue;
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'Healed',
      targetId: combatantId as ULID,
      amount: regen.perTurn,
      source: 'regeneration',
    });
  }
  return events;
};
