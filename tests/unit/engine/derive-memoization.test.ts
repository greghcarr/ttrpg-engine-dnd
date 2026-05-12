import { describe, expect, it, vi } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { commit } from '../../../src/engine/commit.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import * as ac from '../../../src/derive/ac.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';

const evt = <T extends { id: string; at: string }>(e: Omit<T, 'id' | 'at'>): T =>
  ({ id: eventId(), at: isoTimestamp(), ...e }) as T;

describe('derive memoization', () => {
  it('returns the same object reference on repeated calls at the same state version', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx' });
    let campaign = engine.createCampaign({ name: 'memo' });
    campaign = commit(campaign, [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    ]);
    const a1 = engine.derive.character(campaign.state, alyx.id);
    const a2 = engine.derive.character(campaign.state, alyx.id);
    expect(a1).toBe(a2);
  });

  it('invalidates the cache when state.version advances', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx' });
    let campaign = engine.createCampaign({ name: 'memo' });
    campaign = commit(campaign, [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    ]);
    const before = engine.derive.character(campaign.state, alyx.id);
    campaign = commit(campaign, [
      evt<DamageAppliedEvent>({
        type: 'DamageApplied',
        targetId: alyx.id,
        components: [{ amount: 3, type: 'slashing' }],
      }),
    ]);
    const after = engine.derive.character(campaign.state, alyx.id);
    expect(after).not.toBe(before);
    expect(after.hp.current).toBe(before.hp.current - 3);
  });

  it('only calls the underlying compute function once per state version', () => {
    const spy = vi.spyOn(ac, 'computeAC');
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx' });
    let campaign = engine.createCampaign({ name: 'memo' });
    campaign = commit(campaign, [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    ]);
    const startCount = spy.mock.calls.length;
    engine.derive.ac(campaign.state, alyx.id);
    engine.derive.ac(campaign.state, alyx.id);
    engine.derive.ac(campaign.state, alyx.id);
    expect(spy.mock.calls.length).toBe(startCount + 1);
    spy.mockRestore();
  });
});
