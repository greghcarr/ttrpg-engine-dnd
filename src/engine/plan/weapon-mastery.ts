import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { RNG } from '../../rng/index.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId, newAppliedConditionId } from '../../ids.js';
import { D20_SIDES } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import { invariant } from '../../internal/invariants.js';
import { abilityModifier, proficiencyBonus } from '../../derive/ability.js';
import { computeTotalLevel } from '../../schemas/runtime/character.js';
import type { ULID } from '../ids-utils.js';
import type { WeaponMastery } from '../../schemas/primitives.js';
import type { WeaponMasteryActivatedEvent } from '../../schemas/events/weapon-mastery.js';
import type { ConditionAppliedEvent, DamageAppliedEvent } from '../../schemas/events/combat.js';
import type { CombatantMovedEvent } from '../../schemas/events/movement.js';
import type { SaveRolledEvent } from '../../schemas/events/checks.js';
import { planConcentrationBreakOnDrop } from './concentration.js';
import { interceptFatalDamage } from '../../derive/fatal-damage-intercept.js';
import { applyAll } from '../apply.js';

const UNARMED_DC_BASE = 8;
const CELL_SIZE_FEET = 5;
const PUSH_DISTANCE_FEET = 10;

const masterySaveDC = (character: { abilityScores: { STR: number }; classes: Array<{ level: number }> }): number =>
  UNARMED_DC_BASE +
  abilityModifier(character.abilityScores.STR) +
  proficiencyBonus(computeTotalLevel(character as never));

const recordMasteryEvent = (
  mastery: WeaponMastery,
  attackerId: string,
  targetId: string | undefined,
  weaponInstanceId: string,
  at: string,
): WeaponMasteryActivatedEvent => ({
  id: newEventId() as ULID,
  at,
  type: 'WeaponMasteryActivated',
  mastery,
  attackerId,
  weaponInstanceId,
  ...(targetId !== undefined ? { targetId } : {}),
});

export interface WeaponMasteryIntent {
  readonly type: 'WeaponMastery';
  readonly mastery: WeaponMastery;
  readonly attackerId: string;
  readonly targetId: string;
  readonly weaponInstanceId: string;
  readonly at?: string;
}

