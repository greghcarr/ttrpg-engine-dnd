import { describe, expect, it } from 'vitest';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';

// Slice 218: higher-tier subclass spell-list content sweep.
// Cashes in slice 212's GrantSpell engine consumer by wiring the
// L5/L7/L9 tiers for Life Domain (cleric), Draconic Sorcery
// (sorcerer), and Fiend Patron (warlock). Each tier rides under a
// distinct feature id so dedup-by-feature-id accumulates additively.
// Draconic L9 (Legend Lore + Summon Dragon) is intentionally deferred:
// `summon-dragon` is not in the pack yet.

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildCleric = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Solace',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level, hitDiceRemaining: level, subclassId: 'life-domain' }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: level * 8, max: level * 8, temp: 0 },
    featsTaken: [],
  });

const buildSorcerer = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Vyrn',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'sorcerer', level, hitDiceRemaining: level, subclassId: 'draconic-sorcery' }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: level * 6, max: level * 6, temp: 0 },
    featsTaken: [],
  });

const buildWarlock = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Marrow',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'warlock', level, hitDiceRemaining: level, subclassId: 'fiend-patron' }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: level * 8, max: level * 8, temp: 0 },
    featsTaken: [],
  });

const grantedIds = (character: Character): string[] =>
  buildEffectStack({ character, content: CONTENT, itemInstances: {} })
    .grantedSpells()
    .map((g) => g.spellId)
    .sort();

describe('Life Domain higher tiers (slice 218)', () => {
  it('an L4 Life Domain cleric still only has the L3 tier', () => {
    expect(grantedIds(buildCleric(4))).toEqual(['aid', 'bless', 'cure-wounds', 'lesser-restoration']);
  });

  it('an L5 cleric adds Mass Healing Word + Revivify', () => {
    expect(grantedIds(buildCleric(5))).toEqual(
      ['aid', 'bless', 'cure-wounds', 'lesser-restoration', 'mass-healing-word', 'revivify'].sort(),
    );
  });

  it('an L7 cleric also has Aura of Life + Death Ward', () => {
    expect(grantedIds(buildCleric(7))).toEqual(
      [
        'aid',
        'aura-of-life',
        'bless',
        'cure-wounds',
        'death-ward',
        'lesser-restoration',
        'mass-healing-word',
        'revivify',
      ],
    );
  });

  it('an L9 cleric tops out with Greater Restoration + Mass Cure Wounds', () => {
    expect(grantedIds(buildCleric(9))).toEqual(
      [
        'aid',
        'aura-of-life',
        'bless',
        'cure-wounds',
        'death-ward',
        'greater-restoration',
        'lesser-restoration',
        'mass-cure-wounds',
        'mass-healing-word',
        'revivify',
      ],
    );
  });
});

describe('Draconic Sorcery higher tiers (slice 218)', () => {
  it('an L4 draconic sorcerer still only has the L3 tier', () => {
    expect(grantedIds(buildSorcerer(4))).toEqual(['alter-self', 'chromatic-orb', 'command', 'dragons-breath']);
  });

  it('an L5 sorcerer adds Fear + Fly', () => {
    expect(grantedIds(buildSorcerer(5))).toEqual(
      ['alter-self', 'chromatic-orb', 'command', 'dragons-breath', 'fear', 'fly'].sort(),
    );
  });

  it('an L7 sorcerer also has Arcane Eye + Charm Monster', () => {
    expect(grantedIds(buildSorcerer(7))).toEqual(
      [
        'alter-self',
        'arcane-eye',
        'charm-monster',
        'chromatic-orb',
        'command',
        'dragons-breath',
        'fear',
        'fly',
      ],
    );
  });

  it('an L9 sorcerer still has the same set as L7 (Draconic L9 deferred)', () => {
    expect(grantedIds(buildSorcerer(9))).toEqual(grantedIds(buildSorcerer(7)));
  });
});

describe('Fiend Patron higher tiers (slice 218)', () => {
  it('an L4 fiend warlock still only has the L3 tier', () => {
    expect(grantedIds(buildWarlock(4))).toEqual(['burning-hands', 'command', 'scorching-ray', 'suggestion']);
  });

  it('an L5 warlock adds Fireball + Stinking Cloud', () => {
    expect(grantedIds(buildWarlock(5))).toEqual(
      ['burning-hands', 'command', 'fireball', 'scorching-ray', 'stinking-cloud', 'suggestion'].sort(),
    );
  });

  it('an L7 warlock also has Fire Shield + Wall of Fire', () => {
    expect(grantedIds(buildWarlock(7))).toEqual(
      [
        'burning-hands',
        'command',
        'fire-shield',
        'fireball',
        'scorching-ray',
        'stinking-cloud',
        'suggestion',
        'wall-of-fire',
      ],
    );
  });

  it('an L9 warlock tops out with Geas + Insect Plague (plus Contact Other Plane from class L9)', () => {
    expect(grantedIds(buildWarlock(9))).toEqual(
      [
        'burning-hands',
        'command',
        'contact-other-plane',
        'fire-shield',
        'fireball',
        'geas',
        'insect-plague',
        'scorching-ray',
        'stinking-cloud',
        'suggestion',
        'wall-of-fire',
      ],
    );
  });
});
