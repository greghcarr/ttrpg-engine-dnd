import type { RNG } from './index.js';

export class RNGCalledInPureContextError extends Error {
  constructor(message = 'RNG was called inside a context that must be deterministic (e.g. apply()).') {
    super(message);
    this.name = 'RNGCalledInPureContextError';
  }
}

export class ThrowOnCallRNG implements RNG {
  next(): number {
    throw new RNGCalledInPureContextError();
  }
}

export const throwOnCallRNG = (): RNG => new ThrowOnCallRNG();
