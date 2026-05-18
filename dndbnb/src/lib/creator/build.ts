// Build the engine's `Character` shape from creator wizard state.

import {
  CharacterSchema,
  newCharacterId,
  type Character,
  type ResolvedContent,
} from 'dnd-srd-engine';
import { abilityMod, computeFinalAbilities, type CreatorState } from './state';

export const buildCharacter = (
  state: CreatorState,
  content: ResolvedContent,
): Character => {
  if (!state.classId) throw new Error('Cannot build character without a class.');
  if (!state.speciesId) throw new Error('Cannot build character without a species.');
  if (!state.backgroundId) throw new Error('Cannot build character without a background.');

  const klass = content.classes.get(state.classId);
  if (!klass) throw new Error(`Unknown class: ${state.classId}`);
  const background = content.backgrounds.get(state.backgroundId);
  if (!background) throw new Error(`Unknown background: ${state.backgroundId}`);

  const finalAbilities = computeFinalAbilities(state);
  const conMod = abilityMod(finalAbilities.CON);
  // L1 HP: hit die max + CON mod, floor 1 (PHB 2024).
  const hp = Math.max(1, klass.hitDie + conMod);

  return CharacterSchema.parse({
    id: newCharacterId(),
    name: state.name.trim(),
    speciesId: state.speciesId,
    backgroundId: state.backgroundId,
    classes: [{ classId: state.classId, level: 1, hitDiceRemaining: 1 }],
    abilityScores: finalAbilities,
    hp: { current: hp, max: hp, temp: 0 },
    featsTaken: [background.originFeatId],
    preparedSpells: [...state.cantrips, ...state.preparedSpells],
  });
};
