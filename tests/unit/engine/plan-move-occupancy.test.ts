// RAW 2024 PHB "Moving Around Other Creatures": you can pass through
// another creature's space (difficult terrain for same-size creatures)
// but you cannot willingly end your move in another creature's space —
// friend or foe. This file pins the destination-occupancy guard so the
// engine doesn't regress to letting combatants stack on the same tile.
//
// Caught via the web demo: the user observed players and enemies
// occupying the same square via NSEW step buttons (2026-05-14).

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { newEncounterId } from '../../../src/ids.js';
import {
  TEST_PACK,
  buildFighter,
  eventId,
  isoTimestamp,
} from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnStartedEvent,
} from '../../../src/schemas/events/encounter.js';
import type { CombatantMovedEvent } from '../../../src/schemas/events/movement.js';

const setupTwoPositioned = () => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
  const a = buildFighter({ name: 'A', DEX: 16 });
  const b = buildFighter({ name: 'B', hpMax: 14, hpCurrent: 14 });
  let campaign = engine.createCampaign({ name: 'occupancy' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
  ]);
  const encounterId = newEncounterId();
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      name: 'Open Field',
      combatantIds: [a.id, b.id],
    } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: a.id, d20: 20, modifier: 3, total: 23 },
        { combatantId: b.id, d20: 5, modifier: 1, total: 6 },
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
      combatantId: a.id,
      round: 1,
    } satisfies TurnStartedEvent,
  ]);
  // Position both combatants via CombatantMoved events; the
  // `feetTraveled: 0` from-(0,0) pattern is the same idiom the property
  // tests use to seed initial positions without consuming movement.
  const placeA: CombatantMovedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CombatantMoved',
    encounterId,
    combatantId: a.id,
    fromPosition: { x: 0, y: 0 },
    toPosition: { x: 5, y: 5 },
    feetTraveled: 0,
  };
  const placeB: CombatantMovedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CombatantMoved',
    encounterId,
    combatantId: b.id,
    fromPosition: { x: 0, y: 0 },
    toPosition: { x: 10, y: 5 },
    feetTraveled: 0,
  };
  campaign = commit(campaign, [placeA, placeB]);
  return { engine, campaign, encounterId, aId: a.id, bId: b.id };
};

describe('planMove destination occupancy', () => {
  it('rejects moves that end on another combatant\'s square', () => {
    const { engine, campaign, aId, bId } = setupTwoPositioned();
    expect(() =>
      engine.plan.move(campaign.state, { combatantId: aId, to: { x: 10, y: 5 } }),
    ).toThrow(/occupied by B/);
    // Sanity: B's position is exactly where the move targeted.
    void bId;
  });

  it('allows moves to an unoccupied adjacent square', () => {
    const { engine, campaign, aId } = setupTwoPositioned();
    const { events } = engine.plan.move(campaign.state, {
      combatantId: aId,
      to: { x: 5, y: 10 },
    });
    expect(events.map((e) => e.type)).toEqual(['CombatantMoved']);
  });

  it('a combatant can always end on its own current square (zero-distance move)', () => {
    const { engine, campaign, aId } = setupTwoPositioned();
    // Same square as A starts on; should not trigger the occupancy guard
    // because we exclude the moving combatant from the blocker scan.
    const { events } = engine.plan.move(campaign.state, {
      combatantId: aId,
      to: { x: 5, y: 5 },
    });
    expect(events.map((e) => e.type)).toEqual(['CombatantMoved']);
  });
});
