import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests College of Lore (Bard L3) Cutting Words. Bug this prevents:
// a Lore Bard should be able to spend a Bardic Inspiration die to
// debuff another creature's attack/check roll. Without wiring, BI
// dice for this purpose sit unused.

const PACK = loadStarterPack();

const buildBard = (opts: { level?: number; biCurrent?: number } = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Lyric',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [
      {
        classId: 'bard',
        level: opts.level ?? 3,
        hitDiceRemaining: opts.level ?? 3,
        subclassId: 'college-of-lore',
      },
    ],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 12, WIS: 12, CHA: 18 },
    hp: { current: 24, max: 24, temp: 0 },
    featsTaken: [],
    resources: [{ resourceId: 'bardic-inspiration', current: opts.biCurrent ?? 4, max: 4 }],
  });

describe('Cutting Words (College of Lore L3)', () => {
  it('spends a Bardic Inspiration charge and returns a die roll in [1..6] at L3', () => {
    const bard = buildBard();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(7) });
    let campaign: Campaign = engine.createCampaign({ name: 'cw-roll' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bard } satisfies CharacterCreatedEvent,
    ]);
    const outcome = engine.plan.cuttingWords(campaign.state, {
      bardId: bard.id,
      originalRollTotal: 18,
      threshold: 14,
    });
    expect(outcome.dieRoll).toBeGreaterThanOrEqual(1);
    expect(outcome.dieRoll).toBeLessThanOrEqual(6);

    campaign = commit(campaign, outcome.events);
    const after = campaign.state.characters[bard.id]!;
    expect(after.resources.find((r) => r.resourceId === 'bardic-inspiration')?.current).toBe(3);
  });

  it('reports preventedHit=true when the die brings the roll below the threshold', () => {
    // Roll total 14, threshold 14, die >= 1: adjusted is at most 13.
    const bard = buildBard();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'cw-prevent' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bard } satisfies CharacterCreatedEvent,
    ]);
    const outcome = engine.plan.cuttingWords(campaign.state, {
      bardId: bard.id,
      originalRollTotal: 14,
      threshold: 14,
    });
    expect(outcome.preventedHit).toBe(true);
  });

  it('reports preventedHit=false when the die isn\'t enough to flip the outcome', () => {
    // Roll 30 vs threshold 14: any d6 leaves total > threshold.
    const bard = buildBard();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'cw-no-prevent' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bard } satisfies CharacterCreatedEvent,
    ]);
    const outcome = engine.plan.cuttingWords(campaign.state, {
      bardId: bard.id,
      originalRollTotal: 30,
      threshold: 14,
    });
    expect(outcome.preventedHit).toBe(false);
  });

  it('uses a d8 at Bard L5 (Font of Inspiration tier)', () => {
    const bard = buildBard({ level: 5 });
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(3) });
    let campaign: Campaign = engine.createCampaign({ name: 'cw-d8' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bard } satisfies CharacterCreatedEvent,
    ]);
    // Loop seeds to find a die roll > 6 — proves the die is bigger than d6.
    let foundAbove6 = false;
    for (let s = 0; s < 50 && !foundAbove6; s++) {
      const eng = createEngine({ contentPacks: [PACK], rng: seededRNG(s) });
      const c = commit(eng.createCampaign({ name: 'x' }), [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bard } satisfies CharacterCreatedEvent,
      ]);
      const out = eng.plan.cuttingWords(c.state, {
        bardId: bard.id,
        originalRollTotal: 25,
        threshold: 25,
      });
      if (out.dieRoll > 6) foundAbove6 = true;
      expect(out.dieRoll).toBeLessThanOrEqual(8);
    }
    expect(foundAbove6).toBe(true);
  });

  it('throws when the bard has no Bardic Inspiration dice', () => {
    const bard = buildBard({ biCurrent: 0 });
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'cw-no-bi' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bard } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.cuttingWords(campaign.state, {
        bardId: bard.id,
        originalRollTotal: 12,
        threshold: 10,
      }),
    ).toThrow(/Bardic Inspiration/);
  });
});
