import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type {
  AttackRolledEvent,
  DamageRolledEvent,
  DamageRoll,
} from '../../schemas/events/attack.js';
import type { DamageAppliedEvent, ConditionRemovedEvent } from '../../schemas/events/combat.js';
import type { MirrorImageDeflectedEvent } from '../../schemas/events/mirror-image.js';
import type { ItemTemporaryBuff } from '../../schemas/runtime/item-instance.js';
import type { RNG } from '../../rng/index.js';
import { rollDie, parseDiceExpression } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { computeAttackBonus } from '../../derive/attack.js';
import { computeAC } from '../../derive/ac.js';
import { buildEffectStack } from '../../derive/effect-stack.js';
import { getCreatureType } from '../../derive/creature-type.js';
import { abilityModifier, effectiveAbilityScore } from '../../derive/ability.js';
import { computeActionEconomyBudget } from '../../derive/action-economy.js';
import { mitigateDamage } from '../../derive/damage-mitigation.js';
import { interceptFatalDamage } from '../../derive/fatal-damage-intercept.js';
import { isMagicWeaponAttack } from '../../derive/magicality.js';
import {
  findMirrorImage,
  mirrorImageThreshold,
  duplicateAC as computeDuplicateAC,
  type MirrorImageState,
} from '../../derive/mirror-image.js';
import { planConcentrationBreakOnDrop } from './concentration.js';
import { dispatchTriggers } from '../triggers/dispatch.js';
import { applyAll } from '../apply.js';
import { D20_SIDES, NAT_20, NAT_1 } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';
import { assertActorCanAct, findActorBlockingCondition } from './_actor-state.js';
import { chebyshevDistance } from './movement.js';

const DEFAULT_MELEE_REACH_FEET = 5;
const REACH_PROPERTY_FEET = 10;

// Rolls an item buff's per-hit extra-damage rider (Elemental Weapon:
// +1d4/2d4/3d4 of the caster-chosen type). Returns undefined when the
// buff has no extra damage configured. Crits double the dice per RAW.
const buildBuffExtraDamageRoll = (
  buff: ItemTemporaryBuff | undefined,
  rng: RNG,
  critical: boolean,
): DamageRoll | undefined => {
  if (buff?.extraDamageDice === undefined || buff.extraDamageType === undefined) return undefined;
  const parsed = parseDiceExpression(buff.extraDamageDice);
  const totalDice = critical ? parsed.count * 2 : parsed.count;
  const rolls: number[] = [];
  for (let i = 0; i < totalDice; i++) {
    rolls.push(rollDie(parsed.die, rng));
  }
  return {
    expression: buff.extraDamageDice,
    rolls,
    modifier: parsed.modifier,
    type: buff.extraDamageType,
  };
};

// Slice 124. Builds the event tail for a Mirror Image-deflected
// attack: AttackRolled (with hit:false against the duplicate AC) +
// MirrorImageDeflected, plus a trailing ConditionRemoved when the
// last duplicate is destroyed. Returns undefined when the deflection
// d20 doesn't meet the duplicate-pool threshold; callers fall back
// to the normal attack flow.
//
// Slice 125: dispatchTriggers runs on the deflected AttackRolled.
// Bearer-side hit-gated riders (AoA, Fire Shield) still don't fire
// because the event carries hit:false, but attacker-side on-miss
// riders (Studied Attacks' consume-on-attack-vs-source, future
// similar) get a chance to fire as RAW expects: the attacker rolled
// an attack against the bearer, the bearer's defenses just absorbed
// it via an illusion.
export interface DeflectedAttackInput {
  readonly state: CampaignState;
  readonly content: ResolvedContent;
  readonly attackerId: ULID;
  readonly bearerId: ULID;
  readonly weaponInstanceId: ULID;
  readonly attackBonus: number;
  readonly advantage: 'none' | 'advantage' | 'disadvantage';
  readonly attackKind: 'melee' | 'ranged';
  readonly rng: RNG;
  readonly at: string;
  readonly mirrorImage: MirrorImageState;
  readonly causedByEventId?: ULID;
}

