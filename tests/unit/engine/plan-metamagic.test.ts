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

// Tests Sorcerer Metamagic (sorcery-point spend per option). Bug this
// prevents: a Sorcerer should be able to spend the right number of
// sorcery points for each metamagic option (1 for most, 2 for Quickened,
// 3 for Heightened). Without wiring, sorcery points sit unused.

const PACK = loadStarterPack();

const buildSorcerer = (opts: { sp?: number } = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Aelin',
    speciesId: 'tiefling',
    backgroundId: 'noble',
    classes: [{ classId: 'sorcerer', level: 5, hitDiceRemaining: 5, subclassId: 'draconic-bloodline' }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 18 },
    hp: { current: 32, max: 32, temp: 0 },
    featsTaken: [],
    resources: [{ resourceId: 'sorcery-points', current: opts.sp ?? 5, max: 5 }],
  });

const seed = (sorcerer: Character) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
  let campaign: Campaign = engine.createCampaign({ name: 'meta-test' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign };
};

describe('Metamagic (Sorcerer)', () => {
  it('Distant Spell costs 1 sorcery point', () => {
    const sorc = buildSorcerer();
    const { engine, campaign } = seed(sorc);
    const result = engine.plan.metamagic(campaign.state, { sorcererId: sorc.id, option: 'distant' });
    expect(result.events).toHaveLength(1);
    const updated = commit(campaign, result.events);
    expect(
      updated.state.characters[sorc.id]!.resources.find((r) => r.resourceId === 'sorcery-points')
        ?.current,
    ).toBe(4);
  });

  it('Quickened Spell costs 2 sorcery points', () => {
    const sorc = buildSorcerer();
    const { engine, campaign } = seed(sorc);
    const result = engine.plan.metamagic(campaign.state, { sorcererId: sorc.id, option: 'quickened' });
    const updated = commit(campaign, result.events);
    expect(
      updated.state.characters[sorc.id]!.resources.find((r) => r.resourceId === 'sorcery-points')
        ?.current,
    ).toBe(3);
  });

  it('Heightened Spell costs 3 sorcery points', () => {
    const sorc = buildSorcerer();
    const { engine, campaign } = seed(sorc);
    const result = engine.plan.metamagic(campaign.state, { sorcererId: sorc.id, option: 'heightened' });
    const updated = commit(campaign, result.events);
    expect(
      updated.state.characters[sorc.id]!.resources.find((r) => r.resourceId === 'sorcery-points')
        ?.current,
    ).toBe(2);
  });

  it('throws when insufficient sorcery points (Heightened with 2 SP)', () => {
    const sorc = buildSorcerer({ sp: 2 });
    const { engine, campaign } = seed(sorc);
    expect(() =>
      engine.plan.metamagic(campaign.state, { sorcererId: sorc.id, option: 'heightened' }),
    ).toThrow(/Sorcery Point/);
  });

  it('throws when no sorcery points at all', () => {
    const sorc = buildSorcerer({ sp: 0 });
    const { engine, campaign } = seed(sorc);
    expect(() =>
      engine.plan.metamagic(campaign.state, { sorcererId: sorc.id, option: 'subtle' }),
    ).toThrow(/Sorcery Point/);
  });
});
