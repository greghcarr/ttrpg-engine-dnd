import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { PendingChoice } from '../schemas/runtime/pending-choice.js';
import type { ResolvedContent } from '../content/pack.js';
import type { DamageComponent } from '../schemas/events/combat.js';
import type { DamageType } from '../schemas/primitives.js';
import { buildEffectStack } from './effect-stack.js';

const RESISTANCE_DIVISOR = 2;
const VULNERABILITY_MULTIPLIER = 2;

export interface MitigateDamageInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
  readonly pendingChoices?: Readonly<Record<string, PendingChoice>>;
  readonly rawComponents: ReadonlyArray<{ readonly amount: number; readonly type: DamageType }>;
  // Optional: enables source-relative formulas (`sourceAbilityMod`)
  // on condition effects that touch flat damage reduction. Callers
  // without source-relative content can omit.
  readonly characters?: Readonly<Record<string, Character>>;
  // Slice 112: tells the resistance check whether the damage source
  // is magical so GrantResistance entries with a `qualifier` are
  // honored correctly. Default (undefined) is treated as non-magical,
  // matching the common case of physical-attack damage. Spell-sourced
  // damage emitters pass `true`; falling / mundane-weapon damage
  // emitters omit (or pass `false`).
  readonly sourceIsMagical?: boolean;
}

const halfRoundDown = (n: number): number => Math.floor(n / RESISTANCE_DIVISOR);

export const mitigateDamage = (input: MitigateDamageInput): DamageComponent[] => {
  const effects = buildEffectStack(input);
  return input.rawComponents.map((component) => {
    const rawAmount = component.amount;
    const flatReduction = effects.flatDamageReductionFor(component.type);
    const afterFlat = Math.max(0, rawAmount - flatReduction);

    if (effects.hasImmunity(component.type)) {
      return { amount: 0, type: component.type, rawAmount, mitigation: 'immune' };
    }
    if (effects.hasVulnerability(component.type)) {
      return {
        amount: afterFlat * VULNERABILITY_MULTIPLIER,
        type: component.type,
        rawAmount,
        mitigation: 'vulnerable',
      };
    }
    if (effects.hasResistance(component.type, input.sourceIsMagical)) {
      return {
        amount: halfRoundDown(afterFlat),
        type: component.type,
        rawAmount,
        mitigation: 'resisted',
      };
    }
    if (flatReduction > 0) {
      return {
        amount: afterFlat,
        type: component.type,
        rawAmount,
        mitigation: 'resisted',
      };
    }
    return { amount: rawAmount, type: component.type };
  });
};
