import { describe, expect, it } from 'vitest';
import { computeSavingThrow } from '../../../src/derive/save.js';
import { buildFighter, TEST_CONTENT } from '../../fixtures/index.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { ItemInstanceSchema, type ItemInstance } from '../../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../../src/ids.js';

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
  it('Young Red Dragon: listed DEX +4 / WIS +4 use the baked total (slice 157 SRD 5.2.1 refresh)', () => {
    // SRD 5.2.1 Young Red Dragon: STR 23 / DEX 10 / CON 21 / INT 14 / WIS 11 / CHA 19.
    // SRD lists proficient saves on DEX +4 and WIS +4 (mod + PB of 4 with no
    // proficiency on the others). Pre-slice 157, the pack carried 2014 MM's
    // CON +9 / CHA +8 proficiencies too; those were dropped to match RAW.
    const dragon = buildCreature('young-red-dragon', 'Smaug Jr', {
      STR: 23, DEX: 10, CON: 21, INT: 14, WIS: 11, CHA: 19,
    });
    const ctx = { character: dragon, itemInstances: {}, content: STARTER_CONTENT };
    expect(computeSavingThrow({ ...ctx, ability: 'DEX' }).total).toBe(4);
    expect(computeSavingThrow({ ...ctx, ability: 'WIS' }).total).toBe(4);
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
    // Same Young Red Dragon, but checking DEX (a listed proficient save in
    // SRD 5.2.1) instead of CON (which slice 157 dropped from the pack).
    const dragon = buildCreature('young-red-dragon', 'Smaug Jr', {
      STR: 23, DEX: 10, CON: 21, INT: 14, WIS: 11, CHA: 19,
    });
    const r = computeSavingThrow({
      character: dragon,
      itemInstances: {},
      content: STARTER_CONTENT,
      ability: 'DEX',
    });
    const sources = r.breakdown.map((e) => e.source);
    expect(sources).toContain('monster:young-red-dragon:save');
    expect(sources).not.toContain('DEX-mod');
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

// Slice 258: predicated SetAdvantage honored end-to-end. Canonical
// user: Mantle of Spell Resistance (advantage on saves against spells,
// gated on `event.isSpellSave === true` which the save derive populates
// from `input.sourceIsMagical`).
describe('Mantle of Spell Resistance (slice 258)', () => {
  const makeMantle = (): ItemInstance =>
    ItemInstanceSchema.parse({
      id: newItemInstanceId(),
      definitionId: 'mantle-of-spell-resistance',
      attuned: true,
    });

  const buildWearer = (mantleId: string): Character =>
    CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Mantle Wearer',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 40, max: 40, temp: 0 },
      inventory: [mantleId],
      equipped: { attuned: [mantleId] },
    });

  it('advantage applies when sourceIsMagical is true (spell save)', () => {
    const mantle = makeMantle();
    const wearer = buildWearer(mantle.id);
    const r = computeSavingThrow({
      character: wearer,
      itemInstances: { [mantle.id]: mantle },
      content: STARTER_CONTENT,
      ability: 'WIS',
      sourceIsMagical: true,
    });
    expect(r.hasAdvantage).toBe(true);
  });

  it('advantage does NOT apply when sourceIsMagical is false (non-spell save)', () => {
    const mantle = makeMantle();
    const wearer = buildWearer(mantle.id);
    const r = computeSavingThrow({
      character: wearer,
      itemInstances: { [mantle.id]: mantle },
      content: STARTER_CONTENT,
      ability: 'WIS',
      sourceIsMagical: false,
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('advantage applies on every ability (Mantle ships 6 entries, one per ability)', () => {
    const mantle = makeMantle();
    const wearer = buildWearer(mantle.id);
    for (const ability of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const) {
      const r = computeSavingThrow({
        character: wearer,
        itemInstances: { [mantle.id]: mantle },
        content: STARTER_CONTENT,
        ability,
        sourceIsMagical: true,
      });
      expect(r.hasAdvantage, `Mantle should grant advantage on ${ability}`).toBe(true);
    }
  });

  it('un-attuned Mantle does NOT project (RAW requires attunement)', () => {
    // Same wearer but Mantle isn't in equipped.attuned. Magic-item
    // projection (slice 132) skips attunement-required items that
    // aren't attuned.
    const mantle = ItemInstanceSchema.parse({
      id: newItemInstanceId(),
      definitionId: 'mantle-of-spell-resistance',
      attuned: false,
    });
    const wearer: Character = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Mantle Carrier',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 40, max: 40, temp: 0 },
      inventory: [mantle.id],
      equipped: { attuned: [] },
    });
    const r = computeSavingThrow({
      character: wearer,
      itemInstances: { [mantle.id]: mantle },
      content: STARTER_CONTENT,
      ability: 'WIS',
      sourceIsMagical: true,
    });
    expect(r.hasAdvantage).toBe(false);
  });
});
