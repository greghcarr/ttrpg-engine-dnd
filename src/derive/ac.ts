import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { ResolvedContent } from '../content/pack.js';
import { abilityModifier } from './ability.js';
import { buildEffectStack } from './effect-stack.js';
import type { EffectAccumulator } from '../effects/builder.js';

const UNARMORED_BASE = 10;

export interface ACBreakdownEntry {
  readonly source: string;
  readonly value: number;
}

export interface ACResult {
  readonly total: number;
  readonly breakdown: ReadonlyArray<ACBreakdownEntry>;
}

const computeArmorAC = (
  character: Character,
  itemInstances: Readonly<Record<string, ItemInstance>>,
  content: ResolvedContent,
): ACBreakdownEntry[] => {
  const breakdown: ACBreakdownEntry[] = [];
  const armorInstanceId = character.equipped.armor;
  const dexMod = abilityModifier(character.abilityScores.DEX);

  if (armorInstanceId !== undefined) {
    const armorInstance = itemInstances[armorInstanceId];
    const armorDef = armorInstance ? content.items.get(armorInstance.definitionId) : undefined;
    if (armorDef && armorDef.itemKind === 'armor' && armorDef.category !== 'shield') {
      breakdown.push({ source: `armor:${armorDef.id}`, value: armorDef.baseAC });
      const dexContribution =
        armorDef.dexCap === undefined
          ? dexMod
          : Math.min(dexMod, armorDef.dexCap);
      if (armorDef.category !== 'heavy') {
        breakdown.push({ source: 'DEX', value: dexContribution });
      }
    } else {
      breakdown.push({ source: 'unarmored-base', value: UNARMORED_BASE });
      breakdown.push({ source: 'DEX', value: dexMod });
    }
  } else {
    breakdown.push({ source: 'unarmored-base', value: UNARMORED_BASE });
    breakdown.push({ source: 'DEX', value: dexMod });
  }

  const shieldInstanceId = character.equipped.shield;
  if (shieldInstanceId !== undefined) {
    const shieldInstance = itemInstances[shieldInstanceId];
    const shieldDef = shieldInstance ? content.items.get(shieldInstance.definitionId) : undefined;
    if (shieldDef && shieldDef.itemKind === 'armor' && shieldDef.category === 'shield') {
      breakdown.push({ source: `shield:${shieldDef.id}`, value: shieldDef.baseAC });
    }
  }
  return breakdown;
};

const computeUnarmoredOverrideAC = (
  character: Character,
  effects: EffectAccumulator,
): ACBreakdownEntry[] | null => {
  const override = effects.effectiveACOverride();
  if (!override) return null;
  const breakdown: ACBreakdownEntry[] = [];
  const baseValue =
    typeof override.base === 'number'
      ? override.base
      : override.base === 'dex'
        ? abilityModifier(character.abilityScores.DEX)
        : override.base === 'con'
          ? abilityModifier(character.abilityScores.CON)
          : abilityModifier(character.abilityScores.WIS);
  breakdown.push({ source: `override-base:${override.source}`, value: baseValue });

  for (const ability of override.abilityModifiers) {
    const mod = abilityModifier(character.abilityScores[ability]);
    const capped = override.dexCap !== undefined && ability === 'DEX'
      ? Math.min(mod, override.dexCap)
      : mod;
    breakdown.push({ source: `${ability}-mod`, value: capped });
  }

  const shieldInstanceId = character.equipped.shield;
  if (shieldInstanceId !== undefined) {
    breakdown.push({ source: 'shield', value: 2 });
  }
  return breakdown;
};

export interface ComputeACInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
  readonly pendingChoices?: Readonly<Record<string, import('../schemas/runtime/pending-choice.js').PendingChoice>>;
}

export const computeAC = (input: ComputeACInput): ACResult => {
  const effects = buildEffectStack(input);

  // A flat `armorClass` on the character takes precedence over equipment
  // and effect-based overrides. It's used by creatures whose AC comes
  // from natural armor (hide, scales, plate-skin) declared on a statblock
  // or by polymorph forms (which copy the form's AC onto the character).
  // Modifiers (+1 cloak, shield from effects, etc.) still stack on top.
  if (input.character.armorClass !== undefined) {
    const breakdown: ACBreakdownEntry[] = [
      { source: 'natural-armor', value: input.character.armorClass },
    ];
    const modifierBonus = effects.modifierSum('ac');
    if (modifierBonus !== 0) {
      breakdown.push({ source: 'modifier', value: modifierBonus });
    }
    const total = breakdown.reduce((acc, entry) => acc + entry.value, 0);
    return { total, breakdown };
  }

  const armorInstanceId = input.character.equipped.armor;

  let breakdown: ACBreakdownEntry[];
  if (armorInstanceId === undefined) {
    const override = computeUnarmoredOverrideAC(input.character, effects);
    breakdown = override ?? computeArmorAC(input.character, input.itemInstances, input.content);
  } else {
    breakdown = computeArmorAC(input.character, input.itemInstances, input.content);
  }

  const modifierBonus = effects.modifierSum('ac');
  if (modifierBonus !== 0) {
    breakdown.push({ source: 'modifier', value: modifierBonus });
  }

  const total = breakdown.reduce((acc, entry) => acc + entry.value, 0);
  return { total, breakdown };
};
