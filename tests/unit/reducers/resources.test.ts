import { describe, expect, it } from 'vitest';
import { apply } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  HitDieSpentEvent,
  ResourceRestoredEvent,
  ResourceSpentEvent,
} from '../../../src/schemas/events/resources.js';

const seed = (overrides: Parameters<typeof buildFighter>[0] = {}) => {
  const character = buildFighter({
    level: 5,
    hpMax: 40,
    hpCurrent: 10,
    resources: [{ resourceId: 'second-wind', current: 2, max: 2 }],
    ...overrides,
  });
  const created: CharacterCreatedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: character,
  };
  return { state: apply(emptyCampaignState(), created), characterId: character.id };
};

describe('ResourceSpent reducer', () => {
  it('decrements resource', () => {
    const { state, characterId } = seed();
    const event: ResourceSpentEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ResourceSpent',
      characterId,
      resourceId: 'second-wind',
      amount: 1,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.resources[0]?.current).toBe(1);
  });

  it('throws when over-spending', () => {
    const { state, characterId } = seed();
    const event: ResourceSpentEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ResourceSpent',
      characterId,
      resourceId: 'second-wind',
      amount: 5,
    };
    expect(() => apply(state, event)).toThrow(/insufficient/);
  });

  it('throws on unknown resource', () => {
    const { state, characterId } = seed();
    const event: ResourceSpentEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ResourceSpent',
      characterId,
      resourceId: 'phantom',
      amount: 1,
    };
    expect(() => apply(state, event)).toThrow(/not on character/);
  });
});

describe('ResourceRestored reducer', () => {
  it('restores numeric amount', () => {
    const { state, characterId } = seed({
      resources: [{ resourceId: 'second-wind', current: 0, max: 2 }],
    });
    const event: ResourceRestoredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ResourceRestored',
      characterId,
      resourceId: 'second-wind',
      amount: 1,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.resources[0]?.current).toBe(1);
  });

  it('amount=all sets to max', () => {
    const { state, characterId } = seed({
      resources: [{ resourceId: 'second-wind', current: 0, max: 2 }],
    });
    const event: ResourceRestoredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ResourceRestored',
      characterId,
      resourceId: 'second-wind',
      amount: 'all',
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.resources[0]?.current).toBe(2);
  });

  it('clamps at max', () => {
    const { state, characterId } = seed();
    const event: ResourceRestoredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ResourceRestored',
      characterId,
      resourceId: 'second-wind',
      amount: 100,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.resources[0]?.current).toBe(2);
  });
});

describe('HitDieSpent reducer', () => {
  it('decrements hit dice and heals (when not at 0)', () => {
    const { state, characterId } = seed();
    const event: HitDieSpentEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'HitDieSpent',
      characterId,
      die: 10,
      rolled: 7,
      conMod: 2,
      healed: 9,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(10 + 9);
    expect(next.characters[characterId]?.classes[0]?.hitDiceRemaining).toBe(4);
  });

  it('throws when no hit dice remain', () => {
    const { state, characterId } = seed({ hitDiceRemaining: 0 });
    const event: HitDieSpentEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'HitDieSpent',
      characterId,
      die: 10,
      rolled: 5,
      conMod: 2,
      healed: 7,
    };
    expect(() => apply(state, event)).toThrow(/No hit dice/);
  });

  it('does not heal at 0 HP', () => {
    const { state, characterId } = seed({ hpCurrent: 0 });
    const event: HitDieSpentEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'HitDieSpent',
      characterId,
      die: 10,
      rolled: 7,
      conMod: 2,
      healed: 9,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(0);
  });
});
