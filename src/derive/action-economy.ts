import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { PendingChoice } from '../schemas/runtime/pending-choice.js';
import type { ResolvedContent } from '../content/pack.js';
import { buildEffectStack } from './effect-stack.js';

const BASE_ATTACKS_PER_ACTION = 1;

export interface ComputeActionEconomyInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
  readonly pendingChoices?: Readonly<Record<string, PendingChoice>>;
  // Optional: enables source-relative formulas (`sourceAbilityMod`)
  // on condition effects that touch action-economy modifiers.
  readonly characters?: Readonly<Record<string, Character>>;
}

export interface ActionEconomyBudget {
  readonly maxAttacksPerAction: number;
  readonly extraActionsPerTurn: number;
  readonly extraBonusActionsPerTurn: number;
}

export const computeActionEconomyBudget = (
  input: ComputeActionEconomyInput,
): ActionEconomyBudget => {
  const effects = buildEffectStack(input);
  return {
    maxAttacksPerAction: BASE_ATTACKS_PER_ACTION + effects.actionEconomyTotal('extraAttack'),
    extraActionsPerTurn: effects.actionEconomyTotal('extraAction'),
    extraBonusActionsPerTurn: effects.actionEconomyTotal('extraBonusAction'),
  };
};
