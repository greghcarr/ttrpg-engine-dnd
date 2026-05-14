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

// Tests Druid L2 Wild Companion. Bug this prevents: a Druid should be
// able to spend a Wild Shape charge to summon a familiar. The familiar
// itself isn't a first-class entity in the engine yet; this wires the
// resource-spend side so the feature is no longer inert.

const PACK = loadStarterPack();

const buildDruid = (opts: { level?: number; wildShape?: number } = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Saoirse',
    speciesId: 'elf',
    backgroundId: 'outlander',
    classes: [{ classId: 'druid', level: opts.level ?? 3, hitDiceRemaining: opts.level ?? 3 }],
    abilityScores: { STR: 10, DEX: 14, CON: 14, INT: 12, WIS: 16, CHA: 10 },
    hp: { current: 20, max: 20, temp: 0 },
    featsTaken: [],
    resources: [{ resourceId: 'wild-shape', current: opts.wildShape ?? 2, max: 2 }],
  });

describe('Wild Companion (Druid L2)', () => {
  it('expends one Wild Shape charge', () => {
    const druid = buildDruid();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'wc' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
    ]);
    const result = engine.plan.wildCompanion(campaign.state, { druidId: druid.id });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe('ResourceSpent');

    const updated = commit(campaign, result.events);
    expect(
      updated.state.characters[druid.id]!.resources.find((r) => r.resourceId === 'wild-shape')
        ?.current,
    ).toBe(1);
  });

  it('throws when no Wild Shape charges remain', () => {
    const druid = buildDruid({ wildShape: 0 });
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'wc-empty' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
    ]);
    expect(() => engine.plan.wildCompanion(campaign.state, { druidId: druid.id })).toThrow(
      /Wild Shape/,
    );
  });

  it('throws on non-Druid actors', () => {
    const fighter = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Fighter',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 40, max: 40, temp: 0 },
      featsTaken: [],
    });
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'wc-non-druid' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    expect(() => engine.plan.wildCompanion(campaign.state, { druidId: fighter.id })).toThrow(
      /druid/,
    );
  });
});
