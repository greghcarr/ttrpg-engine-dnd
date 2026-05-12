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
}

const halfRoundDown = (n: number): number => Math.floor(n / RESISTANCE_DIVISOR);

export const mitigateDamage = (input: MitigateDamageInput): DamageComponent[] => {
  const effects = buildEffectStack(input);
  return input.rawComponents.map((component) => {
    if (effects.hasImmunity(component.type)) {
      return { amount: 0, type: component.type, rawAmount: component.amount, mitigation: 'immune' };
    }
    if (effects.hasVulnerability(component.type)) {
      return {
        amount: component.amount * VULNERABILITY_MULTIPLIER,
        type: component.type,
        rawAmount: component.amount,
        mitigation: 'vulnerable',
      };
    }
    if (effects.hasResistance(component.type)) {
      return {
        amount: halfRoundDown(component.amount),
        type: component.type,
        rawAmount: component.amount,
        mitigation: 'resisted',
      };
    }
    return { amount: component.amount, type: component.type };
  });
};
