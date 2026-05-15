// Sample character builder.
//
// Slice-1 placeholder so the "Create sample" flow on /characters has
// something to insert into the database. Lifted from the old vanilla
// scaffold; replaced in the next slice by a real character creator.

import { CharacterSchema, newCharacterId, type Character } from 'ttrpg-engine-dnd';

export const buildSampleCharacter = (name = 'Velka the Studious'): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 33, max: 33, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['magic-missile', 'mage-armor', 'fireball', 'fire-bolt'],
  });