export const tryBuildDeflectedAttack = (
  input: DeflectedAttackInput,
): ReadonlyArray<Event> | undefined => {
  const deflectionD20 = rollDie(D20_SIDES, input.rng);
  const threshold = mirrorImageThreshold(input.mirrorImage.duplicates);
  if (deflectionD20 < threshold) return undefined;

  const duplicateAC = computeDuplicateAC(input.mirrorImage.bearerDexMod);
  const attackRolls: number[] = [rollDie(D20_SIDES, input.rng)];
  if (input.advantage !== 'none') attackRolls.push(rollDie(D20_SIDES, input.rng));
  const usedRoll =
    input.advantage === 'advantage'
      ? Math.max(...attackRolls)
      : input.advantage === 'disadvantage'
        ? Math.min(...attackRolls)
        : (attackRolls[0] ?? 0);
  const attackTotal = usedRoll + input.attackBonus;
  const natural20 = usedRoll === NAT_20;
  const natural1 = usedRoll === NAT_1;
  const duplicateHit = !natural1 && (natural20 || attackTotal >= duplicateAC);
  const duplicatesAfter = duplicateHit
    ? input.mirrorImage.duplicates - 1
    : input.mirrorImage.duplicates;

  const attackRolled: AttackRolledEvent = {
    id: newEventId() as ULID,
    at: input.at,
    type: 'AttackRolled',
    attackerId: input.attackerId,
    targetId: input.bearerId,
    weaponInstanceId: input.weaponInstanceId,
    d20: attackRolls,
    used: input.advantage,
    attackBonus: input.attackBonus,
    total: attackTotal,
    targetAC: duplicateAC,
    hit: false,
    critical: false,
    attackKind: input.attackKind,
  };
  const deflected: MirrorImageDeflectedEvent = {
    id: newEventId() as ULID,
    at: input.at,
    type: 'MirrorImageDeflected',
    bearerId: input.bearerId,
    attackerId: input.attackerId,
    appliedConditionId: input.mirrorImage.appliedConditionId,
    deflectionD20,
    deflectionThreshold: threshold,
    duplicateAC,
    attackD20: usedRoll,
    attackTotal,
    duplicateHit,
    duplicatesAfter,
    ...(input.causedByEventId !== undefined
      ? { causedByEventId: input.causedByEventId }
      : {}),
  };
  // Slice 125: dispatch triggers on the deflected AttackRolled so
  // attacker-side on-miss riders (Studied Attacks' consume-on-attack-
  // vs-source, future similar) fire as RAW expects. The bearer-side
  // hit-gated riders (AoA, Fire Shield) won't fire because the event
  // carries hit:false.
  const stateAfterAttack = applyAll(input.state, [attackRolled]);
  const attackTriggers = dispatchTriggers({
    state: stateAfterAttack,
    content: input.content,
    rng: input.rng,
    event: attackRolled,
    at: input.at,
  });
  const events: Event[] = [attackRolled, ...attackTriggers, deflected];
  if (duplicateHit && duplicatesAfter === 0) {
    const removed: ConditionRemovedEvent = {
      id: newEventId() as ULID,
      at: input.at,
      type: 'ConditionRemoved',
      targetId: input.bearerId,
      conditionId: 'mirror-image-active',
      causedByEventId: deflected.id,
    };
    events.push(removed);
  }
  return events;
};

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

// Monk class feature: Martial Arts die scaling (PHB 2024 Monk table).
// L1: 1d6, L5: 1d8, L11: 1d10, L17: 1d12. Pre-L1 (non-Monk or
// multiclass with 0 Monk levels) returns undefined.
const martialArtsDie = (monkLevel: number): string | undefined => {
  if (monkLevel >= 17) return '1d12';
  if (monkLevel >= 11) return '1d10';
  if (monkLevel >= 5) return '1d8';
  if (monkLevel >= 1) return '1d6';
  return undefined;
};

