import { describe, expect, it } from 'vitest';
import { computeSpellAttackBonus, computeSpellSaveDC } from '../../../src/derive/spell-dc.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { TEST_CONTENT } from '../../fixtures/index.js';

const buildWizard = (level: number, INT: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Wizard',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level, hitDiceRemaining: level }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT, WIS: 10, CHA: 10 },
    hp: { current: 1, max: 1, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('computeSpellSaveDC', () => {
  it('Wizard L1 INT 16 → DC 13', () => {
    const r = computeSpellSaveDC({
      character: buildWizard(1, 16),
      itemInstances: {},
      content: TEST_CONTENT,
      classId: 'wizard',
    });
    expect(r.total).toBe(8 + 2 + 3);
  });

  it('Wizard L5 INT 20 → DC 16', () => {
    const r = computeSpellSaveDC({
      character: buildWizard(5, 20),
      itemInstances: {},
      content: TEST_CONTENT,
      classId: 'wizard',
    });
    expect(r.total).toBe(8 + 3 + 5);
  });

  it('Non-caster class returns 0', () => {
    const r = computeSpellSaveDC({
      character: buildWizard(1, 16),
      itemInstances: {},
      content: TEST_CONTENT,
      classId: 'fighter',
    });
    expect(r.total).toBe(0);
    expect(r.breakdown).toHaveLength(0);
  });
});

describe('computeSpellAttackBonus', () => {
  it('Wizard L1 INT 16 → +5', () => {
    const r = computeSpellAttackBonus({
      character: buildWizard(1, 16),
      itemInstances: {},
      content: TEST_CONTENT,
      classId: 'wizard',
    });
    expect(r.total).toBe(2 + 3);
  });

  it('Non-caster class returns 0', () => {
    const r = computeSpellAttackBonus({
      character: buildWizard(1, 16),
      itemInstances: {},
      content: TEST_CONTENT,
      classId: 'fighter',
    });
    expect(r.total).toBe(0);
  });
});
