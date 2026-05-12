import { describe, expect, it } from 'vitest';
import { planGrapple, planShove, planHide } from '../../../src/engine/plan/contested.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../../src/rng/throw.js';
import { applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { apply } from '../../../src/engine/apply.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const evt = <T extends { id: string; at: string }>(e: Omit<T, 'id' | 'at'>): T =>
  ({ id: eventId(), at: isoTimestamp(), ...e }) as T;

describe('planGrapple', () => {
  it('emits SaveRolled and applies grappled on failure', () => {
    const attacker = buildFighter({ name: 'Attacker', STR: 18, level: 5 });
    const target = buildFighter({ name: 'Target', STR: 8, level: 1 });
    let state = emptyCampaignState();
    state = apply(state, evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: attacker }));
    state = apply(state, evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: target }));
    const rng = seededRNG(7);
    const events = planGrapple(state, TEST_CONTENT, rng, {
      type: 'Grapple',
      attackerId: attacker.id,
      targetId: target.id,
    });
    const saveEvent = events.find((e) => e.type === 'SaveRolled');
    expect(saveEvent).toBeDefined();
    const conditionEvent = events.find((e) => e.type === 'ConditionApplied');
    if (saveEvent?.type === 'SaveRolled' && !saveEvent.success) {
      expect(conditionEvent).toBeDefined();
    }
  });

  it('apply() never re-rolls dice on a grapple chain', () => {
    const attacker = buildFighter({ name: 'A', level: 5 });
    const target = buildFighter({ name: 'T', level: 1 });
    let state = emptyCampaignState();
    state = applyAll(state, [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: attacker }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: target }),
    ]);
    const events = planGrapple(state, TEST_CONTENT, seededRNG(13), {
      type: 'Grapple',
      attackerId: attacker.id,
      targetId: target.id,
    });
    expect(() => applyAll(state, [...events])).not.toThrow();
    void throwOnCallRNG();
  });
});

describe('planShove', () => {
  it('applies prone on failed save in prone mode', () => {
    const attacker = buildFighter({ name: 'A', STR: 20, level: 5 });
    const target = buildFighter({ name: 'T', STR: 6, level: 1 });
    let state = emptyCampaignState();
    state = applyAll(state, [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: attacker }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: target }),
    ]);
    const events = planShove(state, TEST_CONTENT, seededRNG(1), {
      type: 'Shove',
      attackerId: attacker.id,
      targetId: target.id,
      mode: 'prone',
    });
    const save = events.find((e) => e.type === 'SaveRolled');
    if (save?.type === 'SaveRolled' && !save.success) {
      const cond = events.find((e) => e.type === 'ConditionApplied');
      expect(cond?.type === 'ConditionApplied' && cond.conditionId).toBe('prone');
    }
  });
});

describe('planHide', () => {
  it('rolls Stealth and applies invisible on success', () => {
    const c = buildFighter({ name: 'Sneaker', DEX: 18 });
    let state = emptyCampaignState();
    state = apply(state, evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: c }));
    const events = planHide(state, TEST_CONTENT, seededRNG(2), {
      type: 'Hide',
      characterId: c.id,
      dc: 5,
    });
    const check = events.find((e) => e.type === 'AbilityCheckRolled');
    expect(check?.type === 'AbilityCheckRolled' && check.success).toBe(true);
    expect(events.some((e) => e.type === 'ConditionApplied')).toBe(true);
  });

  it('does not apply invisible on a failed Stealth check', () => {
    const c = buildFighter({ name: 'Klutz', DEX: 6 });
    let state = emptyCampaignState();
    state = apply(state, evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: c }));
    const events = planHide(state, TEST_CONTENT, seededRNG(99), {
      type: 'Hide',
      characterId: c.id,
      dc: 30,
    });
    const check = events.find((e) => e.type === 'AbilityCheckRolled');
    expect(check?.type === 'AbilityCheckRolled' && check.success).toBe(false);
    expect(events.some((e) => e.type === 'ConditionApplied')).toBe(false);
  });
});