// When a Monk uses an Unarmed Strike whose natural die is smaller than
// their Martial Arts die, the Martial Arts die replaces it. Other
// weapons (and non-Monks) keep their natural die.
export const applyMartialArtsDieScaling = (
  attacker: { classes: ReadonlyArray<{ classId: string; level: number }> },
  weaponDefId: string,
  naturalDamageDice: string,
): string => {
  if (weaponDefId !== 'unarmed-strike') return naturalDamageDice;
  const monk = attacker.classes.find((c) => c.classId === 'monk');
  const lvl = monk?.level ?? 0;
  const maDie = martialArtsDie(lvl);
  if (maDie === undefined) return naturalDamageDice;
  const naturalDie = parseDiceExpression(naturalDamageDice).die;
  const martialArtsSize = parseDiceExpression(maDie).die;
  return martialArtsSize > naturalDie ? maDie : naturalDamageDice;
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
  // Slice 206: set true when the attack is an opportunity attack
  // (called from planOpportunityAttack). Surfaced on the emitted
  // AttackRolled.isOpportunityAttack field and threaded into the
  // attackerFacts map so predicates (Hunter Escape the Horde, future
  // OA-specific riders) can scope to OAs without sniffing the planner.
  readonly isOpportunityAttack?: boolean;
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
    characters: state.characters,
  });

  const cover = input.cover ?? 'none';
  if (cover === 'total') {
    throw new Error(`${target.name} has total cover and cannot be targeted`);
  }
  const acResultBase = computeAC({
    character: target,
    itemInstances: state.itemInstances,
    content,
    characters: state.characters,
  });
  const coverBonus = coverACBonus(cover);
  const acResult = { ...acResultBase, total: acResultBase.total + coverBonus };

  // The target's effect stack may grant attackers advantage (Faerie
  // Fire, restrained, etc.). If the caller asked for plain 'none' but
  // the target's state implies advantage, upgrade. If they explicitly
  // asked for disadvantage, that wins (advantage and disadvantage from
  // separate sources cancel per RAW).
  const targetEffects = buildEffectStack({
    character: target,
    content,
    itemInstances: state.itemInstances,
    pendingChoices: state.pendingChoices,
  });
  // Barbarian Reckless Attack: target's recklessAttackActive flag
  // grants advantage to every incoming attack. Read from the encounter
  // combatant entry (per-turn state).
  const targetRecklessGrantsAdvantage = ((): boolean => {
    if (!state.activeEncounterId) return false;
    const enc = state.encounters[state.activeEncounterId];
    if (!enc) return false;
    const cb = enc.combatants.find((c) => c.combatantId === input.targetId);
    return cb?.turnUsage.recklessAttackActive === true;
  })();
  const targetGrantsAdvantage =
    targetEffects.grantsAdvantageToAttackers() || targetRecklessGrantsAdvantage;
  // Slice 199: target may carry `CancelAdvantageOnAttackers` (Rogue
  // L18 Elusive). Build a small bearer-facts map so a predicate-gated
  // entry can consult the target's own state — Elusive's gate is
  // "unless you have the Incapacitated condition," which the engine
  // models via the action-blocking condition set in `_actor-state`.
  const targetBearerFacts = new Map<string, unknown>([
    ['bearerHasIncapacitated', findActorBlockingCondition(target) !== undefined],
  ]);
  const targetCancelsAdvantage = targetEffects.cancelsAdvantageOnAttackers(targetBearerFacts);
  // Attacker's own Reckless Attack: melee STR-based attack rolls gain
  // advantage when the attacker has recklessAttackActive set on their
  // turnUsage.
  const attackerRecklessAdvantage = ((): boolean => {
    if (!state.activeEncounterId) return false;
    const enc = state.encounters[state.activeEncounterId];
    if (!enc) return false;
    const cb = enc.combatants.find((c) => c.combatantId === input.attackerId);
    if (cb?.turnUsage.recklessAttackActive !== true) return false;
    if (weaponDef.attackKind !== 'melee') return false;
    return chooseDamageAbility(attacker, weaponDef) === 'STR';
  })();
  // RAW PHB Equipment: "Small creatures have Disadvantage with Heavy
  // weapons." Look up the attacker's species → size; if Small AND
  // weapon has the `heavy` property, contribute disadvantage.
  const heavyForSmall = ((): boolean => {
    if (!weaponDef.properties.includes('heavy')) return false;
    const species = content.species.get(attacker.speciesId);
    if (!species) return false;
    return species.size === 'Small';
  })();
  // RAW PHB ch.1 "Ranged Attacks in Close Combat": ranged attacks have
  // disadvantage if a hostile creature who isn't Incapacitated is
  // within 5 ft of the attacker. The engine has no hostility model, so
  // treat any other living, non-incapacitated combatant within reach
  // as a threat. Out-of-encounter / unpositioned: no disadvantage
  // imposed (matches the rest of the planner's geometry-aware checks).
  const rangedInMelee = ((): boolean => {
    if (weaponDef.attackKind !== 'ranged') return false;
    if (!state.activeEncounterId) return false;
    const enc = state.encounters[state.activeEncounterId];
    if (!enc) return false;
    const attackerCb = enc.combatants.find((c) => c.combatantId === input.attackerId);
    const attackerPos = attackerCb?.position;
    if (!attackerPos) return false;
    return enc.combatants.some((other) => {
      if (other.combatantId === input.attackerId) return false;
      const otherPos = other.position;
      if (!otherPos) return false;
      const ch = state.characters[other.combatantId];
      if (!ch) return false;
      // Unconscious / Incapacitated / Stunned / Paralyzed / Petrified
      // creatures do not threaten ranged attackers (they cannot react).
      if (findActorBlockingCondition(ch) !== undefined) return false;
      return chebyshevDistance(attackerPos, otherPos) <= 5;
    });
  })();
  // Attacker-side effect stack. Carries per-source advantage entries
  // (Bestow Curse's `cursed-attacks-active` records a
  // `SetAdvantageVsSource` keyed on the cursor's id; the attack
  // planner consults the bucket with the current target's id below).
  // Also reused later for the crit threshold.
  const attackerEffects = buildEffectStack({
    character: attacker,
    content,
    itemInstances: state.itemInstances,
    pendingChoices: state.pendingChoices,
  });
  const attackerVsTargetAdvantage = attackerEffects.advantageVsSource('attack', input.targetId);
  // Slice 231: 3-way join — if the attacker bears a
  // GrantAdvantageVsBearersOfMyCondition entry and the target carries
  // a matching condition whose source is the attacker, fold in that
  // advantage / disadvantage. Canonical user: Ranger L17 Precise
  // Hunter (advantage vs Hunter's-Marked targets).
  const attackerVsMarkedTargetAdvantage = attackerEffects.advantageVsBearersOfMyCondition(
    'attack',
    target.appliedConditions,
    input.attackerId,
  );
  // Generic attacker-side advantage on attacks (e.g. Invisible) and
  // disadvantage on attacks (e.g. Blinded, Frightened, Poisoned,
  // Prone, Restrained). Folded alongside target-side contributions
  // so 2024 RAW advantage-cancellation applies symmetrically.
  const attackerSelfAdvantage = attackerEffects.advantageFor('attack');
  // Build a small facts map for type-conditional ImposeDisadvantage
  // entries (Protection from Evil and Good gates the disadvantage on
  // the attacker being aberration / celestial / elemental / fey /
  // fiend / undead). Entries with no predicate apply unconditionally.
  const attackerFacts = new Map<string, unknown>([
    ['attackerCreatureType', getCreatureType(attacker, content)],
    // Slice 206: surfaces opportunity-attack-ness to predicate-gated
    // ImposeDisadvantageOnAttackers entries (Hunter Escape the Horde).
    ['event.isOpportunityAttack', input.isOpportunityAttack === true],
  ]);
  const targetImposesDisadvantage =
    targetEffects.imposesDisadvantageOnAttackers(attackerFacts)
    || rangedInMelee
    || heavyForSmall
    || attackerVsTargetAdvantage.disadvantage
    || attackerVsMarkedTargetAdvantage.disadvantage
    || attackerSelfAdvantage.disadvantage;
  let advantage = input.advantage ?? 'none';
  // Reckless Attack: if the attacker activated it this turn (and the
  // attack qualifies), it contributes advantage just like the target's
  // grants-advantage path.
  // Elusive (slice 199) cancels every advantage contribution against
  // the bearer; an explicit `input.advantage === 'advantage'` from the
  // caller is also suppressed below.
  const effectivelyGrantsAdvantage =
    !targetCancelsAdvantage && (
      targetGrantsAdvantage
      || attackerRecklessAdvantage
      || attackerVsTargetAdvantage.advantage
      || attackerVsMarkedTargetAdvantage.advantage
      || attackerSelfAdvantage.advantage
    );
  if (targetCancelsAdvantage && advantage === 'advantage') {
    advantage = 'none';
  }
  // 2024 advantage/disadvantage cancellation: if both apply, the
  // attack is rolled with neither. Apply the target's contributions
  // first, then resolve.
  if (effectivelyGrantsAdvantage && targetImposesDisadvantage) {
    // Both cancel — no further auto-modification beyond what the
    // caller passed in.
  } else if (advantage === 'none' && effectivelyGrantsAdvantage) {
    advantage = 'advantage';
  } else if (advantage === 'none' && targetImposesDisadvantage) {
    advantage = 'disadvantage';
  } else if (advantage === 'advantage' && targetImposesDisadvantage) {
    advantage = 'none';
  } else if (advantage === 'disadvantage' && effectivelyGrantsAdvantage) {
    advantage = 'none';
  }
  // Slice 124: Mirror Image deflection. Roll the deflection d20 before
  // the attack roll; on success the attack rolls against the duplicate
  // AC = 10 + bearer DEX mod instead, and emits no damage chain.
  // Slice 127: RAW vision-gate. PHB 2024 Mirror Image: "A creature is
  // unaffected by this spell if it can't see, if it relies on senses
  // other than sight (such as Blindsight), or if it can perceive
  // illusions as false (as with Truesight)." Attackers with blindsight
  // or truesight at any range, or attackers carrying the Blinded
  // condition, see the bearer directly and bypass the deflection pool.
  const attackerBypassesMirrorImage =
    attackerEffects.hasSense('blindsight')
    || attackerEffects.hasSense('truesight')
    || attacker.appliedConditions.some((c) => c.conditionId === 'blinded');
  const mirrorImage = attackerBypassesMirrorImage ? undefined : findMirrorImage(target);
  if (mirrorImage !== undefined) {
    const deflectedEvents = tryBuildDeflectedAttack({
      state,
      content,
      attackerId: input.attackerId,
      bearerId: input.targetId,
      weaponInstanceId: input.weaponInstanceId,
      attackBonus: attackBonusResult.total,
      advantage,
      attackKind: weaponDef.attackKind,
      rng,
      at,
      mirrorImage,
    });
    if (deflectedEvents !== undefined) return deflectedEvents;
  }
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
  // Improved Critical / Superior Critical (and similar) lower the
  // crit threshold via ExpandCritRange. Default 20. A crit only
  // counts on a hit (a 19 that misses AC is just a miss).
  const critThreshold = attackerEffects.critThreshold();
  const critical = hit && usedRoll >= critThreshold;

  // RAW Rogue Sneak Attack (and equivalent content triggers): the
  // ally-adjacent path requires *another* positioned, non-incapacitated
  // combatant within 5 ft of the target. The engine has no team
  // model, so any third party counts (content can layer hostility on
  // top via additional predicates). Excludes the attacker, the
  // target, and any combatant whose action-blocking conditions would
  // prevent them from "threatening" the target.
  const attackerHasAllyAdjacentToTarget = ((): boolean | undefined => {
    if (!state.activeEncounterId) return undefined;
    const enc = state.encounters[state.activeEncounterId];
    if (!enc) return undefined;
    const targetCb = enc.combatants.find((c) => c.combatantId === input.targetId);
    if (!targetCb?.position) return undefined;
    const targetPos = targetCb.position;
    return enc.combatants.some((other) => {
      if (other.combatantId === input.attackerId) return false;
      if (other.combatantId === input.targetId) return false;
      if (!other.position) return false;
      const ch = state.characters[other.combatantId];
      if (!ch) return false;
      if (findActorBlockingCondition(ch) !== undefined) return false;
      return chebyshevDistance(other.position, targetPos) <= 5;
    });
  })();

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
    attackKind: weaponDef.attackKind,
    ...(attackerHasAllyAdjacentToTarget !== undefined
      ? { attackerHasAllyAdjacentToTarget }
      : {}),
    ...(input.isOpportunityAttack === true ? { isOpportunityAttack: true } : {}),
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
  const damageBaseScore = attacker.abilityScores[damageAbility];
  const damageScoreFloor = attackerEffects.effectiveAbilityScoreFloor(damageAbility)?.value;
  const damageAbilityMod = abilityModifier(effectiveAbilityScore(damageBaseScore, damageScoreFloor));
  // Flex mastery: a versatile weapon wielded two-handed (off-hand empty)
  // uses the larger versatileDice instead of damageDice. RAW 2024.
  const wieldedTwoHanded =
    attacker.equipped.mainHand === input.weaponInstanceId &&
    attacker.equipped.offHand === undefined;
  const useFlex =
    weaponDef.mastery === 'Flex' &&
    weaponDef.properties.includes('versatile') &&
    weaponDef.versatileDice !== undefined &&
    wieldedTwoHanded;
  const baseDamageExpression = useFlex && weaponDef.versatileDice !== undefined
    ? weaponDef.versatileDice
    : weaponDef.damageDice;
  const damageExpression = applyMartialArtsDieScaling(attacker, weaponDef.id, baseDamageExpression);
  const parsed = parseDiceExpression(damageExpression);
  const totalRolls = critical ? parsed.count * 2 : parsed.count;
  const damageRolls: number[] = [];
  for (let i = 0; i < totalRolls; i++) {
    damageRolls.push(rollDie(parsed.die, rng));
  }
  // Slice 121: Great Weapon Fighting reroll-to-3 rule. Triggers on a
  // melee attack with a two-handed wield (Two-Handed property, or
  // Versatile with both off-hand and shield slots empty). Each weapon
  // damage die showing 1 or 2 is treated as 3. Applied to the rolled
  // values in place so the DamageRolled event reflects the final
  // dice. Doesn't apply to the slice-90 `extraDamageDice` rider — RAW
  // GWF covers "the weapon's damage dice" only. Stricter than the
  // Flex `wieldedTwoHanded` check above: GWF requires the shield slot
  // to be empty too, since a shield occupies the off hand even though
  // the engine tracks it in a separate slot.
  const twoHandedForGwf =
    weaponDef.properties.includes('two-handed')
    || (weaponDef.properties.includes('versatile')
        && attacker.equipped.offHand === undefined
        && attacker.equipped.shield === undefined);
  const gwfApplies =
    weaponDef.attackKind === 'melee'
    && twoHandedForGwf
    && attackerEffects.hasGreatWeaponFighting();
  if (gwfApplies) {
    for (let i = 0; i < damageRolls.length; i++) {
      if (damageRolls[i]! < 3) damageRolls[i] = 3;
    }
  }
  // Spell-applied weapon buff stamped on this instance (Magic
  // Weapon, Elemental Weapon, etc.). Adds a flat damage bonus to
  // the existing ability-mod + dice-modifier roll. Distinct from
  // the generic effect-stack 'damage' modifier because the buff is
  // weapon-specific to this exact instance.
  const weaponBuffDamageBonus = weaponInstance.temporaryBuff?.damageBonus ?? 0;
  // Slice 117: consume the effect stack's 'damage' modifier sum.
  // Predicate-gated entries (Dueling: melee + off-hand-no-weapon;
  // Frenzy: melee) use the facts populated below. Predicate-less
  // entries apply unconditionally. Two new facts: `event.attackKind`
  // (already populated for attack-bonus) and `bearer.offHandHasWeapon`
  // (off-hand slot holds an item whose def is `itemKind: 'weapon'`).
  const offHandInstanceId = attacker.equipped.offHand;
  const offHandInstance = offHandInstanceId !== undefined
    ? state.itemInstances[offHandInstanceId]
    : undefined;
  const offHandDef = offHandInstance !== undefined
    ? content.items.get(offHandInstance.definitionId)
    : undefined;
  const damageFacts = new Map<string, unknown>([
    ['event.attackKind', weaponDef.attackKind],
    ['bearer.offHandHasWeapon', offHandDef?.itemKind === 'weapon'],
    // Slice 204: damage type fact for consistency with cast-spell.ts.
    // Lets predicate-gated AddModifier effects scope to weapon-attack
    // damage types (no canonical user today; future content can use it).
    ['event.damageType', weaponDef.damageType],
  ]);
  const damageModifierBonus = attackerEffects.modifierSum('damage', damageFacts);
  const damageRollPayload: DamageRoll = {
    expression: damageExpression,
    rolls: damageRolls,
    modifier: damageAbilityMod + parsed.modifier + weaponBuffDamageBonus + damageModifierBonus,
    type: weaponDef.damageType,
  };

  // Item-buff extra-damage rider (Elemental Weapon: +1d4/2d4/3d4 of
  // chosen type per hit). Rolled here so the dice are baked into the
  // resolution event and the replay path is RNG-free. Crits double the
  // extra dice per RAW.
  const extraDamageRoll = buildBuffExtraDamageRoll(weaponInstance.temporaryBuff, rng, critical);

  const damageRolled: DamageRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DamageRolled',
    attackerId: input.attackerId,
    targetId: input.targetId,
    weaponInstanceId: input.weaponInstanceId,
    rolls: extraDamageRoll === undefined ? [damageRollPayload] : [damageRollPayload, extraDamageRoll],
    critical,
    causedByEventId: attackRolled.id,
  };

  const damageTotal = damageRolls.reduce((s, v) => s + v, 0) + damageRollPayload.modifier;
  const rawComponents: { amount: number; type: typeof weaponDef.damageType }[] = [
    { amount: Math.max(0, damageTotal), type: weaponDef.damageType },
  ];
  if (extraDamageRoll !== undefined) {
    const extraTotal = extraDamageRoll.rolls.reduce((s, v) => s + v, 0) + extraDamageRoll.modifier;
    rawComponents.push({ amount: Math.max(0, extraTotal), type: extraDamageRoll.type });
  }
  const mitigatedComponents = mitigateDamage({
    character: target,
    itemInstances: state.itemInstances,
    content,
    rawComponents,
    characters: state.characters,
    sourceIsMagical: isMagicWeaponAttack(weaponInstance, weaponDef, attackerEffects.hasUnarmedAsMagical()),
  });
  // Slice 111: simulate prior-rider damage so the Death Ward intercept
  // sees the target's HP at the moment the main damage event commits.
  // Without applyAll here, a rider that dropped the target's HP to a
  // sliver would still be ignored when scaling the main damage.
  const stateBeforeMainDamage = applyAll(state, [attackRolled, ...attackTriggers, damageRolled]);
  const intercept = interceptFatalDamage({
    state: stateBeforeMainDamage,
    content,
    targetId: input.targetId,
    mitigatedComponents,
    causedByEventId: damageRolled.id,
    at,
  });
  const damageApplied: DamageAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DamageApplied',
    targetId: input.targetId,
    components: intercept.components,
    causedByEventId: damageRolled.id,
  };
  const concentrationBreak = planConcentrationBreakOnDrop(
    target,
    intercept.components,
    damageApplied.id,
    at,
  );

  return [
    attackRolled,
    ...attackTriggers,
    damageRolled,
    damageApplied,
    ...intercept.extraEvents,
    ...concentrationBreak,
  ];
};

