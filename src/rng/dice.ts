import type { RNG } from './index.js';

const DICE_EXPRESSION_RE = /^(\d+)d(\d+)([+-]\d+)?$/i;

export interface DieRoll {
  readonly die: number;
  readonly value: number;
}

export interface DiceRollResult {
  readonly rolls: ReadonlyArray<DieRoll>;
  readonly modifier: number;
  readonly total: number;
}

export interface ParsedDiceExpression {
  readonly count: number;
  readonly die: number;
  readonly modifier: number;
}

export const parseDiceExpression = (expression: string): ParsedDiceExpression => {
  const match = DICE_EXPRESSION_RE.exec(expression.trim());
  if (!match) {
    throw new Error(`Invalid dice expression: ${expression}`);
  }
  const countStr = match[1];
  const dieStr = match[2];
  const modStr = match[3];
  if (countStr === undefined || dieStr === undefined) {
    throw new Error(`Invalid dice expression: ${expression}`);
  }
  const count = Number.parseInt(countStr, 10);
  const die = Number.parseInt(dieStr, 10);
  const modifier = modStr === undefined ? 0 : Number.parseInt(modStr, 10);
  if (count <= 0) throw new Error(`Dice count must be > 0: ${expression}`);
  if (die <= 1) throw new Error(`Die size must be > 1: ${expression}`);
  return { count, die, modifier };
};

export const rollDie = (die: number, rng: RNG): number => {
  if (die <= 1 || !Number.isInteger(die)) {
    throw new Error(`Invalid die size: ${die}`);
  }
  return Math.floor(rng.next() * die) + 1;
};

export const rollDice = (count: number, die: number, rng: RNG): ReadonlyArray<DieRoll> => {
  if (count <= 0 || !Number.isInteger(count)) {
    throw new Error(`Invalid dice count: ${count}`);
  }
  const rolls: DieRoll[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push({ die, value: rollDie(die, rng) });
  }
  return rolls;
};

export const rollExpression = (expression: string, rng: RNG): DiceRollResult => {
  const parsed = parseDiceExpression(expression);
  const rolls = rollDice(parsed.count, parsed.die, rng);
  const sumOfRolls = rolls.reduce((acc, r) => acc + r.value, 0);
  return {
    rolls,
    modifier: parsed.modifier,
    total: sumOfRolls + parsed.modifier,
  };
};
