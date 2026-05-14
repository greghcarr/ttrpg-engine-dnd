import { describe, expect, it } from 'vitest';
import { computeAbilityCheck } from '../../../src/derive/ability-check.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';

// Tests Bard L2 Jack of All Trades. Bug this prevents: a Bard L2 with
// no Athletics proficiency should add +1 (half prof bonus, floor) to
// their STR check; without the wiring they get only the STR mod.

const CONTENT = resolveContent([loadStarterPack()]);

const buildBard = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: `Bard L${level}`,
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'bard', level, hitDiceRemaining: level }],
    abilityScores: { STR: 10, DEX: 14, CON: 12, INT: 12, WIS: 10, CHA: 16 },
    hp: { current: 16, max: 16, temp: 0 },
    featsTaken: [],
  });

const buildFighter = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: `Fighter L${level}`,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level, hitDiceRemaining: level }],
    abilityScores: { STR: 10, DEX: 14, CON: 12, INT: 12, WIS: 10, CHA: 10 },
    hp: { current: 12, max: 12, temp: 0 },
    featsTaken: [],
  });

describe('Jack of All Trades (Bard L2)', () => {
  it('adds floor(profBonus/2) = 1 to a raw STR check at L2 (prof bonus 2)', () => {
    const bard = buildBard(2);
    const r = computeAbilityCheck({
      character: bard,
      itemInstances: {},
      content: CONTENT,
      ability: 'STR',
    });
    // STR 10 → mod 0; +1 from Jack (half of profBonus 2). Total 1.
    expect(r.total).toBe(1);
    expect(r.breakdown.some((b) => b.source === 'jack-of-all-trades')).toBe(true);
  });

  it('scales with proficiency bonus: a Bard L5 (prof 3) adds +1 (floor of 1.5)', () => {
    const bard = buildBard(5);
    const r = computeAbilityCheck({
      character: bard,
      itemInstances: {},
      content: CONTENT,
      ability: 'STR',
    });
    expect(r.breakdown.find((b) => b.source === 'jack-of-all-trades')?.value).toBe(1);
  });

  it('Bard L9 (prof 4) adds +2 to a non-proficient check', () => {
    const bard = buildBard(9);
    const r = computeAbilityCheck({
      character: bard,
      itemInstances: {},
      content: CONTENT,
      ability: 'STR',
    });
    expect(r.breakdown.find((b) => b.source === 'jack-of-all-trades')?.value).toBe(2);
  });

  it('does NOT stack on a proficient skill check (full expertise wins)', () => {
    // Bard L3 gains Expertise in Insight + Persuasion via the wired
    // `expertise-bard` class feature. A WIS (Insight) check should
    // take the full expertise prof, NOT add Jack on top.
    const bard = buildBard(3);
    const r = computeAbilityCheck({
      character: bard,
      itemInstances: {},
      content: CONTENT,
      ability: 'WIS',
      skill: 'insight',
    });
    expect(r.breakdown.some((b) => b.source === 'jack-of-all-trades')).toBe(false);
    expect(r.breakdown.some((b) => b.source === 'skill-prof(expertise)')).toBe(true);
  });

  it('non-Bard does NOT get the half-prof bonus', () => {
    const fighter = buildFighter(2);
    const r = computeAbilityCheck({
      character: fighter,
      itemInstances: {},
      content: CONTENT,
      ability: 'STR',
    });
    expect(r.breakdown.some((b) => b.source === 'jack-of-all-trades')).toBe(false);
    expect(r.total).toBe(0);
  });

  it('Bard L1 (pre-L2) does NOT have Jack of All Trades yet', () => {
    const bard = buildBard(1);
    const r = computeAbilityCheck({
      character: bard,
      itemInstances: {},
      content: CONTENT,
      ability: 'STR',
    });
    expect(r.breakdown.some((b) => b.source === 'jack-of-all-trades')).toBe(false);
  });

  it('applies to skill checks where the actor has no proficiency in the skill', () => {
    const bard = buildBard(2);
    // Athletics (STR) is not proficient at L2 (the bard takes no
    // explicit skill choice in the fixture). Jack should apply.
    const r = computeAbilityCheck({
      character: bard,
      itemInstances: {},
      content: CONTENT,
      ability: 'STR',
      skill: 'athletics',
    });
    expect(r.breakdown.some((b) => b.source === 'jack-of-all-trades')).toBe(true);
  });
});
