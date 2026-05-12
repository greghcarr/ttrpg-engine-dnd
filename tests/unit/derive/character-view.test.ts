import { describe, expect, it } from 'vitest';
import { computeDerivedCharacter } from '../../../src/derive/character-view.js';
import { buildFighter, TEST_CONTENT } from '../../fixtures/index.js';

describe('computeDerivedCharacter', () => {
  it('returns total level, prof bonus, ability mods, ac, saves, spell slots', () => {
    const character = buildFighter({ level: 5, STR: 18, DEX: 14, CON: 16 });
    const view = computeDerivedCharacter({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
    });

    expect(view.totalLevel).toBe(5);
    expect(view.proficiencyBonus).toBe(3);
    expect(view.abilityModifiers.STR).toBe(4);
    expect(view.abilityModifiers.DEX).toBe(2);
    expect(view.abilityModifiers.CON).toBe(3);
    expect(view.ac.total).toBeGreaterThan(0);
    expect(view.savingThrows.STR.total).toBe(4 + 3);
    expect(view.savingThrows.DEX.total).toBe(2);
    expect(view.spellSlots.slotsByLevel).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(view.hasPendingChoices).toBe(false);
  });
});
