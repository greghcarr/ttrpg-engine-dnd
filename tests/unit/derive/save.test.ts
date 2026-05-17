import { describe, expect, it } from 'vitest';
import { computeSavingThrow } from '../../../src/derive/save.js';
import { buildFighter, TEST_CONTENT } from '../../fixtures/index.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';

describe('computeSavingThrow', () => {
  it('STR save (Fighter proficient): mod + prof', () => {
    const character = buildFighter({ STR: 16, level: 1 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    expect(r.total).toBe(3 + 2);
  });

  it('CON save (Fighter proficient): mod + prof', () => {
    const character = buildFighter({ CON: 14, level: 1 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'CON',
    });
    expect(r.total).toBe(2 + 2);
  });

  it('DEX save (Fighter NOT proficient): mod only', () => {
    const character = buildFighter({ DEX: 14, level: 1 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'DEX',
    });
    expect(r.total).toBe(2);
  });

  it('exhaustion penalty: -2 per level applies to saves', () => {
    const character = buildFighter({ STR: 16, level: 1, exhaustion: 3 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    expect(r.total).toBe(3 + 2 - 6);
  });

  it('breakdown sums to total', () => {
    const character = buildFighter({ STR: 16, level: 5 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    const sum = r.breakdown.reduce((acc, e) => acc + e.value, 0);
    expect(sum).toBe(r.total);
  });
});

// Slice 130: monster.savingThrows is the baked save total per RAW MM
// (ability mod + proficiency already included). The fast-path uses it
// directly instead of reconstructing from ability mod + class proficiency.

const STARTER_PACK = loadStarterPack();
const STARTER_CONTENT = resolveContent([STARTER_PACK]);

const buildCreature = (statblockId: string, name: string, abilityScores: Character['abilityScores']): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name,
    statblockId,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores,
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('computeSavingThrow consults monster.savingThrows (slice 130)', () => {
  it('Young Red Dragon: listed DEX +4 / CON +9 / WIS +4 / CHA +8 use the baked total', () => {
    // RAW MM Young Red Dragon: STR 23 / DEX 10 / CON 21 / INT 14 / WIS 11 / CHA 19.
    // Listed saves: DEX +4, CON +9, WIS +4, CHA +8 (each = ability mod + PB of 4).
    const dragon = buildCreature('young-red-dragon', 'Smaug Jr', {
      STR: 23, DEX: 10, CON: 21, INT: 14, WIS: 11, CHA: 19,
    });
    const ctx = { character: dragon, itemInstances: {}, content: STARTER_CONTENT };
    expect(computeSavingThrow({ ...ctx, ability: 'DEX' }).total).toBe(4);
    expect(computeSavingThrow({ ...ctx, ability: 'CON' }).total).toBe(9);
    expect(computeSavingThrow({ ...ctx, ability: 'WIS' }).total).toBe(4);
    expect(computeSavingThrow({ ...ctx, ability: 'CHA' }).total).toBe(8);
  });

  it('Young Red Dragon: unlisted STR save falls through to ability-mod-only path', () => {
    // RAW: a save not listed on the statblock gets just the ability mod
    // (no proficiency). The fixture has fighter L1 attached, which would
    // *incorrectly* grant STR proficiency under the old path; this slice
    // doesn't fix that pre-existing fixture quirk, but the unlisted save
    // still goes through the class-based proficiency check. STR 23 mod
    // is +6; fighter L1 proficiency is +2; total +8.
    const dragon = buildCreature('young-red-dragon', 'Smaug Jr', {
      STR: 23, DEX: 10, CON: 21, INT: 14, WIS: 11, CHA: 19,
    });
    const r = computeSavingThrow({
      character: dragon,
      itemInstances: {},
      content: STARTER_CONTENT,
      ability: 'STR',
    });
    expect(r.total).toBe(6 + 2);
  });

  it('Mage: listed INT +6 / WIS +4 (CR 6, prof +3, INT 17, WIS 12)', () => {
    // RAW MM Mage (legacy): INT mod +3 + PB +3 = +6; WIS mod +1 + PB +3 = +4.
    // Validates the "baked total" understanding against a different
    // monster from a different content batch (1.4).
    const mage = buildCreature('mage', 'Tower Mage', {
      STR: 9, DEX: 14, CON: 11, INT: 17, WIS: 12, CHA: 11,
    });
    const ctx = { character: mage, itemInstances: {}, content: STARTER_CONTENT };
    expect(computeSavingThrow({ ...ctx, ability: 'INT' }).total).toBe(6);
    expect(computeSavingThrow({ ...ctx, ability: 'WIS' }).total).toBe(4);
  });

  it('breakdown carries a single monster:<id>:save entry, not ability-mod + proficiency', () => {
    const dragon = buildCreature('young-red-dragon', 'Smaug Jr', {
      STR: 23, DEX: 10, CON: 21, INT: 14, WIS: 11, CHA: 19,
    });
    const r = computeSavingThrow({
      character: dragon,
      itemInstances: {},
      content: STARTER_CONTENT,
      ability: 'CON',
    });
    const sources = r.breakdown.map((e) => e.source);
    expect(sources).toContain('monster:young-red-dragon:save');
    expect(sources).not.toContain('CON-mod');
    expect(sources).not.toContain('proficiency');
  });

  it('Monster without savingThrows entry (Skeleton): falls through to existing flow', () => {
    // Skeleton doesn't declare savingThrows in its statblock; the
    // ability-mod + class-proficiency path applies (fixture's fighter
    // L1 grants STR + CON proficiency). STR 10 = +0, prof +2 → +2.
    const skeleton = buildCreature('skeleton', 'Walking Bones', {
      STR: 10, DEX: 14, CON: 15, INT: 6, WIS: 8, CHA: 5,
    });
    const r = computeSavingThrow({
      character: skeleton,
      itemInstances: {},
      content: STARTER_CONTENT,
      ability: 'STR',
    });
    expect(r.total).toBe(0 + 2);
    const sources = r.breakdown.map((e) => e.source);
    expect(sources).toContain('STR-mod');
    expect(sources).toContain('proficiency');
  });

  it('PCs (no statblockId) are unaffected by the monster fast-path', () => {
    const character = buildFighter({ STR: 16, level: 1 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    // Existing assertion from the pre-slice-130 test (STR 16, fighter L1).
    expect(r.total).toBe(3 + 2);
    const sources = r.breakdown.map((e) => e.source);
    expect(sources).toContain('STR-mod');
  });
});

// Slice 131: GrantMagicResistance + sourceIsMagical contributes
// advantage; without the magical-source flag the trait stays silent.

describe('computeSavingThrow honors Magic Resistance (slice 131)', () => {
  it('Imp + sourceIsMagical: true → hasAdvantage', () => {
    // Imp carries GrantMagicResistance via its traits[].
    const imp = buildCreature('imp', 'Naughty', {
      STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14,
    });
    const r = computeSavingThrow({
      character: imp,
      itemInstances: {},
      content: STARTER_CONTENT,
      ability: 'DEX',
      sourceIsMagical: true,
    });
    expect(r.hasAdvantage).toBe(true);
    expect(r.hasDisadvantage).toBe(false);
  });

  it('Imp + sourceIsMagical: false → no advantage from Magic Resistance', () => {
    const imp = buildCreature('imp', 'Naughty', {
      STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14,
    });
    const r = computeSavingThrow({
      character: imp,
      itemInstances: {},
      content: STARTER_CONTENT,
      ability: 'DEX',
      sourceIsMagical: false,
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('Imp + sourceIsMagical: undefined → no advantage (default treats source as non-magical)', () => {
    const imp = buildCreature('imp', 'Naughty', {
      STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14,
    });
    const r = computeSavingThrow({
      character: imp,
      itemInstances: {},
      content: STARTER_CONTENT,
      ability: 'DEX',
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('PC without Magic Resistance + sourceIsMagical: true → no advantage', () => {
    const character = buildFighter({ STR: 16, level: 1 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
      sourceIsMagical: true,
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('Quasit (also has Magic Resistance via batch 1.7 traits): advantage on magical save', () => {
    const quasit = buildCreature('quasit', 'Imp Cousin', {
      STR: 5, DEX: 17, CON: 10, INT: 7, WIS: 10, CHA: 10,
    });
    const r = computeSavingThrow({
      character: quasit,
      itemInstances: {},
      content: STARTER_CONTENT,
      ability: 'CON',
      sourceIsMagical: true,
    });
    expect(r.hasAdvantage).toBe(true);
  });
});
