import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { ResolvedContent } from '../content/pack.js';
import type { AbilityScore } from '../schemas/primitives.js';
import { abilityModifier, proficiencyBonus } from './ability.js';
import { buildEffectStack } from './effect-stack.js';
import { computeTotalLevel } from '../schemas/runtime/character.js';
import { EXHAUSTION_SAVE_PENALTY_PER_LEVEL } from '../internal/constants.js';

export interface SaveBreakdownEntry {
  readonly source: string;
  readonly value: number;
}

export interface SaveResult {
  readonly total: number;
  readonly breakdown: ReadonlyArray<SaveBreakdownEntry>;
  readonly hasAdvantage: boolean;
  readonly hasDisadvantage: boolean;
}

export interface ComputeSaveInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
  readonly ability: AbilityScore;
  readonly pendingChoices?: Readonly<Record<string, import('../schemas/runtime/pending-choice.js').PendingChoice>>;
  // Optional: when provided, source-relative formulas on the
  // target's applied conditions (Aura of Protection's +CHA-mod-of-
  // source, etc.) resolve via the linked source character. Omitting
  // it makes those formulas evaluate to 0.
  readonly characters?: Readonly<Record<string, Character>>;
}

const isSaveProficient = (character: Character, ability: AbilityScore, content: ResolvedContent): boolean => {
  for (const enrollment of character.classes) {
    const cls = content.classes.get(enrollment.classId);
    if (cls?.savingThrowProficiencies.includes(ability)) return true;
  }
  return false;
};

export const computeSavingThrow = (input: ComputeSaveInput): SaveResult => {
  const breakdown: SaveBreakdownEntry[] = [];
  const abilityMod = abilityModifier(input.character.abilityScores[input.ability]);
  breakdown.push({ source: `${input.ability}-mod`, value: abilityMod });

  const totalLevel = computeTotalLevel(input.character);
  if (isSaveProficient(input.character, input.ability, input.content)) {
    breakdown.push({ source: 'proficiency', value: proficiencyBonus(totalLevel) });
  }

  const effects = buildEffectStack(input);
  const target = { kind: 'save', ability: input.ability } as const;
  const modifierBonus = effects.modifierSum(target);
  if (modifierBonus !== 0) {
    breakdown.push({ source: 'modifier', value: modifierBonus });
  }

  if (input.character.exhaustion > 0) {
    const penalty = EXHAUSTION_SAVE_PENALTY_PER_LEVEL * input.character.exhaustion;
    breakdown.push({ source: 'exhaustion', value: penalty });
  }

  const adv = effects.advantageFor(target);
  const total = breakdown.reduce((acc, e) => acc + e.value, 0);
  return {
    total,
    breakdown,
    hasAdvantage: adv.advantage && !adv.disadvantage,
    hasDisadvantage: adv.disadvantage && !adv.advantage,
  };
};
