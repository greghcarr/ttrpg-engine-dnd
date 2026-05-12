export interface RNG {
  next(): number;
}

export type RNGFactory = () => RNG;

export { DefaultRNG, defaultRNG } from './default.js';
export { SeededRNG, seededRNG } from './seeded.js';
export { ThrowOnCallRNG, throwOnCallRNG } from './throw.js';
export { rollDie, rollDice, rollExpression, parseDiceExpression } from './dice.js';
export type { DieRoll, DiceRollResult } from './dice.js';
