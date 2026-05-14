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

// Tests Path of the Berserker (Barbarian L3) Frenzy. Bug this prevents:
// a Berserker who Frenzies should consume a Rage charge and gain the
// frenzied condition. The full Rage mechanic (damage resistance + the
// bonus-action attack grant + end-of-rage exhaustion) is consumer-
// driven until Rage gets its own planner slice.

const PACK = loadStarterPack();

const buildBerserker = (opts: { rageCurrent?: number } = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Korg',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [
      { classId: 'barbarian', level: 3, hitDiceRemaining: 3, subclassId: 'path-of-the-berserker' },
    ],
    abilityScores: { STR: 18, DEX: 12, CON: 16, INT: 8, WIS: 10, CHA: 10 },
    hp: { current: 32, max: 32, temp: 0 },
    featsTaken: [],
    resources: [{ resourceId: 'rage', current: opts.rageCurrent ?? 3, max: 3 }],
  });

describe('Frenzy (Path of the Berserker L3)', () => {
  it('spends 1 Rage charge and applies the frenzied condition', () => {
    const barb = buildBerserker();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'frenzy' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: barb } satisfies CharacterCreatedEvent,
    ]);
    const result = engine.plan.frenzy(campaign.state, { combatantId: barb.id });
    const types = result.events.map((e) => e.type);
    expect(types).toEqual(['ResourceSpent', 'ConditionApplied']);

    campaign = commit(campaign, result.events);
    const after = campaign.state.characters[barb.id]!;
    expect(after.resources.find((r) => r.resourceId === 'rage')?.current).toBe(2);
    expect(after.appliedConditions.some((c) => c.conditionId === 'frenzied')).toBe(true);
  });

  it('throws when no Rage is available', () => {
    const barb = buildBerserker({ rageCurrent: 0 });
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'no-rage' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: barb } satisfies CharacterCreatedEvent,
    ]);
    expect(() => engine.plan.frenzy(campaign.state, { combatantId: barb.id })).toThrow(/Rage/);
  });

  it('throws on unknown character', () => {
    const engine = createEngine({ contentPacks: [PACK] });
    const campaign: Campaign = engine.createCampaign({ name: 'unknown' });
    expect(() =>
      engine.plan.frenzy(campaign.state, { combatantId: '01HKQM3J6S1H4ZGSTPYBHN0VCS' }),
    ).toThrow(/Unknown character/);
  });
});
