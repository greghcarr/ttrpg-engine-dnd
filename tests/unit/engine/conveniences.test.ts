import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import {
  createPC,
  loadCampaign,
  serializeCampaign,
} from '../../../src/engine/conveniences.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';
import { commit } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ItemAcquiredEvent } from '../../../src/schemas/events/inventory.js';

const evt = <T extends { id: string; at: string }>(e: Omit<T, 'id' | 'at'>): T =>
  ({ id: eventId(), at: isoTimestamp(), ...e }) as T;

describe('engine.do', () => {
  it('plans + commits an attack in one call', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx', STR: 18 });
    const goblin = buildFighter({ name: 'Goblin', hpMax: 8 });
    const sword = makeItemInstance('longsword');
    let campaign = engine.createCampaign({ name: 'demo' });
    campaign = commit(campaign, [
      evt<ItemAcquiredEvent>({ type: 'ItemAcquired', instance: sword }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: goblin }),
    ]);
    const before = campaign.events.length;
    campaign = engine.do(campaign, {
      type: 'Attack',
      attackerId: alyx.id,
      targetId: goblin.id,
      weaponInstanceId: sword.id,
    });
    expect(campaign.events.length).toBeGreaterThan(before);
  });

  it('throws on unknown intent type', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const campaign = engine.createCampaign({ name: 'x' });
    expect(() => engine.do(campaign, { type: 'Nonexistent' })).toThrow(/Unknown intent/);
  });
});

describe('serializeCampaign and loadCampaign', () => {
  it('round-trips a campaign via JSON', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(2) });
    const alyx = buildFighter({ name: 'Alyx' });
    let campaign = engine.createCampaign({ name: 'rt' });
    campaign = commit(campaign, [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    ]);
    const json = serializeCampaign(campaign);
    const restored = loadCampaign(json);
    expect(restored.id).toBe(campaign.id);
    expect(restored.name).toBe(campaign.name);
    expect(restored.events.length).toBe(campaign.events.length);
    expect(JSON.stringify(restored.state)).toBe(JSON.stringify(campaign.state));
  });

  it('rejects an invalid serialized payload', () => {
    expect(() => loadCampaign(JSON.stringify({ bogus: true }))).toThrow();
  });
});

describe('createPC', () => {
  it('builds a Character with defaults and sensible HP', () => {
    const pc = createPC({
      name: 'Defaults',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'fighter',
      hpMax: 12,
    });
    expect(pc.name).toBe('Defaults');
    expect(pc.hp).toEqual({ current: 12, max: 12, temp: 0 });
    expect(pc.classes[0]?.level).toBe(1);
    expect(pc.abilityScores.STR).toBe(14);
  });

  it('honours overrides', () => {
    const pc = createPC({
      name: 'Custom',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'wizard',
      level: 5,
      hpMax: 30,
      hpCurrent: 18,
      abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    });
    expect(pc.classes[0]?.level).toBe(5);
    expect(pc.hp.current).toBe(18);
    expect(pc.abilityScores.INT).toBe(18);
  });
});
