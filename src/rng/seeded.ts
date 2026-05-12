import type { RNG } from './index.js';

const SEED_MASK = 0x6d2b79f5;
const SEED_ADD = 0x9e3779b9;
const STATE_MOD = 0x100000000;

export class SeededRNG implements RNG {
  private state: number;

  constructor(seed: number) {
    this.state = (seed | 0) >>> 0;
  }

  next(): number {
    let t = (this.state = (this.state + SEED_ADD) >>> 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / STATE_MOD;
  }

  fork(salt: number): SeededRNG {
    return new SeededRNG((this.state ^ Math.imul(salt | 0, SEED_MASK)) >>> 0);
  }
}

export const seededRNG = (seed: number): SeededRNG => new SeededRNG(seed);
