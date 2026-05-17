import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { PendingChoice } from '../schemas/runtime/pending-choice.js';
import type { ResolvedContent } from '../content/pack.js';
import type { AbilityScore, Skill } from '../schemas/primitives.js';
import { SKILL_ABILITY, PROFICIENCY_MULTIPLIER } from '../schemas/primitives.js';
import { abilityModifier, proficiencyBonus } from './ability.js';
import { computeTotalLevel } from '../schemas/runtime/character.js';
import { buildEffectStack } from './effect-stack.js';
import { EXHAUSTION_SAVE_PENALTY_PER_LEVEL } from '../internal/constants.js';

export interface AbilityCheckBreakdownEntry {
  readonly source: string;
  readonly value: number;
}

export interface AbilityCheckResult {
  readonly total: number;
  readonly breakdown: ReadonlyArray<AbilityCheckBreakdownEntry>;
  readonly hasAdvantage: boolean;
  readonly hasDisadvantage: boolean;
}

export interface ComputeAbilityCheckInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
  readonly ability: AbilityScore;
  readonly skill?: Skill;
  readonly pendingChoices?: Readonly<Record<string, PendingChoice>>;
  // Optional: when provided, source-relative formulas on condition
  // effects (Aura of Protection's +CHA-mod-of-source) resolve via
  // the source character's stats. Saves already thread this since
  // slice 64; slice 105 closes the same RAW gap for ability checks
  // so the Paladin's L6 Aura of Protection applies to both rolls.
  readonly characters?: Readonly<Record<string, Character>>;
}

const exhaustionPenalty = (level: number): number =>
  EXHAUSTION_SAVE_PENALTY_PER_LEVEL * level;

export const computeAbilityCheck = (input: ComputeAbilityCheckInput): AbilityCheckResult => {
  const breakdown: AbilityCheckBreakdownEntry[] = [
    { source: `${input.ability}-mod`, value: abilityModifier(input.character.abilityScores[input.ability]) },
  ];

  const effects = buildEffectStack(input);

  const fullProfBonus = proficiencyBonus(computeTotalLevel(input.character));
  // Track whether any explicit proficiency contribution is applied to
  // this check. If not, and the actor has Jack of All Trades (or any
  // GrantHalfProficiencyBonusFloor effect), apply floor(profBonus / 2)
  // as a fallback.
  let proficiencyApplied = false;
  if (input.skill !== undefined) {
    const expectedAbility = SKILL_ABILITY[input.skill];
    if (expectedAbility === input.ability) {
      const profLevel = effects.proficiencyLevel('skill', input.skill);
      const multiplier = PROFICIENCY_MULTIPLIER[profLevel];
      if (multiplier > 0) {
        const bonus = Math.floor(fullProfBonus * multiplier);
        breakdown.push({ source: `skill-prof(${profLevel})`, value: bonus });
        proficiencyApplied = true;
      }
    }
  }

  if (!proficiencyApplied && effects.hasHalfProficiencyBonusFloor()) {
    const halfProf = Math.floor(fullProfBonus / 2);
    if (halfProf > 0) {
      breakdown.push({ source: 'jack-of-all-trades', value: halfProf });
    }
  }

  const skillModifier = input.skill !== undefined
    ? effects.modifierSum({ kind: 'skill', skill: input.skill })
    : 0;
  if (skillModifier !== 0) {
    breakdown.push({ source: 'skill-modifier', value: skillModifier });
  }

  const checkModifier = effects.modifierSum({ kind: 'check', ability: input.ability });
  if (checkModifier !== 0) {
    breakdown.push({ source: 'check-modifier', value: checkModifier });
  }

  if (input.character.exhaustion > 0) {
    breakdown.push({ source: 'exhaustion', value: exhaustionPenalty(input.character.exhaustion) });
  }

  const advantageTarget = input.skill !== undefined
    ? { kind: 'skill' as const, skill: input.skill }
    : { kind: 'check' as const, ability: input.ability };
  const adv = effects.advantageFor(advantageTarget);
  const total = breakdown.reduce((sum, e) => sum + e.value, 0);
  return {
    total,
    breakdown,
    hasAdvantage: adv.advantage && !adv.disadvantage,
    hasDisadvantage: adv.disadvantage && !adv.advantage,
  };
};

export const computePassiveScore = (input: ComputeAbilityCheckInput): number => {
  const PASSIVE_BASE = 10;
  const check = computeAbilityCheck(input);
  const advantageBonus = check.hasAdvantage ? 5 : check.hasDisadvantage ? -5 : 0;
  return PASSIVE_BASE + check.total + advantageBonus;
};
