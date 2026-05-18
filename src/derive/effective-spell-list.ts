import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { PendingChoice } from '../schemas/runtime/pending-choice.js';
import type { ResolvedContent } from '../content/pack.js';
import { buildEffectStack } from './effect-stack.js';

export interface EffectiveSpellListInput {
  readonly character: Character;
  readonly content: ResolvedContent;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly pendingChoices?: Readonly<Record<string, PendingChoice>>;
}

/**
 * Returns the union of:
 *  1. `character.preparedSpells` and `character.knownSpells` (the
 *     character-state-level lists).
 *  2. Every `GrantSpell` effect collected from the bearer's effect
 *     stack (subclass domain spell lists, "extra cantrip" feature
 *     grants, magic items granting at-will casts, etc.).
 *
 * The cast-spell planner uses this to validate "can the character
 * cast this spell?" rather than checking the character-state lists
 * directly. Slice 212.
 */
export const effectiveSpellList = (input: EffectiveSpellListInput): ReadonlyArray<string> => {
  const effects = buildEffectStack(input);
  const granted = effects.grantedSpells().map((g) => g.spellId);
  return [...input.character.knownSpells, ...input.character.preparedSpells, ...granted];
};
