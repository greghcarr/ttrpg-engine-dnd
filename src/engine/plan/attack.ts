import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type {
  AttackRolledEvent,
  DamageRolledEvent,
  DamageRoll,
} from '../../schemas/events/attack.js';
import type { DamageAppliedEvent } from '../../schemas/events/combat.js';
import type { RNG } from '../../rng/index.js';
import { rollDie, parseDiceExpression } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { computeAttackBonus } from '../../derive/attack.js';
import { computeAC } from '../../derive/ac.js';
import { abilityModifier } from '../../derive/ability.js';
import { computeActionEconomyBudget } from '../../derive/action-economy.js';
import { mitigateDamage } from '../../derive/damage-mitigation.js';
import { dispatchTriggers } from '../triggers/dispatch.js';
import { applyAll } from '../apply.js';
import { D20_SIDES, NAT_20, NAT_1 } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';

export const COVER_KINDS = ['none', 'half', 'three-quarters', 'total'] as const;
export type CoverKind = (typeof COVER_KINDS)[number];

const HALF_COVER_AC_BONUS = 2;
const THREE_QUARTERS_COVER_AC_BONUS = 5;

export const coverACBonus = (cover: CoverKind): number => {
  switch (cover) {
    case 'half':
      return HALF_COVER_AC_BONUS;
    case 'three-quarters':
      return THREE_QUARTERS_COVER_AC_BONUS;
    case 'none':
    case 'total':
      return 0;
  }
};

export interface AttackIntent {
  readonly type: 'Attack';
  readonly attackerId: string;
  readonly targetId: string;
  readonly weaponInstanceId: string;
  readonly advantage?: 'advantage' | 'disadvantage' | 'none';
  readonly cover?: CoverKind;
  readonly at?: string;
}

const chooseDamageAbility = (
  attacker: { abilityScores: { STR: number; DEX: number } },
  weapon: { properties: ReadonlyArray<string>; attackKind: 'melee' | 'ranged' },
): 'STR' | 'DEX' => {
  const isFinesse = weapon.properties.includes('finesse');
  const isRanged = weapon.attackKind === 'ranged';
  if (isRanged && !weapon.properties.includes('thrown')) return 'DEX';
  if (isFinesse) {
    return abilityModifier(attacker.abilityScores.DEX) >=
      abilityModifier(attacker.abilityScores.STR)
      ? 'DEX'
      : 'STR';
  }
  return 'STR';
};

export interface ResolveAttackInput {
  readonly state: CampaignState;
  readonly content: ResolvedContent;
  readonly rng: RNG;
  readonly attackerId: string;
  readonly targetId: string;
  readonly weaponInstanceId: string;
  readonly advantage?: 'advantage' | 'disadvantage' | 'none';
  readonly cover?: CoverKind;
  readonly at: string;
}

