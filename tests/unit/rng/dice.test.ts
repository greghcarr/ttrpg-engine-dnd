import { describe, expect, it } from 'vitest';
import {
  parseDiceExpression,
  rollDie,
  rollDice,
  rollExpression,
} from '../../../src/rng/dice.js';
import { seededRNG } from '../../../src/rng/seeded.js';

describe('parseDiceExpression', () => {
  it('parses 2d6', () => {
    expect(parseDiceExpression('2d6')).toEqual({ count: 2, die: 6, modifier: 0 });
  });
  it('parses 1d8+3', () => {
    expect(parseDiceExpression('1d8+3')).toEqual({ count: 1, die: 8, modifier: 3 });
  });
  it('parses 3d6-1', () => {
    expect(parseDiceExpression('3d6-1')).toEqual({ count: 3, die: 6, modifier: -1 });
  });
  it('rejects malformed strings', () => {
    expect(() => parseDiceExpression('not a roll')).toThrow();
    expect(() => parseDiceExpression('2x6')).toThrow();
    expect(() => parseDiceExpression('1d1')).toThrow();
  });

  it('accepts 0-count expressions as flat damage (slice 122)', () => {
    // "0d6+5" parses as count=0, die=6, modifier=5. The roll loop
    // skips entirely and the modifier is returned as-is. Lets
    // dice-shaped slots carry flat damage (Armor of Agathys's
    // "5 cold" retaliation).
    const parsed = parseDiceExpression('0d6+5');
    expect(parsed.count).toBe(0);
    expect(parsed.die).toBe(6);
    expect(parsed.modifier).toBe(5);
  });
});

describe('rollDie', () => {
  it('produces a value between 1 and die', () => {
    const rng = seededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = rollDie(20, rng);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });
  it('is deterministic with same seed', () => {
    const a = rollDie(20, seededRNG(42));
    const b = rollDie(20, seededRNG(42));
    expect(a).toBe(b);
  });
  it('rejects invalid die sizes', () => {
    const rng = seededRNG(1);
    expect(() => rollDie(0, rng)).toThrow();
    expect(() => rollDie(1.5, rng)).toThrow();
  });
});

describe('rollDice', () => {
  it('rolls N times', () => {
    const rolls = rollDice(5, 6, seededRNG(1));
    expect(rolls).toHaveLength(5);
    for (const r of rolls) {
      expect(r.die).toBe(6);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(6);
    }
  });
  it('rejects invalid count', () => {
    expect(() => rollDice(0, 6, seededRNG(1))).toThrow();
  });
});

describe('rollExpression', () => {
  it('sums rolls + modifier', () => {
    const r = rollExpression('2d6+3', seededRNG(1));
    const sumRolls = r.rolls.reduce((a, x) => a + x.value, 0);
    expect(r.total).toBe(sumRolls + 3);
    expect(r.modifier).toBe(3);
  });
  it('handles no modifier', () => {
    const r = rollExpression('3d4', seededRNG(1));
    expect(r.modifier).toBe(0);
  });
});
