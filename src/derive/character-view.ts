import type { Character, HP } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { PendingChoice } from '../schemas/runtime/pending-choice.js';
import type { ResolvedContent } from '../content/pack.js';
import type { AbilityScore } from '../schemas/primitives.js';
import { abilityModifier, proficiencyBonus } from './ability.js';
import { computeTotalLevel } from '../schemas/runtime/character.js';
import { computeAC, type ACResult } from './ac.js';
import { computeSavingThrow, type SaveResult } from './save.js';
import { computeSpellSlots, type SpellSlotsResult } from './spell-slots.js';
import { buildEffectStack } from './effect-stack.js';

const ABILITIES: ReadonlyArray<AbilityScore> = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export interface DerivedCharacter {
  readonly id: string;
  readonly name: string;
  readonly totalLevel: number;
  readonly proficiencyBonus: number;
  readonly abilityModifiers: Readonly<Record<AbilityScore, number>>;
  readonly hp: HP;
  // Sum of `AddModifier { target: 'hpMax' }` effects from the character's
  // active effect stack (Aid, Aspect of the Beast, etc.). The stored
  // `hp.max` does not include this; consumers display
  // `effectiveHpMax = hp.max + hpMaxBonus`. Reducer-side rules (massive
  // damage threshold, heal clamping) still use the stored `hp.max`.
  readonly hpMaxBonus: number;
  readonly effectiveHpMax: number;
  readonly ac: ACResult;
  readonly savingThrows: Readonly<Record<AbilityScore, SaveResult>>;
  readonly spellSlots: SpellSlotsResult;
  readonly hasPendingChoices: boolean;
  readonly pendingChoiceIds: ReadonlyArray<string>;
}

export interface ComputeDerivedCharacterInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
  readonly pendingChoices?: Readonly<Record<string, PendingChoice>>;
}

export const computeDerivedCharacter = (
  input: ComputeDerivedCharacterInput,
): DerivedCharacter => {
  const totalLevel = computeTotalLevel(input.character);
  const abilityMods = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(input.character.abilityScores[a])]),
  ) as Record<AbilityScore, number>;

  const ac = computeAC(input);
  const savingThrows = Object.fromEntries(
    ABILITIES.map((a) => [a, computeSavingThrow({ ...input, ability: a })]),
  ) as Record<AbilityScore, SaveResult>;
  const hpMaxBonus = buildEffectStack(input).modifierSum('hpMax');

  return {
    id: input.character.id,
    name: input.character.name,
    totalLevel,
    proficiencyBonus: proficiencyBonus(totalLevel),
    abilityModifiers: abilityMods,
    hp: input.character.hp,
    hpMaxBonus,
    effectiveHpMax: input.character.hp.max + hpMaxBonus,
    ac,
    savingThrows,
    spellSlots: computeSpellSlots(input.character, input.content.classes),
    hasPendingChoices: input.character.pendingChoiceIds.some(
      (id) => input.pendingChoices?.[id]?.resolution === undefined,
    ) || (input.pendingChoices === undefined && input.character.pendingChoiceIds.length > 0),
    pendingChoiceIds: [...input.character.pendingChoiceIds],
  };
};
