import { describe, expect, it } from 'vitest';
import { computeSavingThrow } from '../../../src/derive/save.js';
import { buildFighter, TEST_CONTENT } from '../../fixtures/index.js';

describe('computeSavingThrow', () => {
  it('STR save (Fighter proficient): mod + prof', () => {
    const character = buildFighter({ STR: 16, level: 1 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    expect(r.total).toBe(3 + 2);
  });

  it('CON save (Fighter proficient): mod + prof', () => {
    const character = buildFighter({ CON: 14, level: 1 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'CON',
    });
    expect(r.total).toBe(2 + 2);
  });

  it('DEX save (Fighter NOT proficient): mod only', () => {
    const character = buildFighter({ DEX: 14, level: 1 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'DEX',
    });
    expect(r.total).toBe(2);
  });

  it('exhaustion penalty: -2 per level applies to saves', () => {
    const character = buildFighter({ STR: 16, level: 1, exhaustion: 3 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    expect(r.total).toBe(3 + 2 - 6);
  });

  it('breakdown sums to total', () => {
    const character = buildFighter({ STR: 16, level: 5 });
    const r = computeSavingThrow({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    const sum = r.breakdown.reduce((acc, e) => acc + e.value, 0);
    expect(sum).toBe(r.total);
  });
});
