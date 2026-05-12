import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { commit } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const seedTwoFighters = () => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
  const a = buildFighter({ DEX: 16 });
  const b = buildFighter({ DEX: 10 });
  let campaign = engine.createCampaign({ name: 'fight' });
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: a,
    } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: b,
    } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, aId: a.id, bId: b.id };
};

describe('encounter planners', () => {
  it('createEncounter yields an EncounterCreated event with the chosen id', () => {
    const { engine, campaign, aId, bId } = seedTwoFighters();
    const { events, encounterId } = engine.plan.createEncounter(campaign.state, {
      combatantIds: [aId, bId],
      name: 'goblins',
      at: '2026-01-01T00:00:00.000Z',
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('EncounterCreated');
    expect(encounterId).toBeTruthy();
  });

  it('full lifecycle via planners produces a finished encounter', () => {
    const { engine, campaign, aId, bId } = seedTwoFighters();
    let c = campaign;

    const created = engine.plan.createEncounter(c.state, {
      combatantIds: [aId, bId],
      at: '2026-01-01T00:00:00.000Z',
    });
    c = commit(c, created.events);
    const eid = created.encounterId;

    c = commit(c, engine.plan.rollInitiative(c.state, { encounterId: eid }).events);
    c = commit(c, engine.plan.startEncounter(c.state, { encounterId: eid }).events);
    c = commit(c, engine.plan.beginFirstTurn(c.state, { encounterId: eid }).events);
    c = commit(c, engine.plan.advanceTurn(c.state, { encounterId: eid }).events);
    c = commit(c, engine.plan.advanceTurn(c.state, { encounterId: eid }).events);
    c = commit(c, engine.plan.endEncounter(c.state, { encounterId: eid, outcome: 'victory' }).events);

    expect(c.state.encounters[eid]?.status).toBe('ended');
    expect(c.state.encounters[eid]?.outcome).toBe('victory');
    expect(c.state.encounters[eid]?.round).toBe(2);
  });

  it('rollInitiative gives every combatant a d20 + DEX-mod entry', () => {
    const { engine, campaign, aId, bId } = seedTwoFighters();
    const createRes = engine.plan.createEncounter(campaign.state, {
      combatantIds: [aId, bId],
    });
    const c = commit(campaign, createRes.events);
    const initEvents = engine.plan.rollInitiative(c.state, {
      encounterId: createRes.encounterId,
    }).events;
    const evt = initEvents[0];
    expect(evt?.type).toBe('InitiativeRolled');
    if (evt?.type !== 'InitiativeRolled') throw new Error('bad');
    expect(evt.rolls).toHaveLength(2);
  });

  it('throws on unknown encounter id', () => {
    const { engine, campaign } = seedTwoFighters();
    expect(() =>
      engine.plan.rollInitiative(campaign.state, { encounterId: '01HKQM3J6S1H4ZGSTPYBHN0VCS' }),
    ).toThrow(/Unknown encounter/);
  });
});
