import type { CharacterLevel } from '../schemas/primitives.js';

export const ABILITY_SCORE_MIN = 1;
export const ABILITY_SCORE_MAX = 30;
export const PROFICIENCY_BONUS_LEVEL_MIN = 1;
export const PROFICIENCY_BONUS_LEVEL_MAX = 20;

// Slice 229. Applies an `OverrideAbilityScore`-style floor to a base
// ability score: if `floor` is provided and greater than `baseScore`,
// returns `floor`; otherwise returns `baseScore`. Callers that build
// an EffectAccumulator pass `effects.effectiveAbilityScoreFloor(ability)?.value`
// here so the canonical AbilityScore-floor primitive (Amulet of
// Health, Gauntlets of Ogre Power, Belt of Giant Strength variants)
// participates in every derivation that consumes the score.
export const effectiveAbilityScore = (baseScore: number, floor?: number): number => {
  if (floor === undefined) return baseScore;
  return Math.max(baseScore, floor);
};

export const abilityModifier = (score: number): number => {
  if (!Number.isInteger(score)) {
    throw new Error(`abilityModifier requires an integer; got ${score}`);
  }
  if (score < ABILITY_SCORE_MIN || score > ABILITY_SCORE_MAX) {
    throw new Error(
      `abilityModifier: score ${score} out of range [${ABILITY_SCORE_MIN}, ${ABILITY_SCORE_MAX}]`,
    );
  }
  return Math.floor((score - 10) / 2);
};

export const proficiencyBonus = (level: number): number => {
  if (!Number.isInteger(level)) {
    throw new Error(`proficiencyBonus requires an integer level; got ${level}`);
  }
  if (level < PROFICIENCY_BONUS_LEVEL_MIN || level > PROFICIENCY_BONUS_LEVEL_MAX) {
    throw new Error(
      `proficiencyBonus: level ${level} out of range [${PROFICIENCY_BONUS_LEVEL_MIN}, ${PROFICIENCY_BONUS_LEVEL_MAX}]`,
    );
  }
  return Math.floor((level - 1) / 4) + 2;
};

export const proficiencyBonusForCharacterLevel = (level: CharacterLevel): number =>
  proficiencyBonus(level);
