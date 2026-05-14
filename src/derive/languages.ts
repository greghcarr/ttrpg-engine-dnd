import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { PendingChoice } from '../schemas/runtime/pending-choice.js';
import type { ResolvedContent } from '../content/pack.js';
import { buildEffectStack } from './effect-stack.js';

export interface ComputeKnownLanguagesInput {
  readonly character: Character;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly content: ResolvedContent;
  readonly pendingChoices?: Readonly<Record<string, PendingChoice>>;
}

// Languages a character knows. Combines species + background entries
// (data-only `languages: []` arrays) with any `GrantProficiency
// target: 'language'` effects from the active effect stack (Druidic,
// Linguist-style feats, magic items, etc.). Returned sorted and
// deduplicated.
export const computeKnownLanguages = (input: ComputeKnownLanguagesInput): readonly string[] => {
  const known = new Set<string>();
  const species = input.content.species.get(input.character.speciesId);
  if (species) for (const lang of species.languages) known.add(lang);
  const background = input.content.backgrounds.get(input.character.backgroundId);
  if (background) for (const lang of background.languages) known.add(lang);
  const effects = buildEffectStack(input);
  for (const { id } of effects.proficienciesByTarget('language')) known.add(id);
  return [...known].sort();
};
