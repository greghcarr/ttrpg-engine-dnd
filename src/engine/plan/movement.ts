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
import type { SpellCastDeclaredEvent, SpellSlotConsumedEvent } from '../../schemas/events/spellcasting.js';
import type { ConditionAppliedEvent } from '../../schemas/events/combat.js';
import { newAppliedConditionId } from '../../ids.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import { invariant } from '../../internal/invariants.js';
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
  // RAW 2024 PHB "Moving Around Other Creatures": you can pass through
  // a nonhostile creature's space (treated as difficult terrain for
  // same-size creatures), but you cannot willingly end a move in
  // another creature's space, friend or foe. The engine only models
  // the destination of a move, not the path, so this check rejects
  // moves that *end* on an occupied square. Pass-through is permitted
  // implicitly since intermediate squares aren't simulated.
  const blocker = state.encounters[encounterId]?.combatants.find(
    (c) =>
      c.combatantId !== intent.combatantId &&
      c.position !== undefined &&
      c.position.x === intent.to.x &&
      c.position.y === intent.to.y,
  );
  if (blocker !== undefined) {
    const occupier = state.characters[blocker.combatantId];
    const name = occupier?.name ?? blocker.combatantId;
    throw new Error(
      `Destination (${intent.to.x},${intent.to.y}) is occupied by ${name}; you can't end a move in another creature's space`,
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

const MISTY_STEP_RANGE_FEET = 30;
const MISTY_STEP_MIN_SLOT_LEVEL = 2;

export interface MistyStepIntent {
  readonly type: 'MistyStep';
  readonly casterId: string;
  readonly to: Position;
  readonly slotLevel?: number;
  readonly at?: string;
}

/**
 * RAW 2024 Misty Step: bonus action, 2nd-level conjuration, teleport up
 * to 30 feet to an unoccupied space you can see. Range is enforced by
 * Chebyshev distance against the caster's current position; obstacle /
 * occupancy checks are the consumer's responsibility (the engine doesn't
 * model line-of-sight beyond the locations grid).
 *
 * Emits SpellCastDeclared, SpellSlotConsumed(2+), ActionEconomyConsumed
 * (bonus), and CombatantMoved.
 */
export const planMistyStep = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: MistyStepIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.casterId];
  invariant(caster !== undefined, `Caster ${intent.casterId} not found`);
  const slotLevel = intent.slotLevel ?? MISTY_STEP_MIN_SLOT_LEVEL;
  invariant(slotLevel >= MISTY_STEP_MIN_SLOT_LEVEL, 'Misty Step is a 2nd-level spell');
  const knowsSpell =
    caster.knownSpells.includes('misty-step') || caster.preparedSpells.includes('misty-step');
  invariant(knowsSpell, `Caster ${intent.casterId} does not know Misty Step`);

  const { encounterId, combatant, isActive } = findCombatant(state, intent.casterId);
  if (!isActive) {
    throw new Error('Only the active combatant may cast Misty Step on their turn');
  }
  if (combatant.position === undefined) {
    throw new Error('Combatant has no position set');
  }
  if (combatant.turnUsage.bonusActionUsed) {
    throw new Error('Bonus action already used this turn');
  }
  const distance = chebyshevDistance(combatant.position, intent.to);
  if (distance > MISTY_STEP_RANGE_FEET) {
    throw new Error(`Misty Step destination is ${distance}ft away (max 30ft)`);
  }

  const at = intent.at ?? nowIso();
  const declared: SpellCastDeclaredEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SpellCastDeclared',
    characterId: intent.casterId,
    spellId: 'misty-step',
    slotLevel,
    slotSource: 'standard',
    targetIds: [intent.casterId],
    castAsRitual: false,
  };
  const slotConsumed: SpellSlotConsumedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SpellSlotConsumed',
    characterId: intent.casterId,
    slotLevel,
  };
  const bonusConsumed: ActionEconomyConsumedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ActionEconomyConsumed',
    encounterId,
    combatantId: intent.casterId,
    kind: 'bonusAction',
  };
  const moved: CombatantMovedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'CombatantMoved',
    encounterId,
    combatantId: intent.casterId,
    fromPosition: { ...combatant.position },
    toPosition: { ...intent.to },
    // RAW: teleportation doesn't consume the caster's normal movement.
    feetTraveled: 0,
  };
  return [declared, slotConsumed, bonusConsumed, moved];
};

export interface DodgeIntent {
  readonly type: 'Dodge';
  readonly combatantId: string;
  readonly at?: string;
}

/**
 * RAW 2024 Dodge action: until the start of your next turn, attack
 * rolls against you have disadvantage (if you can see the attacker)
 * and you have advantage on Dexterity saving throws. Lost if you're
 * incapacitated or your speed drops to 0.
 *
 * Wires through as: ActionEconomyConsumed('action') + ConditionApplied
 * ('dodged'). The `dodged` condition carries
 * `ImposeDisadvantageOnAttackers` and `SetAdvantage` (on DEX saves);
 * `planAttack` consults the target's effect stack and lowers its own
 * roll to disadvantage. The condition is cleared at the start of the
 * dodger's next turn — the engine doesn't auto-clear, so the consumer
 * emits `ConditionRemoved` at the appropriate turn boundary.
 */
export const planDodge = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: DodgeIntent,
): ReadonlyArray<Event> => {
  const { encounterId, combatant, isActive } = findCombatant(state, intent.combatantId);
  if (!isActive) {
    throw new Error('Only the active combatant may Dodge on their turn');
  }
  if (combatant.turnUsage.actionUsed) {
    throw new Error('Action already used this turn');
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
  const conditionApplied: ConditionAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ConditionApplied',
    targetId: intent.combatantId,
    conditionId: 'dodged',
    appliedConditionId: newAppliedConditionId(),
  };
  return [actionConsumed, conditionApplied];
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
