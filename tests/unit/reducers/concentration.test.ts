import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { newAppliedConditionId, newEffectInstanceId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ConcentrationBrokenEvent,
  ConcentrationStartedEvent,
} from '../../../src/schemas/events/concentration.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';

const seedCasterAndTarget = () => {
  const caster = buildFighter({ name: 'Caster' });
  const target = buildFighter({ name: 'Target' });
  let state = apply(emptyCampaignState(), {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: caster,
  } satisfies CharacterCreatedEvent);
  state = apply(state, {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: target,
  } satisfies CharacterCreatedEvent);
  return { state, casterId: caster.id, targetId: target.id };
};

describe('ConcentrationStarted reducer', () => {
  it('installs effect instance and sets concentration on caster', () => {
    const { state, casterId, targetId } = seedCasterAndTarget();
    const effectInstanceId = newEffectInstanceId();
    const appliedConditionId = newAppliedConditionId();
    const event: ConcentrationStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConcentrationStarted',
      effectInstanceId,
      casterId,
      spellId: 'hold-person',
      targetIds: [targetId],
      conditionsApplied: [{ targetId, conditionId: 'paralyzed', appliedConditionId }],
    };
    const next = apply(state, event);
    expect(next.effectInstances[effectInstanceId]).toBeDefined();
    expect(next.characters[casterId]?.concentrationEffectId).toBe(effectInstanceId);
  });

  it('rejects duplicate effect-instance id', () => {
    const { state, casterId } = seedCasterAndTarget();
    const effectInstanceId = newEffectInstanceId();
    const event: ConcentrationStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConcentrationStarted',
      effectInstanceId,
      casterId,
      spellId: 'hold-person',
      targetIds: [],
      conditionsApplied: [],
    };
    const once = apply(state, event);
    expect(() => apply(once, event)).toThrow(/already exists/);
  });
});

describe('ConcentrationBroken reducer', () => {
  it('removes the linked applied condition from each target and clears concentration', () => {
    const { state, casterId, targetId } = seedCasterAndTarget();
    const effectInstanceId = newEffectInstanceId();
    const appliedConditionId = newAppliedConditionId();
    const applyCondition: ConditionAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId,
      conditionId: 'paralyzed',
      appliedConditionId,
    };
    const started: ConcentrationStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConcentrationStarted',
      effectInstanceId,
      casterId,
      spellId: 'hold-person',
      targetIds: [targetId],
      conditionsApplied: [{ targetId, conditionId: 'paralyzed', appliedConditionId }],
    };
    const broken: ConcentrationBrokenEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConcentrationBroken',
      effectInstanceId,
      casterId,
      reason: 'failedSave',
    };
    const after = applyAll(state, [applyCondition, started, broken]);
    expect(after.effectInstances[effectInstanceId]).toBeUndefined();
    expect(after.characters[casterId]?.concentrationEffectId).toBeUndefined();
    expect(after.characters[targetId]?.appliedConditions).toHaveLength(0);
  });
});
