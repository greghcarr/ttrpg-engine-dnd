import type { RNG } from './index.js';

export class DefaultRNG implements RNG {
  next(): number {
    return Math.random();
  }
}

export const defaultRNG = (): RNG => new DefaultRNG();
