import { describe, expect, it } from 'vitest';
import { computeAbilityCheck, computePassiveScore } from '../../../src/derive/ability-check.js';
import { buildFighter, TEST_CONTENT } from '../../fixtures/index.js';

describe('computeAbilityCheck', () => {
  it('raw ability check: just the ability modifier', () => {
    const character = buildFighter({ STR: 16 });
    const r = computeAbilityCheck({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    expect(r.total).toBe(3);
  });

  it('skill check with no proficiency: just the ability modifier', () => {
    const character = buildFighter({ STR: 16 });
    const r = computeAbilityCheck({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
      skill: 'athletics',
    });
    expect(r.total).toBe(3);
  });

  it('exhaustion penalty applies to ability checks', () => {
    const character = buildFighter({ STR: 16, exhaustion: 2 });
    const r = computeAbilityCheck({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    expect(r.total).toBe(3 - 4);
  });

  it('breakdown sums to total', () => {
    const character = buildFighter({ STR: 16, exhaustion: 1 });
    const r = computeAbilityCheck({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      ability: 'STR',
    });
    const sum = r.breakdown.reduce((acc, e) => acc + e.value, 0);
    expect(sum).toBe(r.total);
  });
});

describe('computePassiveScore', () => {
  it('passive perception = 10 + WIS mod (no proficiency baseline)', () => {
    const character = buildFighter({ WIS: 14 });
    expect(
      computePassiveScore({
        character,
        itemInstances: {},
        content: TEST_CONTENT,
        ability: 'WIS',
        skill: 'perception',
      }),
    ).toBe(12);
  });
});
