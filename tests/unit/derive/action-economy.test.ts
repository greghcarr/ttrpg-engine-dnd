import { describe, expect, it } from 'vitest';
import { computeActionEconomyBudget } from '../../../src/derive/action-economy.js';
import { buildFighter, TEST_CONTENT } from '../../fixtures/index.js';

describe('computeActionEconomyBudget', () => {
  it('Fighter L1: one attack per Attack action', () => {
    const character = buildFighter({ level: 1 });
    const budget = computeActionEconomyBudget({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
    });
    expect(budget.maxAttacksPerAction).toBe(1);
  });

  it('Fighter L5: two attacks per Attack action (Extra Attack)', () => {
    const character = buildFighter({ level: 5 });
    const budget = computeActionEconomyBudget({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
    });
    expect(budget.maxAttacksPerAction).toBe(2);
  });

  it('Fighter L1: no extra actions, no extra bonus actions', () => {
    const character = buildFighter({ level: 1 });
    const budget = computeActionEconomyBudget({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
    });
    expect(budget.extraActionsPerTurn).toBe(0);
    expect(budget.extraBonusActionsPerTurn).toBe(0);
  });
});
