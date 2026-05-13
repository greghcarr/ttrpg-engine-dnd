import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildArchwizard = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Archwiz',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 17, hitDiceRemaining: 17 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 20, WIS: 14, CHA: 12 },
    hp: { current: 100, max: 100, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildHumanoidTarget = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 44, max: 44, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('planSimulacrum', () => {
  it('emits cast + slot + SimulacrumCreated at half-HP', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildArchwizard(['simulacrum']);
    const target = buildHumanoidTarget('Volunteer');
    let campaign = engine.createCampaign({ name: 'sim' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const outcome = engine.plan.simulacrum(campaign.state, {
      casterId: caster.id,
      targetId: target.id,
      materialsConsumed: true,
    });
    const types = outcome.events.map((e) => e.type);
    expect(types).toEqual(['SpellCastDeclared', 'SpellSlotConsumed', 'SimulacrumCreated']);
    const sim = outcome.events.find((e) => e.type === 'SimulacrumCreated');
    if (sim?.type === 'SimulacrumCreated') {
      expect(sim.hpMax).toBe(22); // floor(44 / 2)
      expect(sim.originalId).toBe(target.id);
    }
    // Commit and verify the simulacrum exists.
    const after = commit(campaign, outcome.events);
    expect(after.state.characters[outcome.simulacrumId]).toBeDefined();
  });

  it('rejects without materials consumed', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildArchwizard(['simulacrum']);
    const target = buildHumanoidTarget('Volunteer');
    let campaign = engine.createCampaign({ name: 'sim-no-ruby' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.simulacrum(campaign.state, {
        casterId: caster.id,
        targetId: target.id,
        materialsConsumed: false,
      }),
    ).toThrow(/ruby/);
  });

  it('rejects a second simulacrum of the same target', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildArchwizard(['simulacrum']);
    const target = buildHumanoidTarget('Twin');
    let campaign = engine.createCampaign({ name: 'sim-twice' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const first = engine.plan.simulacrum(campaign.state, {
      casterId: caster.id,
      targetId: target.id,
      materialsConsumed: true,
    });
    campaign = commit(campaign, first.events);
    expect(() =>
      engine.plan.simulacrum(campaign.state, {
        casterId: caster.id,
        targetId: target.id,
        materialsConsumed: true,
      }),
    ).toThrow(/already has an active Simulacrum/);
  });

  it('rejects when caster does not know the spell', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildArchwizard([]); // no simulacrum
    const target = buildHumanoidTarget('Volunteer');
    let campaign = engine.createCampaign({ name: 'sim-unknown' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.simulacrum(campaign.state, {
        casterId: caster.id,
        targetId: target.id,
        materialsConsumed: true,
      }),
    ).toThrow(/Simulacrum/);
  });
});

describe('planWish', () => {
  it('predefined effect bypasses the stress cascade', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildArchwizard(['wish']);
    let campaign = engine.createCampaign({ name: 'wish-safe' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    ]);
    const outcome = engine.plan.wish(campaign.state, {
      granterId: caster.id,
      description: 'Heal all my allies (mass cure wounds).',
      predefinedEffect: 'cure-wounds-mass',
    });
    expect(outcome.stressApplied).toBe(false);
    const types = outcome.events.map((e) => e.type);
    expect(types).toEqual(['SpellCastDeclared', 'SpellSlotConsumed', 'WishGranted']);
  });

  it('freeform wish: stress cascade fires on a low d100 (≤33), exhaustion follows', () => {
    const PACK = loadStarterPack();
    let foundStressed = false;
    for (let seed = 0; seed < 50 && !foundStressed; seed++) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const caster = buildArchwizard(['wish']);
      let campaign = engine.createCampaign({ name: 'wish-stress' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      ]);
      const outcome = engine.plan.wish(campaign.state, {
        granterId: caster.id,
        description: 'Reshape reality so the dragon was always a kitten.',
      });
      if (outcome.stressApplied) {
        const types = outcome.events.map((e) => e.type);
        expect(types).toContain('ExhaustionChanged');
        foundStressed = true;
      }
    }
    expect(foundStressed).toBe(true);
  });

  it('rejects under 9th-level slot', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildArchwizard(['wish']);
    let campaign = engine.createCampaign({ name: 'wish-lowslot' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.wish(campaign.state, {
        granterId: caster.id,
        description: 'wish',
        slotLevel: 8,
      }),
    ).toThrow(/9th-level/);
  });
});
