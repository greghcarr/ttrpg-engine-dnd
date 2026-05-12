import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { ResolvedContent } from '../content/pack.js';

const CARRYING_CAPACITY_PER_STR = 15;
const ENCUMBERED_RATIO = 5;
const HEAVILY_ENCUMBERED_RATIO = 10;

export type EncumbranceLevel = 'unencumbered' | 'encumbered' | 'heavily-encumbered';

export interface EncumbranceResult {
  readonly carriedWeight: number;
  readonly maxCarryingCapacity: number;
  readonly level: EncumbranceLevel;
}

export interface ComputeEncumbranceInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
}

export const computeCarryingCapacity = (character: Character): number =>
  character.abilityScores.STR * CARRYING_CAPACITY_PER_STR;

export const computeEncumbrance = (input: ComputeEncumbranceInput): EncumbranceResult => {
  const maxCarryingCapacity = computeCarryingCapacity(input.character);
  let carriedWeight = 0;
  for (const instanceId of input.character.inventory) {
    const instance = input.itemInstances[instanceId];
    if (!instance) continue;
    const def = input.content.items.get(instance.definitionId);
    const weight = def?.weight ?? 0;
    carriedWeight += weight * (instance.quantity ?? 1);
  }
  const encumberedThreshold = (maxCarryingCapacity * ENCUMBERED_RATIO) / HEAVILY_ENCUMBERED_RATIO;
  const heavilyEncumberedThreshold = maxCarryingCapacity;
  let level: EncumbranceLevel = 'unencumbered';
  if (carriedWeight > heavilyEncumberedThreshold) {
    level = 'heavily-encumbered';
  } else if (carriedWeight > encumberedThreshold) {
    level = 'encumbered';
  }
  return { carriedWeight, maxCarryingCapacity, level };
};
