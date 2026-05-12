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
import type { ULID } from '../ids-utils.js';

const D20 = 20;
const NAT_20 = 20;
const NAT_1 = 1;

export interface AttackIntent {
  readonly type: 'Attack';
  readonly attackerId: string;
  readonly targetId: string;
  readonly weaponInstanceId: string;
  readonly advantage?: 'advantage' | 'disadvantage' | 'none';
  readonly at?: string;
}

const nowIso = (): string => new Date().toISOString();

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

export const planAttack = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: AttackIntent,
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

  const advantage = intent.advantage ?? 'none';
  const rolls: number[] = [rollDie(D20, rng)];
  if (advantage !== 'none') {
    rolls.push(rollDie(D20, rng));
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

  const at = intent.at ?? nowIso();

  const attackRolled: AttackRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'AttackRolled',
    attackerId: intent.attackerId,
    targetId: intent.targetId,
    weaponInstanceId: intent.weaponInstanceId,
    d20: rolls,
    used: advantage,
    attackBonus: attackBonusResult.total,
    total,
    targetAC: acResult.total,
    hit,
    critical,
  };

  if (!hit) {
    return [attackRolled];
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
    attackerId: intent.attackerId,
    targetId: intent.targetId,
    weaponInstanceId: intent.weaponInstanceId,
    rolls: [damageRollPayload],
    critical,
    causedByEventId: attackRolled.id,
  };

  const damageTotal = damageRolls.reduce((s, v) => s + v, 0) + damageRollPayload.modifier;
  const damageApplied: DamageAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DamageApplied',
    targetId: intent.targetId,
    components: [{ amount: Math.max(0, damageTotal), type: weaponDef.damageType }],
    causedByEventId: damageRolled.id,
  };

  return [attackRolled, damageRolled, damageApplied];
};
