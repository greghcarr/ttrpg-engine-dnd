import { describe, expect, it } from 'vitest';
import { computeAttackBonus } from '../../../src/derive/attack.js';
import { buildFighter, makeItemInstance, TEST_CONTENT } from '../../fixtures/index.js';

describe('computeAttackBonus', () => {
  it('STR melee weapon: STR mod + prof', () => {
    const longsword = makeItemInstance('longsword');
    const character = buildFighter({ STR: 16, level: 1 });
    const r = computeAttackBonus({
      character,
      itemInstances: { [longsword.id]: longsword },
      content: TEST_CONTENT,
      weaponInstanceId: longsword.id,
    });
    expect(r.total).toBe(3 + 2);
  });

  it('DEX finesse: picks DEX when higher than STR', () => {
    const rapier = makeItemInstance('rapier');
    const character = buildFighter({ STR: 10, DEX: 18, level: 1 });
    const r = computeAttackBonus({
      character,
      itemInstances: { [rapier.id]: rapier },
      content: TEST_CONTENT,
      weaponInstanceId: rapier.id,
    });
    expect(r.total).toBe(4 + 2);
  });

  it('DEX finesse: picks STR when higher than DEX', () => {
    const rapier = makeItemInstance('rapier');
    const character = buildFighter({ STR: 18, DEX: 10, level: 1 });
    const r = computeAttackBonus({
      character,
      itemInstances: { [rapier.id]: rapier },
      content: TEST_CONTENT,
      weaponInstanceId: rapier.id,
    });
    expect(r.total).toBe(4 + 2);
  });

  it('ranged: DEX-based', () => {
    const longbow = makeItemInstance('longbow');
    const character = buildFighter({ STR: 18, DEX: 14, level: 1 });
    const r = computeAttackBonus({
      character,
      itemInstances: { [longbow.id]: longbow },
      content: TEST_CONTENT,
      weaponInstanceId: longbow.id,
    });
    expect(r.total).toBe(2 + 2);
  });

  it('higher levels: prof bonus rises', () => {
    const longsword = makeItemInstance('longsword');
    const character = buildFighter({ STR: 16, level: 5 });
    const r = computeAttackBonus({
      character,
      itemInstances: { [longsword.id]: longsword },
      content: TEST_CONTENT,
      weaponInstanceId: longsword.id,
    });
    expect(r.total).toBe(3 + 3);
  });

  it('throws on unknown weapon instance id', () => {
    const character = buildFighter();
    expect(() =>
      computeAttackBonus({
        character,
        itemInstances: {},
        content: TEST_CONTENT,
        weaponInstanceId: 'NOT-A-REAL-ID-AT-ALL-0000',
      }),
    ).toThrow(/Unknown weapon/);
  });

  it('throws when instance is not a weapon', () => {
    const armor = makeItemInstance('leather-armor');
    const character = buildFighter();
    expect(() =>
      computeAttackBonus({
        character,
        itemInstances: { [armor.id]: armor },
        content: TEST_CONTENT,
        weaponInstanceId: armor.id,
      }),
    ).toThrow(/not a weapon/);
  });

  it('non-proficient weapon: only ability mod', async () => {
    const { CharacterSchema } = await import('../../../src/schemas/runtime/character.js');
    const { newCharacterId } = await import('../../../src/ids.js');
    const wizard = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'W',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 14, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 1, max: 1, temp: 0 },
      featsTaken: ['savage-attacker'],
    });
    const longsword = makeItemInstance('longsword');
    const r = computeAttackBonus({
      character: wizard,
      itemInstances: { [longsword.id]: longsword },
      content: TEST_CONTENT,
      weaponInstanceId: longsword.id,
    });
    expect(r.total).toBe(2);
  });
});
