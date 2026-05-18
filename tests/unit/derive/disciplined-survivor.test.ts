import { describe, expect, it } from 'vitest';
import { computeSavingThrow } from '../../../src/derive/save.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import type { AbilityScore } from '../../../src/schemas/primitives.js';

// Slice 203: Monk L14 Disciplined Survivor. RAW (SRD 5.2.1): "Your
// physical and mental discipline grant you proficiency in all saving
// throws." Monk starts with STR + DEX proficiencies at L1; the
// feature grants the remaining four (CON, INT, WIS, CHA).
//
// Pure content slice — no engine work. Existing GrantProficiency
// wiring lights up all six saves.

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildMonk = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Kai',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level, hitDiceRemaining: level }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 12, WIS: 16, CHA: 10 },
    hp: { current: 80, max: 80, temp: 0 },
    featsTaken: [],
  });

const ALL_ABILITIES: ReadonlyArray<AbilityScore> = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

// Ability mod = floor((score - 10) / 2). Hand-computed to match the
// scores above so the expectations stay legible.
const abilityMods: Readonly<Record<AbilityScore, number>> = {
  STR: 2,
  DEX: 4,
  CON: 2,
  INT: 1,
  WIS: 3,
  CHA: 0,
};

const PROF_BONUS_L13 = 5;
const PROF_BONUS_L14 = 5;

const buildRogue = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Vex',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'rogue', level, hitDiceRemaining: level }],
    abilityScores: { STR: 10, DEX: 18, CON: 12, INT: 16, WIS: 14, CHA: 10 },
    hp: { current: 80, max: 80, temp: 0 },
    featsTaken: [],
  });

describe('Rogue L15 Slippery Mind (regression: GrantProficiency target=save now wires)', () => {
  // Pre-slice 203 bug: `isSaveProficient` only consulted the class's
  // baseline `savingThrowProficiencies`, ignoring effect-stack
  // contributions. Slippery Mind grants WIS + CHA save proficiency at
  // L15 via two GrantProficiency effects, which used to silently
  // drop. Slice 203 fixed the save derivation; this test pins the
  // behavior so the bug can't return.
  it('L14 Rogue is proficient in DEX + INT only (class baseline)', () => {
    const rogue = buildRogue(14);
    const ctx = { character: rogue, itemInstances: {}, content: CONTENT };
    expect(computeSavingThrow({ ...ctx, ability: 'WIS' }).total).toBe(2);
    expect(computeSavingThrow({ ...ctx, ability: 'CHA' }).total).toBe(0);
  });

  it('L15 Rogue gains WIS + CHA save proficiency via Slippery Mind', () => {
    const rogue = buildRogue(15);
    const ctx = { character: rogue, itemInstances: {}, content: CONTENT };
    // PB at L15 = 5. WIS mod = +2; total +7. CHA mod = 0; total +5.
    expect(computeSavingThrow({ ...ctx, ability: 'WIS' }).total).toBe(2 + 5);
    expect(computeSavingThrow({ ...ctx, ability: 'CHA' }).total).toBe(0 + 5);
  });
});

describe('Monk L14 Disciplined Survivor', () => {
  it('L13 Monk is proficient in STR + DEX only (class baseline)', () => {
    const monk = buildMonk(13);
    const ctx = { character: monk, itemInstances: {}, content: CONTENT };
    expect(computeSavingThrow({ ...ctx, ability: 'STR' }).total).toBe(abilityMods.STR + PROF_BONUS_L13);
    expect(computeSavingThrow({ ...ctx, ability: 'DEX' }).total).toBe(abilityMods.DEX + PROF_BONUS_L13);
    expect(computeSavingThrow({ ...ctx, ability: 'CON' }).total).toBe(abilityMods.CON);
    expect(computeSavingThrow({ ...ctx, ability: 'INT' }).total).toBe(abilityMods.INT);
    expect(computeSavingThrow({ ...ctx, ability: 'WIS' }).total).toBe(abilityMods.WIS);
    expect(computeSavingThrow({ ...ctx, ability: 'CHA' }).total).toBe(abilityMods.CHA);
  });

  it('L14 Monk is proficient in all six saving throws', () => {
    const monk = buildMonk(14);
    const ctx = { character: monk, itemInstances: {}, content: CONTENT };
    for (const ability of ALL_ABILITIES) {
      const result = computeSavingThrow({ ...ctx, ability });
      expect(result.total, `${ability} save should include the +${PROF_BONUS_L14} proficiency bonus`).toBe(
        abilityMods[ability] + PROF_BONUS_L14,
      );
    }
  });
});
