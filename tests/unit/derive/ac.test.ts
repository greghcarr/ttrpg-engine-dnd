import { describe, expect, it } from 'vitest';
import { computeAC } from '../../../src/derive/ac.js';
import { buildFighter, makeItemInstance, TEST_CONTENT } from '../../fixtures/index.js';
import type { ItemInstance } from '../../../src/schemas/runtime/item-instance.js';

const itemsToRecord = (...items: ItemInstance[]): Record<string, ItemInstance> => {
  const out: Record<string, ItemInstance> = {};
  for (const i of items) out[i.id] = i;
  return out;
};

describe('computeAC', () => {
  it('unarmored: 10 + DEX mod', () => {
    const character = buildFighter({ DEX: 14 });
    const ac = computeAC({ character, itemInstances: {}, content: TEST_CONTENT });
    expect(ac.total).toBe(12);
  });

  it('unarmored with low DEX: 10 + (-1) = 9', () => {
    const character = buildFighter({ DEX: 8 });
    const ac = computeAC({ character, itemInstances: {}, content: TEST_CONTENT });
    expect(ac.total).toBe(9);
  });

  it('leather armor (light): 11 + full DEX', () => {
    const armor = makeItemInstance('leather-armor');
    const character = buildFighter({ DEX: 16, armorInstanceId: armor.id });
    const ac = computeAC({
      character,
      itemInstances: itemsToRecord(armor),
      content: TEST_CONTENT,
    });
    expect(ac.total).toBe(11 + 3);
  });

  it('chain shirt (medium) with DEX 18: capped at DEX +2', () => {
    const armor = makeItemInstance('chain-shirt');
    const character = buildFighter({ DEX: 18, armorInstanceId: armor.id });
    const ac = computeAC({
      character,
      itemInstances: itemsToRecord(armor),
      content: TEST_CONTENT,
    });
    expect(ac.total).toBe(13 + 2);
  });

  it('chain mail (heavy): ignores DEX entirely', () => {
    const armor = makeItemInstance('chain-mail');
    const character = buildFighter({ DEX: 20, armorInstanceId: armor.id });
    const ac = computeAC({
      character,
      itemInstances: itemsToRecord(armor),
      content: TEST_CONTENT,
    });
    expect(ac.total).toBe(16);
  });

  it('plate (heavy): ignores DEX entirely', () => {
    const armor = makeItemInstance('plate');
    const character = buildFighter({ DEX: 14, armorInstanceId: armor.id });
    const ac = computeAC({
      character,
      itemInstances: itemsToRecord(armor),
      content: TEST_CONTENT,
    });
    expect(ac.total).toBe(18);
  });

  it('armor + shield stacks', () => {
    const armor = makeItemInstance('chain-mail');
    const shield = makeItemInstance('shield');
    const character = buildFighter({
      armorInstanceId: armor.id,
      shieldInstanceId: shield.id,
    });
    const ac = computeAC({
      character,
      itemInstances: itemsToRecord(armor, shield),
      content: TEST_CONTENT,
    });
    expect(ac.total).toBe(16 + 2);
  });

  it('unarmored Barbarian-style override: 10 + DEX + CON', () => {
    const armor = undefined;
    const character = buildFighter({ DEX: 14, CON: 16 });
    character.featsTaken.push('unarmored-defense-barbarian');
    const ac = computeAC({
      character,
      itemInstances: itemsToRecord(),
      content: TEST_CONTENT,
    });
    expect(ac.total).toBe(10 + 2 + 3);
    void armor;
  });

  it('breakdown is non-empty and sums to total', () => {
    const character = buildFighter({ DEX: 14 });
    const ac = computeAC({ character, itemInstances: {}, content: TEST_CONTENT });
    const sum = ac.breakdown.reduce((acc, e) => acc + e.value, 0);
    expect(sum).toBe(ac.total);
    expect(ac.breakdown.length).toBeGreaterThan(0);
  });
});