/**
 * Throws if the attacker can't physically reach the target with the
 * given weapon, given both combatants' current positions on the
 * active encounter. Skipped when either side has no position set —
 * preserves out-of-encounter / unpositioned-combatant test fixtures
 * that have always relied on the engine not caring about geometry.
 *
 * Melee weapons: Chebyshev distance ≤ 5 ft, or ≤ 10 ft if the weapon
 * has the `reach` property.
 * Ranged weapons (including thrown daggers with rangeNormal set): the
 * 2024 hard cap is the weapon's long range; in the band between
 * normal and long, the engine should impose disadvantage, but that's
 * an additional fix — for now we only reject the impossible.
 */
const assertWeaponInRange = (
  state: CampaignState,
  content: ResolvedContent,
  intent: AttackIntent,
): void => {
  const encounter = state.activeEncounterId
    ? state.encounters[state.activeEncounterId]
    : undefined;
  if (!encounter) return;
  const attackerCb = encounter.combatants.find((c) => c.combatantId === intent.attackerId);
  const targetCb = encounter.combatants.find((c) => c.combatantId === intent.targetId);
  if (!attackerCb?.position || !targetCb?.position) return;

  const weaponInstance = state.itemInstances[intent.weaponInstanceId];
  if (!weaponInstance) return;
  const weaponDef = content.items.get(weaponInstance.definitionId);
  if (!weaponDef || weaponDef.itemKind !== 'weapon') return;

  const attackerName = state.characters[intent.attackerId]?.name ?? intent.attackerId;
  const distance = chebyshevDistance(attackerCb.position, targetCb.position);

  if (weaponDef.attackKind === 'melee') {
    const maxReach = weaponDef.properties.includes('reach')
      ? REACH_PROPERTY_FEET
      : DEFAULT_MELEE_REACH_FEET;
    if (distance > maxReach) {
      throw new Error(
        `${attackerName}'s ${weaponDef.name} can't reach: target is ${distance}ft away (reach ${maxReach}ft)`,
      );
    }
    return;
  }

  // attackKind === 'ranged': cap at the weapon's long range if set,
  // otherwise normal range. RAW disadvantage in the (normal, long]
  // band is deferred to a follow-up fix.
  const cap = weaponDef.rangeLong ?? weaponDef.rangeNormal;
  if (cap === undefined) return; // No range data — leave unenforced.
  if (distance > cap) {
    throw new Error(
      `${attackerName}'s ${weaponDef.name} can't reach: target is ${distance}ft away (max ${cap}ft)`,
    );
  }
};

