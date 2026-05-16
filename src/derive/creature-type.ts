import type { Character } from '../schemas/runtime/character.js';
import type { ResolvedContent } from '../content/pack.js';
import type { CreatureType } from '../schemas/primitives.js';

const DEFAULT_TYPE: CreatureType = 'Humanoid';

// Returns the character's RAW creature type. PCs and NPCs read from
// the species content (`content.species.get(speciesId)?.creatureType`).
// Creature-kind characters (monsters added to encounters) read from
// the monster statblock via `statblockId`. Either side falls back to
// 'Humanoid' when the lookup misses so the caller doesn't have to
// branch on optional. Used by type-conditional effect predicates
// (Protection from Evil and Good, Magic Circle, Holy Aura's blind
// rider) and by dispatch facts when building per-event filter
// inputs (`event.attackerCreatureType`, `event.targetCreatureType`).
export const getCreatureType = (
  character: Character,
  content: ResolvedContent,
): CreatureType => {
  if (character.statblockId !== undefined) {
    const monster = content.monsters.get(character.statblockId);
    if (monster !== undefined) return monster.type;
  }
  const species = content.species.get(character.speciesId);
  if (species !== undefined) return species.creatureType;
  return DEFAULT_TYPE;
};
