// Unit tests for the getEffectiveSpeed retrofit shipped in slice 77.
// Walks the character's full effect stack and folds every
// `ModifySpeed { mode: 'walk' }` entry into the effective walking
// speed. Previously the engine read `character.speedFeet` directly
// and ignored class-feature / condition / spell ModifySpeed effects,
// so Fast Movement / Unarmored Movement / Haste / Fly etc. had no
// effect on actual movement distance.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { getEffectiveSpeed } from '../../../src/engine/plan/_actor-state.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newAppliedConditionId, newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ULID } from '../../../src/engine/ids-utils.js';

const PACK = loadStarterPack();

const buildBarbarian = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ugarth',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'barbarian', level, hitDiceRemaining: level }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
    speedFeet: 30,
  });

const buildFighter = (overrides: { conditions?: { conditionId: string }[] } = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Roy',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 25, max: 25, temp: 0 },
    featsTaken: [],
    speedFeet: 30,
    appliedConditions: (overrides.conditions ?? []).map((c) => ({
      id: newAppliedConditionId() as ULID,
      conditionId: c.conditionId,
    })),
  });

describe('getEffectiveSpeed retrofit', () => {
  it('returns base speed when no ModifySpeed effects apply', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const fighter = buildFighter();
    let campaign = engine.createCampaign({ name: 's' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    expect(
      getEffectiveSpeed({
        character: campaign.state.characters[fighter.id]!,
        content: engine.content,
        itemInstances: campaign.state.itemInstances,
        pendingChoices: campaign.state.pendingChoices,
      }),
    ).toBe(30);
  });

  it('sums additive ModifySpeed effects: Barbarian L5 Fast Movement adds +10', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const barb = buildBarbarian(5);
    let campaign = engine.createCampaign({ name: 'fast' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: barb } satisfies CharacterCreatedEvent,
    ]);
    const speed = getEffectiveSpeed({
      character: campaign.state.characters[barb.id]!,
      content: engine.content,
      itemInstances: campaign.state.itemInstances,
      pendingChoices: campaign.state.pendingChoices,
    });
    expect(speed).toBe(40); // 30 base + 10 Fast Movement
  });

  it("Grappled (set:0 condition) zeroes the character's speed", () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const fighter = buildFighter({ conditions: [{ conditionId: 'grappled' }] });
    let campaign = engine.createCampaign({ name: 'grappled' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    expect(
      getEffectiveSpeed({
        character: campaign.state.characters[fighter.id]!,
        content: engine.content,
        itemInstances: campaign.state.itemInstances,
        pendingChoices: campaign.state.pendingChoices,
      }),
    ).toBe(0);
  });

  it('Hasted-active condition (multiply x2) doubles walking speed', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const fighter = buildFighter({ conditions: [{ conditionId: 'hasted-active' }] });
    let campaign = engine.createCampaign({ name: 'hasted' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    expect(
      getEffectiveSpeed({
        character: campaign.state.characters[fighter.id]!,
        content: engine.content,
        itemInstances: campaign.state.itemInstances,
        pendingChoices: campaign.state.pendingChoices,
      }),
    ).toBe(60); // 30 base * 2 from Haste
  });

  it('zero-speed beats multipliers: Hasted + Grappled is still 0', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const fighter = buildFighter({
      conditions: [{ conditionId: 'hasted-active' }, { conditionId: 'grappled' }],
    });
    let campaign = engine.createCampaign({ name: 'hg' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    expect(
      getEffectiveSpeed({
        character: campaign.state.characters[fighter.id]!,
        content: engine.content,
        itemInstances: campaign.state.itemInstances,
        pendingChoices: campaign.state.pendingChoices,
      }),
    ).toBe(0);
  });
});