export const planAttack = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: AttackIntent,
): ReadonlyArray<Event> => {
  const attacker = state.characters[intent.attackerId];
  if (attacker) assertActorCanAct(attacker, 'Attack');
  // RAW Appendix "Charmed": "the charmed creature can't attack the
  // charmer or target the charmer with harmful Abilities or magical
  // Effects." If the attacker carries a Charmed condition sourced by
  // the intended target, reject.
  if (attacker !== undefined) {
    const charmedBy = attacker.appliedConditions.find(
      (c) => c.conditionId === 'charmed' && c.sourceCharacterId === intent.targetId,
    );
    if (charmedBy !== undefined) {
      const targetName = state.characters[intent.targetId]?.name ?? intent.targetId;
      throw new Error(
        `${attacker.name} is Charmed by ${targetName} and cannot attack them`,
      );
    }
  }
  // RAW Equipment "Loading": a weapon with the Loading property can
  // fire only one piece of ammunition per attack action / bonus action
  // / reaction (regardless of Extra Attack / multiattack). Block the
  // second attempt with the same Loading weapon in the same turn.
  // Tracked on Combatant.turnUsage.loadedWeaponsFiredThisTurn; reset
  // on TurnStarted alongside the other per-turn flags.
  const encounter = state.activeEncounterId
    ? state.encounters[state.activeEncounterId]
    : undefined;
  const attackerCb = encounter?.combatants.find((c) => c.combatantId === intent.attackerId);
  const weaponInstance = state.itemInstances[intent.weaponInstanceId];
  const weaponDef = weaponInstance
    ? content.items.get(weaponInstance.definitionId)
    : undefined;
  const weaponIsLoading =
    weaponDef?.itemKind === 'weapon' && weaponDef.properties.includes('loading');
  if (
    weaponIsLoading &&
    attackerCb?.turnUsage.loadedWeaponsFiredThisTurn.includes(intent.weaponInstanceId)
  ) {
    throw new Error(
      `${attacker?.name ?? intent.attackerId} cannot fire ${weaponDef?.name ?? 'this Loading weapon'} again this turn (Loading property)`,
    );
  }
  const economyPrelude = planActionEconomyForAttack(state, content, intent);
  assertWeaponInRange(state, content, intent);
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
  // If we fired a Loading weapon, append a WeaponLoaded event so the
  // reducer records it in turnUsage. Second attempt this turn will
  // hit the guard above.
  const tail: Event[] = [];
  if (weaponIsLoading && encounter !== undefined) {
    tail.push({
      id: newEventId() as ULID,
      at,
      type: 'WeaponLoaded',
      encounterId: encounter.id,
      combatantId: intent.attackerId,
      weaponInstanceId: intent.weaponInstanceId,
    });
  }
  return [...economyPrelude, ...resolution, ...tail];
};

