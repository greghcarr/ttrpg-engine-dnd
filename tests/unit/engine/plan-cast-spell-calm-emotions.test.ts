import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Calm Emotions's cast-time variant choice. The variant flag
// determines which condition applies on a failed CHA save. Mirrors the
// enlarge-reduce test pattern but exercises the *save*-mechanic side
// of casterChoosesVariant (slice 83 wired the buff side; this slice
// extends it to save mechanics).

const PACK = loadStarterPack();

const buildBard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Calm Tester',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'bard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 12, WIS: 12, CHA: 18 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
    preparedSpells: ['calm-emotions'],
  });

const buildLowCHATarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 6 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildCampaign = (caster: Character, target: Character, seed: number) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  let campaign: Campaign = engine.createCampaign({ name: `calm-${seed}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign };
};

// Finds a seed where the low-CHA target fails its save. The bard's
// spell DC is high (PB 3 + CHA 4 = DC 15) and the target's CHA save
// modifier is -2, so most seeds will fail. We just need at least one.
const castUntilFail = (
  caster: Character,
  target: Character,
  variantKey: string,
): ConditionAppliedEvent => {
  for (const seed of [1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]) {
    const { engine, campaign } = buildCampaign(caster, target, seed);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: caster.id,
      spellId: 'calm-emotions',
      slotLevel: 2,
      targetIds: [target.id],
      casterChoice: { kind: 'variant', value: variantKey },
    }).events;
    const applied = events.find((e) => e.type === 'ConditionApplied') as ConditionAppliedEvent | undefined;
    if (applied !== undefined) return applied;
  }
  throw new Error(`No seed in the test set produced a failed CHA save for variant ${variantKey}`);
};

describe('Calm Emotions caster-chosen variant (save mechanic)', () => {
  it("the 'suppress' variant applies emotion-suppressed-active on failed save", () => {
    const applied = castUntilFail(buildBard(), buildLowCHATarget(), 'suppress');
    expect(applied.conditionId).toBe('emotion-suppressed-active');
  });

  it("the 'indifferent' variant applies emotionally-indifferent-active on failed save", () => {
    const applied = castUntilFail(buildBard(), buildLowCHATarget(), 'indifferent');
    expect(applied.conditionId).toBe('emotionally-indifferent-active');
  });

  it('throws when no casterChoice is supplied', () => {
    const { engine, campaign } = buildCampaign(buildBard(), buildLowCHATarget(), 0);
    const [caster, target] = Object.values(campaign.state.characters);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster!.id,
        spellId: 'calm-emotions',
        slotLevel: 2,
        targetIds: [target!.id],
      }),
    ).toThrow(/casterChoice/);
  });

  it("throws when the variant key isn't in the spell's list", () => {
    const { engine, campaign } = buildCampaign(buildBard(), buildLowCHATarget(), 0);
    const [caster, target] = Object.values(campaign.state.characters);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster!.id,
        spellId: 'calm-emotions',
        slotLevel: 2,
        targetIds: [target!.id],
        casterChoice: { kind: 'variant', value: 'enrage' },
      }),
    ).toThrow(/not in allowed list/);
  });
});
