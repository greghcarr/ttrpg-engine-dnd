import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { RecklessAttackActivatedEvent } from '../../schemas/events/action-economy.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

export interface RecklessAttackIntent {
  readonly type: 'RecklessAttack';
  readonly combatantId: string;
  readonly at?: string;
}

// Barbarian L2 Reckless Attack. Activates a flag on the combatant's
// turnUsage so that `resolveAttack` grants advantage on the actor's
// melee STR attack rolls AND grants advantage to attacks against the
// actor until their next TurnStarted (which clears the flag).
//
// Per RAW 2024: "When you make your first attack on your turn, you can
// decide to Attack recklessly." The planner enforces that the actor is
// the active combatant, hasn't yet swung this turn, and hasn't already
// activated Reckless Attack on this turn.
export const planRecklessAttack = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: RecklessAttackIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.combatantId];
  if (!character) throw new Error(`Unknown character ${intent.combatantId}`);
  const encounterId = state.activeEncounterId;
  if (encounterId === undefined) {
    throw new Error('Reckless Attack requires an active encounter');
  }
  const encounter = state.encounters[encounterId];
  if (!encounter || encounter.status !== 'active') {
    throw new Error('Reckless Attack requires an active encounter');
  }
  const active = encounter.combatants[encounter.activeIndex];
  if (!active || active.combatantId !== intent.combatantId) {
    throw new Error('Reckless Attack can only be used on your own turn');
  }
  if (active.turnUsage.attacksMadeThisTurn > 0) {
    throw new Error('Reckless Attack must be declared before your first attack');
  }
  if (active.turnUsage.recklessAttackActive) {
    throw new Error('Reckless Attack already active this turn');
  }
  const at = intent.at ?? nowIso();
  const evt: RecklessAttackActivatedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'RecklessAttackActivated',
    encounterId,
    combatantId: intent.combatantId,
  };
  return [evt];
};
