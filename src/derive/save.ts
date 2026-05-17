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
  // Slice 131: tells the save resolver whether the saving throw is
  // against a spell or magical effect. When true and the character
  // carries `GrantMagicResistance`, the resolver contributes advantage
  // to the roll. Default (undefined / false) is non-magical (e.g.
  // monster Multiattack save, Stunning Strike, etc.). Callers from
  // magical sources (cast-spell, traps spell-armed, recurring saves
  // on spell-applied conditions, etc.) pass `true`.
  readonly sourceIsMagical?: boolean;
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

  // Slice 130: when the character is a creature with a statblock that
  // lists this ability's save bonus, RAW says the listed number is the
  // baked total (already includes ability mod and proficiency per the
  // 2024 MM presentation). Use it as a single breakdown entry and
  // skip the ability-mod + class-proficiency reconstruction. Effects,
  // exhaustion, and advantage still layer on top.
  const statblock = input.character.statblockId !== undefined
    ? input.content.monsters.get(input.character.statblockId)
    : undefined;
  const monsterSaveBonus = statblock?.savingThrows?.[input.ability];

  if (monsterSaveBonus !== undefined) {
    breakdown.push({ source: `monster:${statblock!.id}:save`, value: monsterSaveBonus });
  } else {
    const abilityMod = abilityModifier(input.character.abilityScores[input.ability]);
    breakdown.push({ source: `${input.ability}-mod`, value: abilityMod });

    const totalLevel = computeTotalLevel(input.character);
    if (isSaveProficient(input.character, input.ability, input.content)) {
      breakdown.push({ source: 'proficiency', value: proficiencyBonus(totalLevel) });
    }
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
  // Slice 131: Magic Resistance contributes advantage to the save
  // when the source is magical. RAW advantage / disadvantage
  // cancellation still applies (a creature with both Magic Resistance
  // and a separate disadvantage source nets neither).
  const magicResistanceAdvantage =
    input.sourceIsMagical === true && effects.hasMagicResistance();
  const effectiveAdvantage = adv.advantage || magicResistanceAdvantage;
  const total = breakdown.reduce((acc, e) => acc + e.value, 0);
  return {
    total,
    breakdown,
    hasAdvantage: effectiveAdvantage && !adv.disadvantage,
    hasDisadvantage: adv.disadvantage && !effectiveAdvantage,
  };
};
