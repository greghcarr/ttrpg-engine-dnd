import { describe, expect, it } from 'vitest';
import { computeSpellSlots, spellSlotsForLevel } from '../../../src/derive/spell-slots.js';
import { CharacterSchema } from '../../../src/schemas/runtime/character.js';
import { TEST_CONTENT } from '../../fixtures/index.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Character } from '../../../src/schemas/runtime/character.js';

const buildChar = (classes: Array<{ classId: string; level: number }>): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'tmp',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: classes.map((c) => ({
      classId: c.classId,
      level: c.level,
      hitDiceRemaining: c.level,
    })),
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 1, max: 1, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('computeSpellSlots', () => {
  it('non-caster has no slots', () => {
    const char = buildChar([{ classId: 'fighter', level: 5 }]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.slotsByLevel).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.pactSlots).toBeUndefined();
  });

  it('full caster level 1 → 2 first-level slots', () => {
    const char = buildChar([{ classId: 'wizard', level: 1 }]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.slotsByLevel).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('full caster level 20 → 9-slot table', () => {
    const char = buildChar([{ classId: 'wizard', level: 20 }]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.slotsByLevel).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });

  it('half caster level 2 → first slot', () => {
    const char = buildChar([{ classId: 'paladin', level: 2 }]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.slotsByLevel[0]).toBe(2);
  });

  it('half caster level 1 → 2 first-level slots (PHB 2024 changed from 2014)', () => {
    const char = buildChar([{ classId: 'paladin', level: 1 }]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.slotsByLevel).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('pact magic level 1 → 1 first-level pact slot', () => {
    const char = buildChar([{ classId: 'warlock', level: 1 }]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.pactSlots).toEqual({ level: 1, count: 1 });
    expect(result.slotsByLevel).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('pact magic level 5 → 2 third-level pact slots', () => {
    const char = buildChar([{ classId: 'warlock', level: 5 }]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.pactSlots).toEqual({ level: 3, count: 2 });
  });

  it('multiclass full + full uses summed level (10 → 5th-level slots)', () => {
    const char = buildChar([
      { classId: 'wizard', level: 5 },
      { classId: 'wizard', level: 5 },
    ]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.slotsByLevel).toEqual([4, 3, 3, 3, 2, 0, 0, 0, 0]);
  });

  it('multiclass full + half: combines casters at floor(half/2)', () => {
    const char = buildChar([
      { classId: 'wizard', level: 3 },
      { classId: 'paladin', level: 4 },
    ]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.slotsByLevel).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
  });

  it('pact + spellcaster do not stack', () => {
    const char = buildChar([
      { classId: 'warlock', level: 5 },
      { classId: 'wizard', level: 5 },
    ]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(result.pactSlots).toEqual({ level: 3, count: 2 });
    expect(result.slotsByLevel).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
  });

  it('spellSlotsForLevel returns infinity for cantrips', () => {
    const char = buildChar([{ classId: 'wizard', level: 1 }]);
    const result = computeSpellSlots(char, TEST_CONTENT.classes);
    expect(spellSlotsForLevel(result, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(spellSlotsForLevel(result, 1)).toBe(2);
    expect(spellSlotsForLevel(result, 9)).toBe(0);
  });
});
