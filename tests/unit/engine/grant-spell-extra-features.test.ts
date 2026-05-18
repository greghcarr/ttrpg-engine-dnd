import { describe, expect, it } from 'vitest';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';

// Slices 216 + 217: two more pure-content GrantSpell wires.
// - Bard L20 Words of Creation: always-prepared Power Word Heal.
// - Warlock L9 Contact Patron: oncePerLongRest Contact Other Plane.

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildBard = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Lyra',
    speciesId: 'human',
    backgroundId: 'entertainer',
    classes: [{ classId: 'bard', level, hitDiceRemaining: level }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 18 },
    hp: { current: level * 8, max: level * 8, temp: 0 },
    featsTaken: [],
  });

const buildWarlock = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Marrow',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'warlock', level, hitDiceRemaining: level }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: level * 8, max: level * 8, temp: 0 },
    featsTaken: [],
  });

describe('Bard L20 Words of Creation (slice 216)', () => {
  it('an L20 bard always-prepares Power Word Heal', () => {
    const acc = buildEffectStack({
      character: buildBard(20),
      content: CONTENT,
      itemInstances: {},
    });
    const grant = acc.grantedSpells().find((g) => g.spellId === 'power-word-heal');
    expect(grant).toBeDefined();
    expect(grant!.preparation).toBe('always-prepared');
  });

  it('an L19 bard does NOT yet have Power Word Heal granted', () => {
    const acc = buildEffectStack({
      character: buildBard(19),
      content: CONTENT,
      itemInstances: {},
    });
    expect(acc.grantedSpells().some((g) => g.spellId === 'power-word-heal')).toBe(false);
  });
});

describe('Warlock L9 Contact Patron (slice 217)', () => {
  it('an L9 warlock has Contact Other Plane as a oncePerLongRest grant', () => {
    const acc = buildEffectStack({
      character: buildWarlock(9),
      content: CONTENT,
      itemInstances: {},
    });
    const grant = acc.grantedSpells().find((g) => g.spellId === 'contact-other-plane');
    expect(grant).toBeDefined();
    expect(grant!.preparation).toBe('oncePerLongRest');
  });

  it('an L8 warlock does NOT yet have the grant', () => {
    const acc = buildEffectStack({
      character: buildWarlock(8),
      content: CONTENT,
      itemInstances: {},
    });
    expect(acc.grantedSpells().some((g) => g.spellId === 'contact-other-plane')).toBe(false);
  });
});