export const planWeaponMastery = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: WeaponMasteryIntent,
): ReadonlyArray<Event> => {
  const attacker = state.characters[intent.attackerId];
  invariant(attacker !== undefined, `Attacker ${intent.attackerId} not found`);
  const target = state.characters[intent.targetId];
  invariant(target !== undefined, `Target ${intent.targetId} not found`);
  const weaponInst = state.itemInstances[intent.weaponInstanceId];
  invariant(weaponInst !== undefined, `Weapon ${intent.weaponInstanceId} not found`);
  const weapon = content.items.get(weaponInst.definitionId);
  invariant(weapon !== undefined, `Weapon definition ${weaponInst.definitionId} not found`);
  invariant(
    weapon.itemKind === 'weapon',
    `Item ${weaponInst.definitionId} is not a weapon`,
  );
  invariant(
    weapon.mastery === intent.mastery,
    `Weapon ${weaponInst.definitionId} mastery is ${weapon.mastery ?? 'none'}, not ${intent.mastery}`,
  );

  const at = intent.at ?? nowIso();
  const events: Event[] = [
    recordMasteryEvent(intent.mastery, intent.attackerId, intent.targetId, intent.weaponInstanceId, at),
  ];

  switch (intent.mastery) {
    case 'Sap':
      events.push({
        id: newEventId() as ULID,
        at,
        type: 'ConditionApplied',
        targetId: intent.targetId,
        conditionId: 'sapped',
        appliedConditionId: newAppliedConditionId(),
      } satisfies ConditionAppliedEvent);
      break;
    case 'Vex':
      events.push({
        id: newEventId() as ULID,
        at,
        type: 'ConditionApplied',
        targetId: intent.targetId,
        conditionId: 'vexed-by',
        appliedConditionId: newAppliedConditionId(),
      } satisfies ConditionAppliedEvent);
      break;
    case 'Slow':
      events.push({
        id: newEventId() as ULID,
        at,
        type: 'ConditionApplied',
        targetId: intent.targetId,
        conditionId: 'slowed-10ft',
        appliedConditionId: newAppliedConditionId(),
      } satisfies ConditionAppliedEvent);
      break;
    case 'Topple': {
      const dc = masterySaveDC(attacker);
      const d20 = rollDie(D20_SIDES, rng);
      const conBonus = abilityModifier(target.abilityScores.CON);
      const total = d20 + conBonus;
      const success = total >= dc;
      events.push({
        id: newEventId() as ULID,
        at,
        type: 'SaveRolled',
        targetId: intent.targetId,
        ability: 'CON',
        dc,
        d20: [d20],
        used: 'none',
        bonus: conBonus,
        total,
        success,
      } satisfies SaveRolledEvent);
      if (!success) {
        events.push({
          id: newEventId() as ULID,
          at,
          type: 'ConditionApplied',
          targetId: intent.targetId,
          conditionId: 'prone',
          appliedConditionId: newAppliedConditionId(),
        } satisfies ConditionAppliedEvent);
      }
      break;
    }
    case 'Push': {
      const encounter = state.activeEncounterId !== undefined
        ? state.encounters[state.activeEncounterId]
        : undefined;
      const targetCombatant = encounter?.combatants.find((c) => c.combatantId === intent.targetId);
      if (encounter !== undefined && targetCombatant?.position !== undefined) {
        const attackerCombatant = encounter.combatants.find((c) => c.combatantId === intent.attackerId);
        const attackerPos = attackerCombatant?.position;
        const dx = attackerPos !== undefined
          ? Math.sign(targetCombatant.position.x - attackerPos.x) || 1
          : 1;
        const dy = attackerPos !== undefined
          ? Math.sign(targetCombatant.position.y - attackerPos.y) || 0
          : 0;
        const cells = PUSH_DISTANCE_FEET / CELL_SIZE_FEET;
        events.push({
          id: newEventId() as ULID,
          at,
          type: 'CombatantMoved',
          encounterId: encounter.id,
          combatantId: intent.targetId,
          fromPosition: { x: targetCombatant.position.x, y: targetCombatant.position.y },
          toPosition: {
            x: targetCombatant.position.x + dx * cells,
            y: targetCombatant.position.y + dy * cells,
          },
          feetTraveled: PUSH_DISTANCE_FEET,
        } satisfies CombatantMovedEvent);
      }
      break;
    }
    case 'Graze': {
      const damageType = weapon.damageType;
      const grazeAmount = Math.max(0, abilityModifier(attacker.abilityScores.STR));
      if (grazeAmount > 0) {
        const grazeDamageId = newEventId() as ULID;
        const intercept = interceptFatalDamage({
          state: applyAll(state, events),
          content,
          targetId: intent.targetId,
          mitigatedComponents: [{ amount: grazeAmount, type: damageType, rawAmount: grazeAmount }],
          causedByEventId: grazeDamageId,
          at,
        });
        const grazeDamage: DamageAppliedEvent = {
          id: grazeDamageId,
          at,
          type: 'DamageApplied',
          targetId: intent.targetId,
          components: intercept.components,
        };
        events.push(grazeDamage);
        events.push(...intercept.extraEvents);
        events.push(
          ...planConcentrationBreakOnDrop(target, grazeDamage.components, grazeDamage.id, at),
        );
      }
      break;
    }
    case 'Cleave':
    case 'Nick':
    case 'Flex':
      // Cleave grants an extra attack; Nick changes the off-hand timing;
      // Flex toggles 1H/2H damage dice. None produce a rider event on
      // their own — they shape the attack sequence and belong in the
      // attack planner, not here.
      break;
  }
  return events;
};
