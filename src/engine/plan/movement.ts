import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { Position } from '../../schemas/runtime/encounter.js';
import type { Combatant } from '../../schemas/runtime/encounter.js';
import type {
  CombatantMovedEvent,
  DashedEvent,
  DisengagedEvent,
} from '../../schemas/events/movement.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

export interface MoveIntent {
  readonly type: 'Move';
  readonly combatantId: string;
  readonly to: Position;
  readonly at?: string;
}

export interface DashIntent {
  readonly type: 'Dash';
  readonly combatantId: string;
  readonly at?: string;
}

export interface DisengageIntent {
  readonly type: 'Disengage';
  readonly combatantId: string;
  readonly at?: string;
}

export const chebyshevDistance = (a: Position, b: Position): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const findCombatant = (
  state: CampaignState,
  combatantId: string,
): { encounterId: string; combatant: Combatant; isActive: boolean } => {
  const encounterId = state.activeEncounterId;
  if (encounterId === undefined) {
    throw new Error('Movement requires an active encounter');
  }
  const encounter = state.encounters[encounterId];
  if (!encounter || encounter.status !== 'active') {
    throw new Error('Movement requires an active encounter');
  }
  const combatant = encounter.combatants.find((c) => c.combatantId === combatantId);
  if (!combatant) {
    throw new Error(`Combatant ${combatantId} not in active encounter`);
  }
  const isActive = encounter.combatants[encounter.activeIndex]?.combatantId === combatantId;
  return { encounterId, combatant, isActive };
};

const characterWalkSpeed = (state: CampaignState, characterId: string): number => {
  const character = state.characters[characterId];
  return character?.speedFeet ?? 30;
};

export const planMove = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: MoveIntent,
): ReadonlyArray<Event> => {
  const { encounterId, combatant, isActive } = findCombatant(state, intent.combatantId);
  if (!isActive) {
    throw new Error('Only the active combatant may move on their turn');
  }
  if (combatant.position === undefined) {
    throw new Error('Combatant has no position set');
  }
  const distance = chebyshevDistance(combatant.position, intent.to);
  const baseSpeed = characterWalkSpeed(state, intent.combatantId);
  const maxThisTurn = combatant.turnUsage.dashed ? baseSpeed * 2 : baseSpeed;
  const remaining = maxThisTurn - combatant.turnUsage.feetMovedThisTurn;
  if (distance > remaining) {
    throw new Error(
      `Move of ${distance}ft exceeds remaining movement (${remaining}ft of ${maxThisTurn}ft)`,
    );
  }

  const at = intent.at ?? nowIso();
  const moved: CombatantMovedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'CombatantMoved',
    encounterId,
    combatantId: intent.combatantId,
    fromPosition: { ...combatant.position },
    toPosition: { ...intent.to },
    feetTraveled: distance,
  };
  return [moved];
};

export const planDash = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: DashIntent,
): ReadonlyArray<Event> => {
  const { encounterId, combatant, isActive } = findCombatant(state, intent.combatantId);
  if (!isActive) {
    throw new Error('Only the active combatant may Dash on their turn');
  }
  if (combatant.turnUsage.actionUsed) {
    throw new Error('Action already used this turn');
  }
  if (combatant.turnUsage.dashed) {
    throw new Error('Already dashed this turn');
  }
  const at = intent.at ?? nowIso();
  const actionConsumed: ActionEconomyConsumedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ActionEconomyConsumed',
    encounterId,
    combatantId: intent.combatantId,
    kind: 'action',
  };
  const dashed: DashedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'Dashed',
    encounterId,
    combatantId: intent.combatantId,
  };
  return [actionConsumed, dashed];
};

export const planDisengage = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: DisengageIntent,
): ReadonlyArray<Event> => {
  const { encounterId, combatant, isActive } = findCombatant(state, intent.combatantId);
  if (!isActive) {
    throw new Error('Only the active combatant may Disengage on their turn');
  }
  if (combatant.turnUsage.actionUsed) {
    throw new Error('Action already used this turn');
  }
  if (combatant.turnUsage.disengaged) {
    throw new Error('Already disengaged this turn');
  }
  const at = intent.at ?? nowIso();
  const actionConsumed: ActionEconomyConsumedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ActionEconomyConsumed',
    encounterId,
    combatantId: intent.combatantId,
    kind: 'action',
  };
  const disengaged: DisengagedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'Disengaged',
    encounterId,
    combatantId: intent.combatantId,
  };
  return [actionConsumed, disengaged];
};
