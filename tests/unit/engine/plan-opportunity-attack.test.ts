import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import {
  TEST_PACK,
  buildFighter,
  eventId,
  isoTimestamp,
  makeItemInstance,
} from '../../fixtures/index.js';
import { newEncounterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnStartedEvent,
} from '../../../src/schemas/events/encounter.js';

const setupActiveEncounter = () => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
  const longsword = makeItemInstance('longsword');
  const active = buildFighter({ name: 'Active', STR: 14 });
  const reactor = buildFighter({ name: 'Reactor', STR: 18 });
  let campaign = engine.createCampaign({ name: 'reactions' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: active } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: reactor } satisfies CharacterCreatedEvent,
  ]);
  const encounterId = newEncounterId();
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      combatantIds: [active.id, reactor.id],
    } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: active.id, d20: 20, modifier: 0, total: 20 },
        { combatantId: reactor.id, d20: 5, modifier: 0, total: 5 },
      ],
    } satisfies InitiativeRolledEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterStarted',
      encounterId,
    } satisfies EncounterStartedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TurnStarted',
      encounterId,
      combatantId: active.id,
      round: 1,
    } satisfies TurnStartedEvent,
  ]);
  return {
    engine,
    campaign,
    activeId: active.id,
    reactorId: reactor.id,
    weaponId: longsword.id,
    encounterId,
  };
};

describe('engine.plan.opportunityAttack', () => {
  it('emits a reaction-consume event and an attack chain', () => {
    const { engine, campaign, activeId, reactorId, weaponId } = setupActiveEncounter();
    const { events } = engine.plan.opportunityAttack(campaign.state, {
      reactorId,
      targetId: activeId,
      weaponInstanceId: weaponId,
    });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('ActionEconomyConsumed');
    expect(types).toContain('AttackRolled');
  });

  it('consumes the reactor\'s reaction slot', () => {
    const { engine, campaign, activeId, reactorId, weaponId, encounterId } = setupActiveEncounter();
    const next = commit(
      campaign,
      engine.plan.opportunityAttack(campaign.state, {
        reactorId,
        targetId: activeId,
        weaponInstanceId: weaponId,
      }).events,
    );
    const reactor = next.state.encounters[encounterId]?.combatants.find(
      (c) => c.combatantId === reactorId,
    );
    expect(reactor?.turnUsage.reactionUsedThisRound).toBe(true);
  });

  it('rejects a second opportunity attack from the same reactor within the same round', () => {
    const { engine, campaign, activeId, reactorId, weaponId } = setupActiveEncounter();
    const next = commit(
      campaign,
      engine.plan.opportunityAttack(campaign.state, {
        reactorId,
        targetId: activeId,
        weaponInstanceId: weaponId,
      }).events,
    );
    expect(() =>
      engine.plan.opportunityAttack(next.state, {
        reactorId,
        targetId: activeId,
        weaponInstanceId: weaponId,
      }),
    ).toThrow(/already used their reaction/);
  });

  it('rejects an opportunity attack from the active combatant on their own turn', () => {
    const { engine, campaign, activeId, reactorId, weaponId } = setupActiveEncounter();
    expect(() =>
      engine.plan.opportunityAttack(campaign.state, {
        reactorId: activeId,
        targetId: reactorId,
        weaponInstanceId: weaponId,
      }),
    ).toThrow(/own turn/);
  });

  it('rejects an opportunity attack outside an active encounter', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const longsword = makeItemInstance('longsword');
    const a = buildFighter({ name: 'A' });
    const b = buildFighter({ name: 'B' });
    let campaign = engine.createCampaign({ name: 'no-encounter' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.opportunityAttack(campaign.state, {
        reactorId: a.id,
        targetId: b.id,
        weaponInstanceId: longsword.id,
      }),
    ).toThrow(/active encounter/);
  });
});
