import { describe, expect, it } from 'vitest';
import { apply } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ConditionAppliedEvent,
  ConditionRemovedEvent,
  ExhaustionChangedEvent,
} from '../../../src/schemas/events/combat.js';

const seedFighter = () => {
  const character = buildFighter();
  const created: CharacterCreatedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: character,
  };
  const state = apply(emptyCampaignState(), created);
  return { state, characterId: character.id };
};

describe('ConditionApplied reducer', () => {
  it('adds a condition', () => {
    const { state, characterId } = seedFighter();
    const event: ConditionAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: characterId,
      conditionId: 'prone',
    };
    const next = apply(state, event);
    expect(
      next.characters[characterId]?.appliedConditions.some((c) => c.conditionId === 'prone'),
    ).toBe(true);
  });

  it('does not add duplicates of non-stackable conditions', () => {
    const { state, characterId } = seedFighter();
    const event: ConditionAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: characterId,
      conditionId: 'prone',
    };
    const once = apply(state, event);
    const twice = apply(once, event);
    expect(
      twice.characters[characterId]?.appliedConditions.filter((c) => c.conditionId === 'prone'),
    ).toHaveLength(1);
  });

  it('exhaustion stacks via level increment', () => {
    const { state, characterId } = seedFighter();
    const event: ConditionAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: characterId,
      conditionId: 'exhaustion',
    };
    let s = apply(state, event);
    s = apply(s, event);
    s = apply(s, event);
    expect(s.characters[characterId]?.exhaustion).toBe(3);
  });

  it('exhaustion caps at 6', () => {
    const { state, characterId } = seedFighter();
    let s = state;
    for (let i = 0; i < 10; i++) {
      s = apply(s, {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: characterId,
        conditionId: 'exhaustion',
      } satisfies ConditionAppliedEvent);
    }
    expect(s.characters[characterId]?.exhaustion).toBe(6);
  });
});

describe('ConditionRemoved reducer', () => {
  it('removes a condition', () => {
    const { state, characterId } = seedFighter();
    const apply1 = apply(state, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: characterId,
      conditionId: 'prone',
    } satisfies ConditionAppliedEvent);
    const apply2 = apply(apply1, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionRemoved',
      targetId: characterId,
      conditionId: 'prone',
    } satisfies ConditionRemovedEvent);
    expect(apply2.characters[characterId]?.appliedConditions).toHaveLength(0);
  });

  it('removing a non-present condition is a no-op', () => {
    const { state, characterId } = seedFighter();
    const event: ConditionRemovedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionRemoved',
      targetId: characterId,
      conditionId: 'prone',
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.appliedConditions).toHaveLength(0);
  });
});

describe('ExhaustionChanged reducer', () => {
  it('updates exhaustion level', () => {
    const { state, characterId } = seedFighter();
    const event: ExhaustionChangedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ExhaustionChanged',
      targetId: characterId,
      fromLevel: 0,
      toLevel: 3,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.exhaustion).toBe(3);
  });

  it('rejects mismatched from-level', () => {
    const { state, characterId } = seedFighter();
    const event: ExhaustionChangedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ExhaustionChanged',
      targetId: characterId,
      fromLevel: 5,
      toLevel: 6,
    };
    expect(() => apply(state, event)).toThrow(/Exhaustion mismatch/);
  });
});
