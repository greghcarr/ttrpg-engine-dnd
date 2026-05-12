import { describe, expect, it } from 'vitest';
import { defaultRNG, DefaultRNG } from '../../../src/rng/default.js';
import { seededRNG, SeededRNG } from '../../../src/rng/seeded.js';
import { throwOnCallRNG, RNGCalledInPureContextError } from '../../../src/rng/throw.js';

describe('DefaultRNG', () => {
  it('returns numbers in [0, 1)', () => {
    const rng = defaultRNG();
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('factory and class match', () => {
    expect(new DefaultRNG()).toBeInstanceOf(DefaultRNG);
  });
});

describe('SeededRNG', () => {
  it('is deterministic with same seed', () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds produce different sequences', () => {
    const a = new SeededRNG(1);
    const b = new SeededRNG(2);
    let differences = 0;
    for (let i = 0; i < 100; i++) {
      if (a.next() !== b.next()) differences++;
    }
    expect(differences).toBeGreaterThan(50);
  });

  it('returns values in [0, 1)', () => {
    const rng = seededRNG(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('fork creates a derivable but distinct stream', () => {
    const main = new SeededRNG(123);
    const fork = main.fork(99);
    expect(fork).toBeInstanceOf(SeededRNG);
    const fa = fork.next();
    const ma = main.next();
    expect(fa).not.toBe(ma);
  });
});

describe('ThrowOnCallRNG', () => {
  it('throws when next() is called', () => {
    const rng = throwOnCallRNG();
    expect(() => rng.next()).toThrow(RNGCalledInPureContextError);
  });
});
