import { describe, expect, it } from 'vitest';
import {
  ABILITY_SCORE_MAX,
  ABILITY_SCORE_MIN,
  abilityModifier,
  PROFICIENCY_BONUS_LEVEL_MAX,
  PROFICIENCY_BONUS_LEVEL_MIN,
  proficiencyBonus,
} from '../../../src/derive/ability.js';

describe('abilityModifier', () => {
  const cases: Array<[number, number]> = [
    [1, -5],
    [2, -4],
    [3, -4],
    [4, -3],
    [5, -3],
    [6, -2],
    [7, -2],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [13, 1],
    [14, 2],
    [15, 2],
    [16, 3],
    [17, 3],
    [18, 4],
    [19, 4],
    [20, 5],
    [21, 5],
    [22, 6],
    [23, 6],
    [24, 7],
    [25, 7],
    [26, 8],
    [27, 8],
    [28, 9],
    [29, 9],
    [30, 10],
  ];
  for (const [score, expected] of cases) {
    it(`score ${score} → ${expected}`, () => {
      expect(abilityModifier(score)).toBe(expected);
    });
  }

  it(`rejects scores below ${ABILITY_SCORE_MIN}`, () => {
    expect(() => abilityModifier(ABILITY_SCORE_MIN - 1)).toThrow(/out of range/);
  });
  it(`rejects scores above ${ABILITY_SCORE_MAX}`, () => {
    expect(() => abilityModifier(ABILITY_SCORE_MAX + 1)).toThrow(/out of range/);
  });
  it('rejects non-integer scores', () => {
    expect(() => abilityModifier(10.5)).toThrow(/integer/);
  });
});

describe('proficiencyBonus', () => {
  const expected: Record<number, number> = {
    1: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 3,
    6: 3,
    7: 3,
    8: 3,
    9: 4,
    10: 4,
    11: 4,
    12: 4,
    13: 5,
    14: 5,
    15: 5,
    16: 5,
    17: 6,
    18: 6,
    19: 6,
    20: 6,
  };
  for (const [levelStr, bonus] of Object.entries(expected)) {
    const level = Number.parseInt(levelStr, 10);
    it(`level ${level} → +${bonus}`, () => {
      expect(proficiencyBonus(level)).toBe(bonus);
    });
  }

  it(`rejects levels below ${PROFICIENCY_BONUS_LEVEL_MIN}`, () => {
    expect(() => proficiencyBonus(0)).toThrow(/out of range/);
  });
  it(`rejects levels above ${PROFICIENCY_BONUS_LEVEL_MAX}`, () => {
    expect(() => proficiencyBonus(21)).toThrow(/out of range/);
  });
  it('rejects non-integer levels', () => {
    expect(() => proficiencyBonus(1.5)).toThrow(/integer/);
  });
});
