import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { ResolvedContent } from '../content/pack.js';
import { abilityModifier, proficiencyBonus } from './ability.js';
import { buildEffectStack } from './effect-stack.js';
import { computeTotalLevel } from '../schemas/runtime/character.js';
import type { Weapon } from '../schemas/content/item.js';

export interface AttackBreakdownEntry {
  readonly source: string;
  readonly value: number;
}

export interface AttackResult {
  readonly total: number;
  readonly breakdown: ReadonlyArray<AttackBreakdownEntry>;
}

export interface ComputeAttackInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
  readonly weaponInstanceId: string;
  readonly pendingChoices?: Readonly<Record<string, import('../schemas/runtime/pending-choice.js').PendingChoice>>;
}

const chooseAttackAbility = (character: Character, weapon: Weapon): 'STR' | 'DEX' => {
  const isFinesse = weapon.properties.includes('finesse');
  const isRanged = weapon.attackKind === 'ranged';
  if (isRanged && !weapon.properties.includes('thrown')) return 'DEX';
  if (isFinesse) {
    return abilityModifier(character.abilityScores.DEX) >=
      abilityModifier(character.abilityScores.STR)
      ? 'DEX'
      : 'STR';
  }
  return 'STR';
};

const isWeaponProficient = (
  character: Character,
  weapon: Weapon,
  content: ResolvedContent,
): boolean => {
  for (const enrollment of character.classes) {
    const cls = content.classes.get(enrollment.classId);
    if (!cls) continue;
    if (cls.weaponProficiencies.includes(weapon.id)) return true;
    if (cls.weaponProficiencies.includes(weapon.category)) return true;
    if (cls.weaponProficiencies.includes('all')) return true;
  }
  return false;
};

export const computeAttackBonus = (input: ComputeAttackInput): AttackResult => {
  const instance = input.itemInstances[input.weaponInstanceId];
  if (!instance) {
    throw new Error(`Unknown weapon instance: ${input.weaponInstanceId}`);
  }
  const def = input.content.items.get(instance.definitionId);
  if (!def || def.itemKind !== 'weapon') {
    throw new Error(
      `Item instance ${input.weaponInstanceId} is not a weapon (definition ${instance.definitionId})`,
    );
  }
  const weapon = def;

  const ability = chooseAttackAbility(input.character, weapon);
  const breakdown: AttackBreakdownEntry[] = [
    { source: `${ability}-mod`, value: abilityModifier(input.character.abilityScores[ability]) },
  ];

  if (isWeaponProficient(input.character, weapon, input.content)) {
    breakdown.push({
      source: 'proficiency',
      value: proficiencyBonus(computeTotalLevel(input.character)),
    });
  }

  const effects = buildEffectStack(input);
  const modifierBonus = effects.modifierSum('attack');
  if (modifierBonus !== 0) breakdown.push({ source: 'modifier', value: modifierBonus });

  // Spell-applied temporary buff stamped on this specific weapon
  // instance (Magic Weapon's +N, etc.). Distinct from the generic
  // 'attack' modifier sum because the buff is weapon-specific —
  // only this weapon's attacks get the bonus.
  if (instance.temporaryBuff !== undefined && instance.temporaryBuff.attackBonus !== 0) {
    breakdown.push({
      source: instance.temporaryBuff.source ?? 'weapon-buff',
      value: instance.temporaryBuff.attackBonus,
    });
  }

  const total = breakdown.reduce((acc, e) => acc + e.value, 0);
  return { total, breakdown };
};
