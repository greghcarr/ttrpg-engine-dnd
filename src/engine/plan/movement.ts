import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { Position } from '../../schemas/runtime/encounter.js';
import type { Combatant } from '../../schemas/runtime/encounter.js';
import type {
  CombatantMovedEvent,
  DashedEvent,
  DisengagedEvent,
  OpportunityAvailableEvent,
} from '../../schemas/events/movement.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';
import type { SpellCastDeclaredEvent, SpellSlotConsumedEvent } from '../../schemas/events/spellcasting.js';
import type { ConditionAppliedEvent } from '../../schemas/events/combat.js';
import { newAppliedConditionId } from '../../ids.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import { invariant } from '../../internal/invariants.js';
import type { ULID } from '../ids-utils.js';
import { assertActorCanAct, getEffectiveSpeed, findActorBlockingCondition } from './_actor-state.js';

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
  if (!character) return 30;
  return getEffectiveSpeed(character);
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
  const character = state.characters[intent.combatantId];
  if (character) assertActorCanAct(character, 'Move');
  if (combatant.position === undefined) {
    throw new Error('Combatant has no position set');
  }
  const distance = chebyshevDistance(combatant.position, intent.to);
  const baseSpeed = characterWalkSpeed(state, intent.combatantId);
  if (baseSpeed === 0) {
    throw new Error(
      `${character?.name ?? intent.combatantId} cannot move (speed reduced to 0 by Restrained / Grappled)`,
    );
  }
  const maxThisTurn = combatant.turnUsage.dashed ? baseSpeed * 2 : baseSpeed;
  const remaining = maxThisTurn - combatant.turnUsage.feetMovedThisTurn;
  // RAW PHB ch.1 "Prone → Standing Up": "Standing up takes more
  // effort; doing so costs an amount of movement equal to half your
  // speed." The engine treats a Move while Prone as an implicit
  // stand-up-then-walk: half-speed surcharge added to the move's cost,
  // ConditionRemoved(prone) emitted before CombatantMoved so the
  // condition is gone for any downstream geometry checks.
  const isProne = character?.appliedConditions.some((c) => c.conditionId === 'prone') ?? false;
  const standUpCost = isProne ? Math.floor(baseSpeed / 2) : 0;
  const totalCost = distance + standUpCost;
  if (totalCost > remaining) {
    const detail = isProne
      ? `${distance}ft move + ${standUpCost}ft stand-up`
      : `${distance}ft`;
    throw new Error(
      `Move (${detail}) exceeds remaining movement (${remaining}ft of ${maxThisTurn}ft)`,
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
  const events: Event[] = [];
  if (isProne) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'ConditionRemoved',
      targetId: intent.combatantId,
      conditionId: 'prone',
    });
  }
  const moved: CombatantMovedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'CombatantMoved',
    encounterId,
    combatantId: intent.combatantId,
    fromPosition: { ...combatant.position },
    toPosition: { ...intent.to },
    // Charge the stand-up overhead against the move's feetTraveled so
    // the CombatantMoved reducer drains feetMovedThisTurn by the full
    // RAW cost. The actual travel distance is `distance`; the prone
    // stand-up surcharge bumps it up to the total movement spent.
    feetTraveled: totalCost,
  };
  events.push(moved);
  // RAW 2024 PHB ch.1 "Opportunity Attack": moving out of a creature's
  // Reach provokes an opportunity attack from that creature. The
  // engine emits one OpportunityAvailable per eligible reactor so the
  // consumer can decide (per reactor) whether to dispatch
  // engine.plan.opportunityAttack. Disengage suppresses these for the
  // rest of the turn.
  if (!combatant.turnUsage.disengaged) {
    const fromPos = combatant.position;
    const toPos = intent.to;
    const MELEE_REACH = 5;
    const enc = state.encounters[encounterId];
    if (enc) {
      for (const other of enc.combatants) {
        if (other.combatantId === intent.combatantId) continue;
        if (!other.position) continue;
        const wasInReach =
          Math.max(Math.abs(other.position.x - fromPos.x), Math.abs(other.position.y - fromPos.y)) <=
          MELEE_REACH;
        const stillInReach =
          Math.max(Math.abs(other.position.x - toPos.x), Math.abs(other.position.y - toPos.y)) <=
          MELEE_REACH;
        if (!wasInReach || stillInReach) continue;
        const reactorChar = state.characters[other.combatantId];
        // Unconscious / Incapacitated / Stunned / Paralyzed / Petrified
        // creatures can't take reactions.
        if (!reactorChar || findActorBlockingCondition(reactorChar) !== undefined) continue;
        // Reaction already spent this round → no opportunity.
        if (other.turnUsage.reactionUsedThisRound) continue;
        const oa: OpportunityAvailableEvent = {
          id: newEventId() as ULID,
          at,
          type: 'OpportunityAvailable',
          encounterId,
          moverId: intent.combatantId,
          reactorId: other.combatantId,
          reactorPosition: { ...other.position },
          fromPosition: { ...fromPos },
          toPosition: { ...toPos },
        };
        events.push(oa);
      }
    }
  }
  return events;
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
  const dasher = state.characters[intent.combatantId];
  if (dasher) assertActorCanAct(dasher, 'Dash');
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
  assertActorCanAct(caster, 'cast Misty Step');
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
  // RAW spell text: "teleport up to 30 feet to an unoccupied space."
  // Reject if any other combatant occupies the destination.
  const blocker = state.encounters[encounterId]?.combatants.find(
    (c) =>
      c.combatantId !== intent.casterId &&
      c.position !== undefined &&
      c.position.x === intent.to.x &&
      c.position.y === intent.to.y,
  );
  if (blocker !== undefined) {
    const occupier = state.characters[blocker.combatantId];
    const name = occupier?.name ?? blocker.combatantId;
    throw new Error(
      `Misty Step destination (${intent.to.x},${intent.to.y}) is occupied by ${name}; teleport requires an unoccupied space`,
    );
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
  const dodger = state.characters[intent.combatantId];
  if (dodger) assertActorCanAct(dodger, 'Dodge');
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
  const disengager = state.characters[intent.combatantId];
  if (disengager) assertActorCanAct(disengager, 'Disengage');
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
