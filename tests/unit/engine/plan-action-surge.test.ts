import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { newEncounterId } from '../../../src/ids.js';

const seedFighterInTurn = () => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
  const fighter = buildFighter({
    level: 2,
    resources: [{ resourceId: 'action-surge', current: 1, max: 1 }],
  });
  const target = buildFighter({ name: 'Target' });
  let campaign = engine.createCampaign({ name: 'as' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target },
  ]);
  const encounterId = newEncounterId();
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      combatantIds: [fighter.id, target.id],
    },
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: fighter.id, d20: 20, modifier: 0, total: 20 },
        { combatantId: target.id, d20: 5, modifier: 0, total: 5 },
      ],
    },
    { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId },
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TurnStarted',
      encounterId,
      combatantId: fighter.id,
      round: 1,
    },
    // Simulate the action being used (e.g. by an Attack action).
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ActionEconomyConsumed',
      encounterId,
      combatantId: fighter.id,
      kind: 'action',
    },
  ]);
  return { engine, campaign, fighterId: fighter.id, encounterId };
};

describe('engine.plan.actionSurge', () => {
  it('spends the action-surge resource and resets actionUsed', () => {
    const { engine, campaign, fighterId, encounterId } = seedFighterInTurn();
    const before = campaign.state.encounters[encounterId]?.combatants.find(
      (c) => c.combatantId === fighterId,
    );
    expect(before?.turnUsage.actionUsed).toBe(true);

    const next = commit(
      campaign,
      engine.plan.actionSurge(campaign.state, { combatantId: fighterId }).events,
    );

    const after = next.state.encounters[encounterId]?.combatants.find(
      (c) => c.combatantId === fighterId,
    );
    expect(after?.turnUsage.actionUsed).toBe(false);
    const resource = next.state.characters[fighterId]?.resources.find(
      (r) => r.resourceId === 'action-surge',
    );
    expect(resource?.current).toBe(0);
  });

  it('rejects Action Surge if the resource pool is empty', () => {
    const { engine, campaign, fighterId } = seedFighterInTurn();
    const after = commit(
      campaign,
      engine.plan.actionSurge(campaign.state, { combatantId: fighterId }).events,
    );
    expect(() =>
      engine.plan.actionSurge(after.state, { combatantId: fighterId }),
    ).toThrow(/no Action Surge available/);
  });

  it('rejects Action Surge before the action is used', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const fighter = buildFighter({
      level: 2,
      resources: [{ resourceId: 'action-surge', current: 1, max: 1 }],
    });
    const target = buildFighter({ name: 'Target' });
    let campaign = engine.createCampaign({ name: 'as' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target },
    ]);
    const encounterId = newEncounterId();
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterCreated',
        encounterId,
        combatantIds: [fighter.id, target.id],
      },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: fighter.id, d20: 20, modifier: 0, total: 20 },
          { combatantId: target.id, d20: 5, modifier: 0, total: 5 },
        ],
      },
      { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: fighter.id,
        round: 1,
      },
    ]);
    expect(() =>
      engine.plan.actionSurge(campaign.state, { combatantId: fighter.id }),
    ).toThrow(/only meaningful after the Action is used/);
  });
});