const CLEAVE_TRIGGER_ID = 'mastery:cleave';

export interface CleaveIntent {
  readonly type: 'Cleave';
  readonly attackerId: string;
  readonly secondaryTargetId: string;
  readonly weaponInstanceId: string;
  readonly triggeringAttackEventId: string;
  readonly at?: string;
}

/**
 * RAW 2024 Cleave: after hitting a creature with a melee attack using a
 * weapon with the Cleave mastery, the attacker may attack a second
 * creature within 5 ft of the first (also within reach). The second
 * attack uses the same weapon; on a hit it deals the weapon's damage,
 * but the attacker doesn't add their ability modifier to that damage
 * unless the modifier is negative. Once per turn.
 *
 * The consumer calls this AFTER the triggering attack has been planned
 * and committed (so they know it hit). The engine validates that the
 * weapon has Cleave mastery and that Cleave hasn't already been used
 * this turn (via the `mastery:cleave` trigger counter).
 *
 * The 5-ft adjacency check is not enforced — the engine doesn't always
 * know primary-target position. The consumer is responsible for picking
 * a legal secondary target.
 */
export const planCleave = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: CleaveIntent,
): ReadonlyArray<Event> => {
  const attacker = state.characters[intent.attackerId];
  if (!attacker) throw new Error(`Unknown attacker ${intent.attackerId}`);
  const weaponInstance = state.itemInstances[intent.weaponInstanceId];
  if (!weaponInstance) throw new Error(`Unknown weapon ${intent.weaponInstanceId}`);
  const weaponDef = content.items.get(weaponInstance.definitionId);
  if (!weaponDef || weaponDef.itemKind !== 'weapon') {
    throw new Error(`Item ${weaponInstance.definitionId} is not a weapon`);
  }
  if (weaponDef.mastery !== 'Cleave') {
    throw new Error(`Weapon ${weaponDef.name} does not have the Cleave mastery`);
  }
  if (weaponDef.attackKind !== 'melee') {
    throw new Error('Cleave requires a melee weapon');
  }
  if (attacker.triggerCounters[CLEAVE_TRIGGER_ID]?.firedThisTurn === true) {
    throw new Error('Cleave already used this turn');
  }

  const at = intent.at ?? nowIso();
  const events: Event[] = [];

  const resolution = resolveAttack({
    state,
    content,
    rng,
    attackerId: intent.attackerId,
    targetId: intent.secondaryTargetId,
    weaponInstanceId: intent.weaponInstanceId,
    at,
  });

  // Strip the attacker's ability modifier from the DamageRolled and
  // DamageApplied events on the cleave hit, per RAW. Keep negative
  // ability modifiers (a -1 STR penalty still applies). Slice 229:
  // honor the OverrideAbilityScore floor so cleave's strip matches
  // whatever the primary hit used (Gauntlets of Ogre Power etc.).
  const damageAbility = chooseDamageAbility(attacker, weaponDef);
  const cleaveAttackerEffects = buildEffectStack({
    character: attacker,
    content,
    itemInstances: state.itemInstances,
    pendingChoices: state.pendingChoices,
  });
  const cleaveBaseScore = attacker.abilityScores[damageAbility];
  const cleaveScoreFloor = cleaveAttackerEffects.effectiveAbilityScoreFloor(damageAbility)?.value;
  const abilityMod = abilityModifier(effectiveAbilityScore(cleaveBaseScore, cleaveScoreFloor));
  const abilityModToStrip = abilityMod > 0 ? abilityMod : 0;

  for (const evt of resolution) {
    if (evt.type === 'DamageRolled' && abilityModToStrip > 0) {
      const adjusted = {
        ...evt,
        rolls: evt.rolls.map((r) => ({
          ...r,
          modifier: r.modifier - abilityModToStrip,
        })),
      };
      events.push(adjusted);
    } else if (evt.type === 'DamageApplied' && abilityModToStrip > 0) {
      // Reduce each mitigated component by the proportion attributable
      // to the ability modifier. Simplest correct treatment: subtract
      // the ability mod from the *first* component (representing the
      // weapon's primary damage type) and clamp to 0. Multi-type damage
      // from Cleave is rare — the mastery is on weapons that deal a
      // single damage type — so this is fine in practice.
      const components = [...evt.components];
      const first = components[0];
      if (first !== undefined) {
        const reduced = Math.max(0, first.amount - abilityModToStrip);
        components[0] = { ...first, amount: reduced };
      }
      events.push({ ...evt, components });
    } else {
      events.push(evt);
    }
  }

  events.push({
    id: newEventId() as ULID,
    at,
    type: 'TriggerFired',
    characterId: intent.attackerId,
    triggerId: CLEAVE_TRIGGER_ID,
    cadence: { firedThisTurn: true },
    causedByEventId: intent.triggeringAttackEventId as ULID,
  });

  return events;
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
    characters: state.characters,
  });

  if (active.actionUsed && active.attacksMadeThisTurn === 0) {
    throw new Error(
      `${attacker.name} has already used their action this turn (Dodge/Dash/Disengage/Cast Spell); cannot also Attack`,
    );
  }
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
