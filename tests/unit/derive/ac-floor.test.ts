// Unit tests for the SetACFloor effect kind shipped in slice 74.
// Barkskin (L2) is the canonical example: "AC can't be lower than 17,
// regardless of armor." computeAC computes natural AC first and bumps
// to the floor only if the natural total is below it.

import { describe, expect, it } from 'vitest';
import { computeAC } from '../../../src/derive/ac.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newAppliedConditionId, newCharacterId } from '../../../src/ids.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildCharacter = (overrides: {
  dex?: number;
  applyBarkskin?: boolean;
  applyShieldOfFaith?: boolean;
  natural?: number;
} = {}): Character => {
  const conditions: { id: string; conditionId: string; sourceEventId?: string }[] = [];
  if (overrides.applyBarkskin) {
    conditions.push({
      id: newAppliedConditionId(),
      conditionId: 'barkskin-active',
    });
  }
  if (overrides.applyShieldOfFaith) {
    conditions.push({
      id: newAppliedConditionId(),
      conditionId: 'shield-of-faith-active',
    });
  }
  return CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Subject',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: {
      STR: 10,
      DEX: overrides.dex ?? 14,
      CON: 12,
      INT: 10,
      WIS: 10,
      CHA: 10,
    },
    hp: { current: 25, max: 25, temp: 0 },
    featsTaken: [],
    appliedConditions: conditions,
    ...(overrides.natural !== undefined ? { armorClass: overrides.natural } : {}),
  });
};

describe('SetACFloor (Barkskin) + AddModifier ac (Shield of Faith)', () => {
  it('Barkskin bumps AC to 17 when natural AC is below', () => {
    const target = buildCharacter({ applyBarkskin: true, dex: 14 });
    // Unarmored character: 10 + DEX(2) = 12 natural AC; floor pushes to 17.
    const ac = computeAC({
      character: target,
      itemInstances: {},
      content: CONTENT,
    });
    expect(ac.total).toBe(17);
    const floorEntry = ac.breakdown.find((e) => e.source.startsWith('floor:'));
    expect(floorEntry).toBeDefined();
    expect(floorEntry!.value).toBe(5); // 17 - 12 = +5 bump
  });

  it("Barkskin leaves AC alone when natural AC already meets the floor", () => {
    const target = buildCharacter({ applyBarkskin: true, natural: 18 });
    const ac = computeAC({
      character: target,
      itemInstances: {},
      content: CONTENT,
    });
    expect(ac.total).toBe(18); // natural higher than floor
    const floorEntry = ac.breakdown.find((e) => e.source.startsWith('floor:'));
    expect(floorEntry).toBeUndefined();
  });

  it('Shield of Faith adds +2 to AC via the existing AddModifier path', () => {
    const target = buildCharacter({ applyShieldOfFaith: true, dex: 14 });
    const ac = computeAC({
      character: target,
      itemInstances: {},
      content: CONTENT,
    });
    // 10 + 2 (DEX) + 2 (modifier from Shield of Faith) = 14
    expect(ac.total).toBe(14);
    const modifier = ac.breakdown.find((e) => e.source === 'modifier');
    expect(modifier?.value).toBe(2);
  });

  it('Barkskin + Shield of Faith stack: +2 modifier added before floor check', () => {
    // Natural 10 + DEX(2) + Shield-of-Faith(2) = 14, still below 17.
    // Floor pushes to 17 in addition to the +2 modifier.
    const target = buildCharacter({
      applyBarkskin: true,
      applyShieldOfFaith: true,
      dex: 14,
    });
    const ac = computeAC({
      character: target,
      itemInstances: {},
      content: CONTENT,
    });
    expect(ac.total).toBe(17);
  });
});
