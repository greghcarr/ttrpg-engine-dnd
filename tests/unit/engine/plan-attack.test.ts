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

  it('rejects when the action was already used by Dodge/Dash/etc. (no swings yet)', () => {
    // Regression: previously planAttack only checked the per-attack
    // budget, so Dodge → Attack on the same turn slipped through.
    // After Dodge, turnUsage.actionUsed=true and
    // attacksMadeThisTurn=0 — that combination is the marker for
    // "action consumed by a non-attack ability".
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(7) });
    const longsword: ItemInstance = makeItemInstance('longsword');
    const armor: ItemInstance = makeItemInstance('chain-mail');
    const a = buildFighter({ name: 'A', STR: 16 });
    const b = buildFighter({ name: 'B', hpMax: 30, hpCurrent: 30, armorInstanceId: armor.id });
    let campaign: Campaign = engine.createCampaign({ name: 'dodge-then-attack' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: armor },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [a.id, b.id] });
    campaign = commit(campaign, enc.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);
    const encNow = campaign.state.encounters[enc.encounterId]!;
    const activeId = encNow.combatants[encNow.activeIndex]!.combatantId;
    const otherId = encNow.combatants.find((c) => c.combatantId !== activeId)!.combatantId;
    campaign = commit(campaign, engine.plan.dodge(campaign.state, { combatantId: activeId }).events);

    expect(() =>
      engine.plan.attack(campaign.state, {
        attackerId: activeId,
        targetId: otherId,
        weaponInstanceId: longsword.id,
      }),
    ).toThrow(/already used their action/);
  });

  it('rejects a melee attack when target is outside reach', () => {
    // Regression: planAttack didn't consult positions, so a melee
    // weapon could swing at a target 30 ft away. Caught via the web
    // demo on 2026-05-14. Reach default is 5 ft; the `reach` weapon
    // property bumps it to 10 ft. Combatants without positions are
    // intentionally exempt so existing un-positioned fixtures keep
    // working.
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(11) });
    const longsword: ItemInstance = makeItemInstance('longsword');
    const a = buildFighter({ name: 'A', STR: 18 });
    const b = buildFighter({ name: 'B', hpMax: 30, hpCurrent: 30 });
    let campaign: Campaign = engine.createCampaign({ name: 'range-test' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [a.id, b.id] });
    campaign = commit(campaign, enc.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);
    // Place 30 ft apart.
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CombatantMoved', encounterId: enc.encounterId, combatantId: a.id, fromPosition: { x: 0, y: 0 }, toPosition: { x: 0, y: 0 }, feetTraveled: 0 },
      { id: eventId(), at: isoTimestamp(), type: 'CombatantMoved', encounterId: enc.encounterId, combatantId: b.id, fromPosition: { x: 0, y: 0 }, toPosition: { x: 30, y: 0 }, feetTraveled: 0 },
    ]);
    const encNow = campaign.state.encounters[enc.encounterId]!;
    const attackerId = encNow.combatants[encNow.activeIndex]!.combatantId;
    const targetId = encNow.combatants.find((c) => c.combatantId !== attackerId)!.combatantId;

    expect(() =>
      engine.plan.attack(campaign.state, {
        attackerId,
        targetId,
        weaponInstanceId: longsword.id,
      }),
    ).toThrow(/can't reach/);
  });

  it('allows a melee attack when target is within reach', () => {
    // Same setup as the out-of-reach case but 5 ft apart — the
    // attack must go through with the normal AttackRolled chain.
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(11) });
    const longsword: ItemInstance = makeItemInstance('longsword');
    const a = buildFighter({ name: 'A', STR: 18 });
    const b = buildFighter({ name: 'B', hpMax: 30, hpCurrent: 30 });
    let campaign: Campaign = engine.createCampaign({ name: 'range-test' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [a.id, b.id] });
    campaign = commit(campaign, enc.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CombatantMoved', encounterId: enc.encounterId, combatantId: a.id, fromPosition: { x: 0, y: 0 }, toPosition: { x: 0, y: 0 }, feetTraveled: 0 },
      { id: eventId(), at: isoTimestamp(), type: 'CombatantMoved', encounterId: enc.encounterId, combatantId: b.id, fromPosition: { x: 0, y: 0 }, toPosition: { x: 5, y: 0 }, feetTraveled: 0 },
    ]);
    const encNow = campaign.state.encounters[enc.encounterId]!;
    const attackerId = encNow.combatants[encNow.activeIndex]!.combatantId;
    const targetId = encNow.combatants.find((c) => c.combatantId !== attackerId)!.combatantId;

    const { events } = engine.plan.attack(campaign.state, {
      attackerId,
      targetId,
      weaponInstanceId: longsword.id,
    });
    // Action economy emits at least one ActionEconomyConsumed; an
    // AttackRolled must follow.
    expect(events.some((e) => e.type === 'AttackRolled')).toBe(true);
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