export const resolveAttack = (input: ResolveAttackInput): ReadonlyArray<Event> => {
  const { state, content, rng, at } = input;
  const attacker = state.characters[input.attackerId];
  if (!attacker) throw new Error(`Unknown attacker ${input.attackerId}`);
  const target = state.characters[input.targetId];
  if (!target) throw new Error(`Unknown target ${input.targetId}`);
  const weaponInstance = state.itemInstances[input.weaponInstanceId];
  if (!weaponInstance) throw new Error(`Unknown weapon ${input.weaponInstanceId}`);
  const weaponDef = content.items.get(weaponInstance.definitionId);
  if (!weaponDef || weaponDef.itemKind !== 'weapon') {
    throw new Error(`Item ${weaponInstance.definitionId} is not a weapon`);
  }

  const attackBonusResult = computeAttackBonus({
    character: attacker,
    itemInstances: state.itemInstances,
    content,
    weaponInstanceId: input.weaponInstanceId,
  });

  const cover = input.cover ?? 'none';
  if (cover === 'total') {
    throw new Error(`${target.name} has total cover and cannot be targeted`);
  }
  const acResultBase = computeAC({
    character: target,
    itemInstances: state.itemInstances,
    content,
  });
  const coverBonus = coverACBonus(cover);
  const acResult = { ...acResultBase, total: acResultBase.total + coverBonus };

  const advantage = input.advantage ?? 'none';
  const rolls: number[] = [rollDie(D20_SIDES, rng)];
  if (advantage !== 'none') {
    rolls.push(rollDie(D20_SIDES, rng));
  }
  const usedRoll =
    advantage === 'advantage'
      ? Math.max(...rolls)
      : advantage === 'disadvantage'
        ? Math.min(...rolls)
        : (rolls[0] ?? 0);
  const total = usedRoll + attackBonusResult.total;
  const naturalHit = usedRoll === NAT_20;
  const naturalMiss = usedRoll === NAT_1;
  const hit = !naturalMiss && (naturalHit || total >= acResult.total);
  const critical = naturalHit;

  const attackRolled: AttackRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'AttackRolled',
    attackerId: input.attackerId,
    targetId: input.targetId,
    weaponInstanceId: input.weaponInstanceId,
    d20: rolls,
    used: advantage,
    attackBonus: attackBonusResult.total,
    total,
    targetAC: acResult.total,
    hit,
    critical,
  };

  const stateAfterAttack = applyAll(state, [attackRolled]);
  const attackTriggers = dispatchTriggers({
    state: stateAfterAttack,
    content,
    rng,
    event: attackRolled,
    at,
  });

  if (!hit) {
    return [attackRolled, ...attackTriggers];
  }

  const damageAbility = chooseDamageAbility(attacker, weaponDef);
  const damageAbilityMod = abilityModifier(attacker.abilityScores[damageAbility]);
  const parsed = parseDiceExpression(weaponDef.damageDice);
  const totalRolls = critical ? parsed.count * 2 : parsed.count;
  const damageRolls: number[] = [];
  for (let i = 0; i < totalRolls; i++) {
    damageRolls.push(rollDie(parsed.die, rng));
  }
  const damageRollPayload: DamageRoll = {
    expression: weaponDef.damageDice,
    rolls: damageRolls,
    modifier: damageAbilityMod + parsed.modifier,
    type: weaponDef.damageType,
  };

  const damageRolled: DamageRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DamageRolled',
    attackerId: input.attackerId,
    targetId: input.targetId,
    weaponInstanceId: input.weaponInstanceId,
    rolls: [damageRollPayload],
    critical,
    causedByEventId: attackRolled.id,
  };

  const damageTotal = damageRolls.reduce((s, v) => s + v, 0) + damageRollPayload.modifier;
  const mitigatedComponents = mitigateDamage({
    character: target,
    itemInstances: state.itemInstances,
    content,
    rawComponents: [{ amount: Math.max(0, damageTotal), type: weaponDef.damageType }],
  });
  const damageApplied: DamageAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DamageApplied',
    targetId: input.targetId,
    components: mitigatedComponents,
    causedByEventId: damageRolled.id,
  };

  return [attackRolled, ...attackTriggers, damageRolled, damageApplied];
};

export const planAttack = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: AttackIntent,
): ReadonlyArray<Event> => {
  const economyPrelude = planActionEconomyForAttack(state, content, intent);
  const at = intent.at ?? nowIso();
  const resolution = resolveAttack({
    state,
    content,
    rng,
    attackerId: intent.attackerId,
    targetId: intent.targetId,
    weaponInstanceId: intent.weaponInstanceId,
    ...(intent.cover !== undefined ? { cover: intent.cover } : {}),
    ...(intent.advantage !== undefined ? { advantage: intent.advantage } : {}),
    at,
  });
  return [...economyPrelude, ...resolution];
};

const findActiveCombatant = (
  state: CampaignState,
  attackerId: string,
): { encounterId: string; attacksMadeThisTurn: number; actionUsed: boolean } | undefined => {
  const encounterId = state.activeEncounterId;
  if (encounterId === undefined) return undefined;
  const encounter = state.encounters[encounterId];
  if (!encounter || encounter.status !== 'active') return undefined;
  const active = encounter.combatants[encounter.activeIndex];
  if (!active || active.combatantId !== attackerId) return undefined;
  return {
    encounterId,
    attacksMadeThisTurn: active.turnUsage.attacksMadeThisTurn,
    actionUsed: active.turnUsage.actionUsed,
  };
};

const planActionEconomyForAttack = (
  state: CampaignState,
  content: ResolvedContent,
  intent: AttackIntent,
): ReadonlyArray<Event> => {
  const attacker = state.characters[intent.attackerId];
  if (!attacker) return [];
  const active = findActiveCombatant(state, intent.attackerId);
  if (active === undefined) return [];

  const budget = computeActionEconomyBudget({
    character: attacker,
    itemInstances: state.itemInstances,
    content,
  });

  if (active.attacksMadeThisTurn >= budget.maxAttacksPerAction) {
    throw new Error(
      `Attack budget exhausted: ${attacker.name} has already made ${active.attacksMadeThisTurn} attacks this turn (max ${budget.maxAttacksPerAction})`,
    );
  }

  const at = intent.at ?? nowIso();
  const events: ActionEconomyConsumedEvent[] = [];
  if (!active.actionUsed) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'ActionEconomyConsumed',
      encounterId: active.encounterId,
      combatantId: intent.attackerId,
      kind: 'action',
    });
  }
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'ActionEconomyConsumed',
    encounterId: active.encounterId,
    combatantId: intent.attackerId,
    kind: 'attack',
  });
  return events;
};
