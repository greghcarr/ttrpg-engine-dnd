import { describe, expect, it } from 'vitest';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';

// Slice 213: with the GrantSpell engine consumer landed in slice 212,
// wire two more subclass domain spell lists as pure content.
//
// - Draconic Sorcery L3: Alter Self, Chromatic Orb, Command, Dragon's Breath.
// - Fiend Patron L3: Burning Hands, Command, Scorching Ray, Suggestion.

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildSorcerer = (level: number, subclass: 'draconic-sorcery' | null): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ember',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'sorcerer', level, hitDiceRemaining: level, ...(subclass !== null ? { subclassId: subclass } : {}) }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: 22, max: 22, temp: 0 },
    featsTaken: [],
  });

const buildWarlock = (level: number, subclass: 'fiend-patron' | null): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Marrow',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'warlock', level, hitDiceRemaining: level, ...(subclass !== null ? { subclassId: subclass } : {}) }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: 22, max: 22, temp: 0 },
    featsTaken: [],
  });

const grantedSpellIds = (character: Character) =>
  buildEffectStack({ character, content: CONTENT, itemInstances: {} })
    .grantedSpells()
    .map((g) => g.spellId)
    .sort();

describe('Slice 213: subclass spell-list grants (Draconic + Fiend)', () => {
  it('L3 Draconic Sorcery sorcerer always-prepares the 4 L3 draconic spells', () => {
    expect(grantedSpellIds(buildSorcerer(3, 'draconic-sorcery'))).toEqual([
      'alter-self',
      'chromatic-orb',
      'command',
      'dragons-breath',
    ]);
  });

  it('L3 Fiend Patron warlock always-prepares the 4 L3 fiend spells', () => {
    expect(grantedSpellIds(buildWarlock(3, 'fiend-patron'))).toEqual([
      'burning-hands',
      'command',
      'scorching-ray',
      'suggestion',
    ]);
  });

  it('L3 sorcerer with no subclass has no granted spells', () => {
    expect(grantedSpellIds(buildSorcerer(3, null))).toEqual([]);
  });
});
