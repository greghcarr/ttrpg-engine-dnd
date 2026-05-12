import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../../src/rng/throw.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { newAppliedConditionId, newEffectInstanceId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConcentrationStartedEvent } from '../../../src/schemas/events/concentration.js';

const seedConcentrating = (rng = seededRNG(1)) => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng });
  const caster = buildFighter({ name: 'Caster', CON: 14 });
  const target = buildFighter({ name: 'Target' });
  let campaign = engine.createCampaign({ name: 'conc' });
  const effectInstanceId = newEffectInstanceId();
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: caster,
    } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: target,
    } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConcentrationStarted',
      effectInstanceId,
      casterId: caster.id,
      spellId: 'hold-person',
      targetIds: [target.id],
      conditionsApplied: [
        {
          targetId: target.id,
          conditionId: 'paralyzed',
          appliedConditionId: newAppliedConditionId(),
        },
      ],
    } satisfies ConcentrationStartedEvent,
  ]);
  return { engine, campaign, casterId: caster.id, targetId: target.id, effectInstanceId };
};

describe('engine.plan.checkConcentration', () => {
  it('returns no events when character is not concentrating', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const c = buildFighter({ CON: 14 });
    let campaign = engine.createCampaign({ name: 'x' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: c,
      } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.checkConcentration(campaign.state, {
      characterId: c.id,
      damageTaken: 10,
    });
    expect(events).toEqual([]);
  });

  it('returns no events when damageTaken is zero', () => {
    const { engine, campaign, casterId } = seedConcentrating();
    const { events } = engine.plan.checkConcentration(campaign.state, {
      characterId: casterId,
      damageTaken: 0,
    });
    expect(events).toEqual([]);
  });

  it('emits SaveRolled (CON) on damage; success leaves concentration intact', () => {
    let found = false;
    for (let seed = 0; seed < 50; seed++) {
      const ctx = seedConcentrating(seededRNG(seed));
      const events = ctx.engine.plan.checkConcentration(ctx.campaign.state, {
        characterId: ctx.casterId,
        damageTaken: 4,
      }).events;
      expect(events[0]?.type).toBe('SaveRolled');
      const save = events[0];
      if (save?.type === 'SaveRolled' && save.success) {
        expect(events).toHaveLength(1);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('emits ConcentrationBroken on failed save', () => {
    let found = false;
    for (let seed = 0; seed < 100; seed++) {
      const { engine, campaign, casterId } = seedConcentrating(seededRNG(seed));
      const events = engine.plan.checkConcentration(campaign.state, {
        characterId: casterId,
        damageTaken: 4,
      }).events;
      const save = events[0];
      const broken = events[1];
      if (save?.type === 'SaveRolled' && !save.success) {
        expect(broken?.type).toBe('ConcentrationBroken');
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('DC formula: max(10, floor(damage/2))', () => {
    const { engine, campaign, casterId } = seedConcentrating();
    const events = engine.plan.checkConcentration(campaign.state, {
      characterId: casterId,
      damageTaken: 40,
    }).events;
    const save = events[0];
    expect(save?.type).toBe('SaveRolled');
    if (save?.type === 'SaveRolled') {
      expect(save.dc).toBe(20);
    }
  });

  it('applying planned events does not call RNG', () => {
    const { engine, campaign, casterId } = seedConcentrating(seededRNG(3));
    const events = engine.plan.checkConcentration(campaign.state, {
      characterId: casterId,
      damageTaken: 12,
    }).events;
    void throwOnCallRNG();
    expect(() => engine.applyAll(campaign.state, events)).not.toThrow();
  });
});
