import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  CombatantMovedEvent,
  DashedEvent,
  DisengagedEvent,
} from '../../schemas/events/movement.js';
import { invariant } from '../../internal/invariants.js';

export const applyCombatantMoved = (
  state: Draft<CampaignState>,
  event: CombatantMovedEvent,
): void => {
  const encounter = state.encounters[event.encounterId];
  invariant(encounter !== undefined, `Encounter ${event.encounterId} not found`);
  const combatant = encounter.combatants.find((c) => c.combatantId === event.combatantId);
  invariant(combatant !== undefined, `Combatant ${event.combatantId} not in encounter`);
  combatant.position = { ...event.toPosition };
  combatant.turnUsage.feetMovedThisTurn += event.feetTraveled;
};

export const applyDashed = (state: Draft<CampaignState>, event: DashedEvent): void => {
  const encounter = state.encounters[event.encounterId];
  invariant(encounter !== undefined, `Encounter ${event.encounterId} not found`);
  const combatant = encounter.combatants.find((c) => c.combatantId === event.combatantId);
  invariant(combatant !== undefined, `Combatant ${event.combatantId} not in encounter`);
  invariant(!combatant.turnUsage.dashed, `${event.combatantId} already dashed this turn`);
  combatant.turnUsage.dashed = true;
};

export const applyDisengaged = (
  state: Draft<CampaignState>,
  event: DisengagedEvent,
): void => {
  const encounter = state.encounters[event.encounterId];
  invariant(encounter !== undefined, `Encounter ${event.encounterId} not found`);
  const combatant = encounter.combatants.find((c) => c.combatantId === event.combatantId);
  invariant(combatant !== undefined, `Combatant ${event.combatantId} not in encounter`);
  invariant(!combatant.turnUsage.disengaged, `${event.combatantId} already disengaged this turn`);
  combatant.turnUsage.disengaged = true;
};
