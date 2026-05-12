import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../../src/rng/throw.js';
import {
  TEST_PACK,
  buildFighter,
  eventId,
  isoTimestamp,
  makeItemInstance,
} from '../../fixtures/index.js';
import { commit } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ItemInstance } from '../../../src/schemas/runtime/item-instance.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import type { Campaign } from '../../../src/engine/commit.js';

const seedFightWithLongsword = (rng = seededRNG(42)) => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng });
  const longsword: ItemInstance = makeItemInstance('longsword');
  const armor: ItemInstance = makeItemInstance('chain-mail');
  const attacker = buildFighter({ STR: 18 });
  const target = buildFighter({ hpMax: 30, hpCurrent: 30, armorInstanceId: armor.id });
  let campaign: Campaign = engine.createCampaign({ name: 'fight' });
  const create1: CharacterCreatedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: attacker,
  };
  const create2: CharacterCreatedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: target,
  };
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: armor },
    create1,
    create2,
  ]);
  return { engine, campaign, attackerId: attacker.id, targetId: target.id, weaponId: longsword.id };
};

describe('engine.plan.attack', () => {
  it('produces AttackRolled, DamageRolled, DamageApplied on hit', () => {
    const { engine, campaign, attackerId, targetId, weaponId } = seedFightWithLongsword();
    const { events } = engine.plan.attack(campaign.state, {
      attackerId,
      targetId,
      weaponInstanceId: weaponId,
      at: '2026-01-01T00:00:00.000Z',
    });
    const types = events.map((e) => e.type);
    if (types[0] === 'AttackRolled' && (events[0] as AttackRolledEvent).hit) {
      expect(types).toEqual(['AttackRolled', 'DamageRolled', 'DamageApplied']);
    } else {
      expect(types).toEqual(['AttackRolled']);
    }
  });

  it('plan is deterministic given a seeded RNG', () => {
    const a = seedFightWithLongsword(seededRNG(123));
    const b = seedFightWithLongsword(seededRNG(123));
    const evA = a.engine.plan.attack(a.campaign.state, {
      attackerId: a.attackerId,
      targetId: a.targetId,
      weaponInstanceId: a.weaponId,
      at: '2026-01-01T00:00:00.000Z',
    }).events;
    const evB = b.engine.plan.attack(b.campaign.state, {
      attackerId: b.attackerId,
      targetId: b.targetId,
      weaponInstanceId: b.weaponId,
      at: '2026-01-01T00:00:00.000Z',
    }).events;
    expect(evA.map((e) => e.type)).toEqual(evB.map((e) => e.type));
    const a0 = evA[0] as AttackRolledEvent;
    const b0 = evB[0] as AttackRolledEvent;
    expect(a0.d20).toEqual(b0.d20);
  });

  it('different seeds produce different rolls', () => {
    const a = seedFightWithLongsword(seededRNG(1));
    const b = seedFightWithLongsword(seededRNG(2));
    const a0 = a.engine.plan.attack(a.campaign.state, {
      attackerId: a.attackerId,
      targetId: a.targetId,
      weaponInstanceId: a.weaponId,
    }).events[0] as AttackRolledEvent;
    const b0 = b.engine.plan.attack(b.campaign.state, {
      attackerId: b.attackerId,
      targetId: b.targetId,
      weaponInstanceId: b.weaponId,
    }).events[0] as AttackRolledEvent;
    expect(a0.d20).not.toEqual(b0.d20);
  });

  it('advantage rolls two d20 and keeps the higher', () => {
    const { engine, campaign, attackerId, targetId, weaponId } = seedFightWithLongsword();
    const events = engine.plan.attack(campaign.state, {
      attackerId,
      targetId,
      weaponInstanceId: weaponId,
      advantage: 'advantage',
    }).events;
    const rolled = events[0] as AttackRolledEvent;
    expect(rolled.d20).toHaveLength(2);
    expect(rolled.used).toBe('advantage');
  });

  it('disadvantage rolls two d20 and keeps the lower', () => {
    const { engine, campaign, attackerId, targetId, weaponId } = seedFightWithLongsword();
    const events = engine.plan.attack(campaign.state, {
      attackerId,
      targetId,
      weaponInstanceId: weaponId,
      advantage: 'disadvantage',
    }).events;
    const rolled = events[0] as AttackRolledEvent;
    expect(rolled.d20).toHaveLength(2);
    expect(rolled.used).toBe('disadvantage');
  });

  it('nat 20 is always a critical hit; rolls double dice', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { engine, campaign, attackerId, targetId, weaponId } = seedFightWithLongsword(seededRNG(seed));
      const ev = engine.plan.attack(campaign.state, {
        attackerId,
        targetId,
        weaponInstanceId: weaponId,
      }).events;
      const rolled = ev[0] as AttackRolledEvent;
      if (rolled.critical) {
        expect(rolled.hit).toBe(true);
        expect(rolled.d20[0]).toBe(20);
        return;
      }
    }
    throw new Error('No crit produced in 200 seeds — unlikely, investigate');
  }, 10000);

  it('throws on unknown attacker', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK] });
    const campaign = engine.createCampaign({ name: 'x' });
    expect(() =>
      engine.plan.attack(campaign.state, {
        attackerId: '01HKQM3J6S1H4ZGSTPYBHN0VCS',
        targetId: '01HKQM3J6S1H4ZGSTPYBHN0VCT',
        weaponInstanceId: '01HKQM3J6S1H4ZGSTPYBHN0VCU',
      }),
    ).toThrow(/Unknown attacker/);
  });

  it('apply() of all planned events never touches the RNG', () => {
    const { engine, campaign, attackerId, targetId, weaponId } = seedFightWithLongsword();
    const events = engine.plan.attack(campaign.state, {
      attackerId,
      targetId,
      weaponInstanceId: weaponId,
    }).events;
    void throwOnCallRNG();
    expect(() => engine.applyAll(campaign.state, events)).not.toThrow();
  });
});
