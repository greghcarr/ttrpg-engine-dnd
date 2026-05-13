import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';
import type {
  AttackRolledEvent,
  DamageRolledEvent,
  DamageRoll,
} from '../../schemas/events/attack.js';
import type { DamageAppliedEvent } from '../../schemas/events/combat.js';
import type { RNG } from '../../rng/index.js';
import { rollDie, parseDiceExpression } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import { computeAttackBonus } from '../../derive/attack.js';
import { computeAC } from '../../derive/ac.js';
import { abilityModifier } from '../../derive/ability.js';
import { mitigateDamage } from '../../derive/damage-mitigation.js';
import { planConcentrationBreakOnDrop } from './concentration.js';
import { D20_SIDES, NAT_20, NAT_1 } from '../../internal/constants.js';
import type { ULID } from '../ids-utils.js';

export interface OffHandAttackIntent {
  readonly type: 'OffHandAttack';
  readonly attackerId: string;
  readonly targetId: string;
  readonly weaponInstanceId: string;
  readonly at?: string;
}

const findActiveEncounter = (
  state: CampaignState,
  attackerId: string,
): { encounterId: string; bonusActionUsed: boolean } | undefined => {
  const encounterId = state.activeEncounterId;
  if (encounterId === undefined) return undefined;
  const encounter = state.encounters[encounterId];
  if (!encounter || encounter.status !== 'active') return undefined;
  const active = encounter.combatants[encounter.activeIndex];
  if (!active || active.combatantId !== attackerId) return undefined;
  return { encounterId, bonusActionUsed: active.turnUsage.bonusActionUsed };
};

export const planOffHandAttack = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: OffHandAttackIntent,
): ReadonlyArray<Event> => {
  const attacker = state.characters[intent.attackerId];
  if (!attacker) throw new Error(`Unknown attacker ${intent.attackerId}`);
  const target = state.characters[intent.targetId];
  if (!target) throw new Error(`Unknown target ${intent.targetId}`);
  const weaponInstance = state.itemInstances[intent.weaponInstanceId];
  if (!weaponInstance) throw new Error(`Unknown weapon ${intent.weaponInstanceId}`);
  const weaponDef = content.items.get(weaponInstance.definitionId);
  if (!weaponDef || weaponDef.itemKind !== 'weapon') {
    throw new Error(`Item ${weaponInstance.definitionId} is not a weapon`);
  }
  if (!weaponDef.properties.includes('light')) {
    throw new Error(`Off-hand attacks require a 'light' weapon; ${weaponDef.name} is not light`);
  }

  const active = findActiveEncounter(state, intent.attackerId);
  if (active === undefined) {
    throw new Error('Off-hand attack requires being the active combatant in an active encounter');
  }
  // Nick mastery: the off-hand attack becomes part of the Attack action
  // instead of a Bonus Action, once per turn. RAW 2024.
  const NICK_TRIGGER_ID = 'mastery:nick';
  const nickAvailable =
    weaponDef.mastery === 'Nick' &&
    (attacker.triggerCounters[NICK_TRIGGER_ID]?.firedThisTurn !== true);
  if (!nickAvailable && active.bonusActionUsed) {
    throw new Error('Bonus action already used this turn');
  }

  const at = intent.at ?? nowIso();

  const economyEvents: Event[] = [];
  if (nickAvailable) {
    // Use Nick: no bonus action consumed; mark the once-per-turn slot used.
    economyEvents.push({
      id: newEventId() as ULID,
      at,
      type: 'TriggerFired',
      characterId: intent.attackerId,
      triggerId: NICK_TRIGGER_ID,
      cadence: { firedThisTurn: true },
    });
  } else {
    economyEvents.push({
      id: newEventId() as ULID,
      at,
      type: 'ActionEconomyConsumed',
      encounterId: active.encounterId,
      combatantId: intent.attackerId,
      kind: 'bonusAction',
    } satisfies ActionEconomyConsumedEvent);
  }

  const attackBonusResult = computeAttackBonus({
    character: attacker,
    itemInstances: state.itemInstances,
    content,
    weaponInstanceId: intent.weaponInstanceId,
  });
  const acResult = computeAC({
    character: target,
    itemInstances: state.itemInstances,
    content,
  });
  const d20 = rollDie(D20_SIDES, rng);
  const total = d20 + attackBonusResult.total;
  const naturalHit = d20 === NAT_20;
  const naturalMiss = d20 === NAT_1;
  const hit = !naturalMiss && (naturalHit || total >= acResult.total);
  const critical = naturalHit;

  const attackRolled: AttackRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'AttackRolled',
    attackerId: intent.attackerId,
    targetId: intent.targetId,
    weaponInstanceId: intent.weaponInstanceId,
    d20: [d20],
    used: 'none',
    attackBonus: attackBonusResult.total,
    total,
    targetAC: acResult.total,
    hit,
    critical,
  };

  if (!hit) {
    return [...economyEvents, attackRolled];
  }

  // Off-hand attacks do NOT add ability modifier to damage (except negative).
  const strMod = abilityModifier(attacker.abilityScores.STR);
  const dexMod = abilityModifier(attacker.abilityScores.DEX);
  const isFinesse = weaponDef.properties.includes('finesse');
  const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
  const offHandModifier = abilityMod < 0 ? abilityMod : 0;
  const parsed = parseDiceExpression(weaponDef.damageDice);
  const totalRolls = critical ? parsed.count * 2 : parsed.count;
  const damageRolls: number[] = [];
  for (let i = 0; i < totalRolls; i++) {
    damageRolls.push(rollDie(parsed.die, rng));
  }
  const damageRollPayload: DamageRoll = {
    expression: weaponDef.damageDice,
    rolls: damageRolls,
    modifier: offHandModifier + parsed.modifier,
    type: weaponDef.damageType,
  };
  const damageRolled: DamageRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DamageRolled',
    attackerId: intent.attackerId,
    targetId: intent.targetId,
    weaponInstanceId: intent.weaponInstanceId,
    rolls: [damageRollPayload],
    critical,
    causedByEventId: attackRolled.id,
  };
  const damageTotal = damageRolls.reduce((s, v) => s + v, 0) + damageRollPayload.modifier;
  const mitigated = mitigateDamage({
    character: target,
    itemInstances: state.itemInstances,
    content,
    rawComponents: [{ amount: Math.max(0, damageTotal), type: weaponDef.damageType }],
  });
  const damageApplied: DamageAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DamageApplied',
    targetId: intent.targetId,
    components: mitigated,
    causedByEventId: damageRolled.id,
  };
  const concentrationBreak = planConcentrationBreakOnDrop(
    target,
    mitigated,
    damageApplied.id,
    at,
  );

  return [
    ...economyEvents,
    attackRolled,
    damageRolled,
    damageApplied,
    ...concentrationBreak,
  ];
};
