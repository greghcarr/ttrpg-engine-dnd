import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';

const seedTwoFightersInCombat = () => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
  const a = buildFighter({ name: 'A', DEX: 16 });
  const b = buildFighter({ name: 'B', DEX: 10 });
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
  const created = engine.plan.createEncounter(campaign.state, {
    combatantIds: [a.id, b.id],
  });
  campaign = commit(campaign, created.events);
  campaign = commit(
    campaign,
    engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events,
  );
  campaign = commit(
    campaign,
    engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events,
  );
  // Drop A to exactly 0 HP via a 12-damage DamageApplied (A's max is 12).
  const damage: DamageAppliedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'DamageApplied',
    targetId: a.id,
    components: [{ amount: 12, type: 'slashing' }],
  };
  campaign = commit(campaign, [damage]);
  return { engine, campaign, encounterId: created.encounterId, aId: a.id, bId: b.id };
};

describe('encounter auto-rolls death save when turn starts on a downed character', () => {
  it('beginFirstTurn emits DeathSaveRolled when the active combatant is at 0 HP', () => {
    // A goes first (higher DEX). A is at 0 HP from the seeded damage.
    const { engine, campaign, encounterId, aId } = seedTwoFightersInCombat();
    const { events } = engine.plan.beginFirstTurn(campaign.state, { encounterId });
    const types = events.map((e) => e.type);
    expect(types).toEqual(['TurnStarted', 'DeathSaveRolled']);
    const save = events[1];
    if (save?.type === 'DeathSaveRolled') {
      expect(save.targetId).toBe(aId);
    }
  });

  it('advanceTurn emits DeathSaveRolled when the next combatant is at 0 HP', () => {
    const { engine, campaign, encounterId, aId } = seedTwoFightersInCombat();
    // Start with A's first turn, then advance past B back around. The
    // downed combatant gets a save on every turn-start they receive.
    let c = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId }).events);
    c = commit(c, engine.plan.advanceTurn(c.state, { encounterId }).events); // -> B's turn
    const { events } = engine.plan.advanceTurn(c.state, { encounterId });   // -> next round, A's turn
    const save = events.find((e) => e.type === 'DeathSaveRolled');
    expect(save).toBeDefined();
    if (save?.type === 'DeathSaveRolled') {
      expect(save.targetId).toBe(aId);
    }
  });

  it('does not auto-roll for a conscious combatant', () => {
    const { engine, campaign, encounterId, bId } = seedTwoFightersInCombat();
    let c = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId }).events);
    // Skip A's auto-rolled save event before advancing.
    const { events } = engine.plan.advanceTurn(c.state, { encounterId });
    expect(events.map((e) => e.type)).toEqual(['TurnEnded', 'TurnStarted']);
    const turn = events.find((e) => e.type === 'TurnStarted');
    if (turn?.type === 'TurnStarted') {
      expect(turn.combatantId).toBe(bId);
    }
  });

  it('does not auto-roll once the character is stable', () => {
    const { engine, campaign, encounterId, aId } = seedTwoFightersInCombat();
    // Stabilize A explicitly, then check that the auto-roll is skipped.
    const stabilized = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'Stabilized',
        targetId: aId,
      },
    ]);
    const { events } = engine.plan.beginFirstTurn(stabilized.state, { encounterId });
    expect(events.map((e) => e.type)).toEqual(['TurnStarted']);
  });
});
