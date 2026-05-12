import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  EncounterCreatedEvent,
  EncounterEndedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  RoundEndedEvent,
  TurnEndedEvent,
  TurnStartedEvent,
} from '../../../src/schemas/events/encounter.js';
import { newEncounterId } from '../../../src/ids.js';

const seedTwoFighters = () => {
  const a = buildFighter({ DEX: 16 });
  const b = buildFighter({ DEX: 12 });
  let state = apply(emptyCampaignState(), {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: a,
  } satisfies CharacterCreatedEvent);
  state = apply(state, {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: b,
  } satisfies CharacterCreatedEvent);
  return { state, aId: a.id, bId: b.id };
};

describe('Encounter reducers', () => {
  it('EncounterCreated establishes a planning encounter', () => {
    const { state, aId, bId } = seedTwoFighters();
    const encounterId = newEncounterId();
    const event: EncounterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      name: 'Goblin ambush',
      combatantIds: [aId, bId],
    };
    const next = apply(state, event);
    const enc = next.encounters[encounterId];
    expect(enc?.status).toBe('planning');
    expect(enc?.combatants).toHaveLength(2);
    expect(enc?.name).toBe('Goblin ambush');
    expect(enc?.round).toBe(0);
  });

  it('InitiativeRolled sorts combatants in descending total order', () => {
    const { state, aId, bId } = seedTwoFighters();
    const encounterId = newEncounterId();
    const create: EncounterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      combatantIds: [aId, bId],
    };
    const init: InitiativeRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: aId, d20: 10, modifier: 3, total: 13 },
        { combatantId: bId, d20: 18, modifier: 1, total: 19 },
      ],
    };
    const next = applyAll(state, [create, init]);
    const enc = next.encounters[encounterId];
    expect(enc?.combatants[0]?.combatantId).toBe(bId);
    expect(enc?.combatants[1]?.combatantId).toBe(aId);
    expect(enc?.combatants[0]?.initiative).toBe(19);
  });

  it('full encounter lifecycle: created → initiative → started → turn → end', () => {
    const { state, aId, bId } = seedTwoFighters();
    const encounterId = newEncounterId();
    const create: EncounterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      combatantIds: [aId, bId],
    };
    const init: InitiativeRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: aId, d20: 18, modifier: 3, total: 21 },
        { combatantId: bId, d20: 5, modifier: 1, total: 6 },
      ],
    };
    const start: EncounterStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterStarted',
      encounterId,
    };
    const turnA: TurnStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TurnStarted',
      encounterId,
      combatantId: aId,
      round: 1,
    };
    const turnAEnd: TurnEndedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TurnEnded',
      encounterId,
      combatantId: aId,
      round: 1,
    };
    const turnB: TurnStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TurnStarted',
      encounterId,
      combatantId: bId,
      round: 1,
    };
    const turnBEnd: TurnEndedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TurnEnded',
      encounterId,
      combatantId: bId,
      round: 1,
    };
    const roundEnd: RoundEndedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'RoundEnded',
      encounterId,
      round: 1,
    };
    const end: EncounterEndedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterEnded',
      encounterId,
      outcome: 'victory',
    };

    const final = applyAll(state, [
      create, init, start, turnA, turnAEnd, turnB, turnBEnd, roundEnd, end,
    ]);
    const enc = final.encounters[encounterId];
    expect(enc?.status).toBe('ended');
    expect(enc?.outcome).toBe('victory');
    expect(enc?.round).toBe(2);
    expect(final.activeEncounterId).toBeUndefined();
  });

  it('rejects starting encounter twice', () => {
    const { state, aId, bId } = seedTwoFighters();
    const encounterId = newEncounterId();
    const create: EncounterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      combatantIds: [aId, bId],
    };
    const init: InitiativeRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: aId, d20: 15, modifier: 0, total: 15 },
        { combatantId: bId, d20: 10, modifier: 0, total: 10 },
      ],
    };
    const start: EncounterStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterStarted',
      encounterId,
    };
    const afterStart = applyAll(state, [create, init, start]);
    expect(() => apply(afterStart, start)).toThrow(/already started/);
  });

  it('rejects turn-start mismatch', () => {
    const { state, aId, bId } = seedTwoFighters();
    const encounterId = newEncounterId();
    const events = [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterCreated',
        encounterId,
        combatantIds: [aId, bId],
      } satisfies EncounterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: aId, d20: 18, modifier: 0, total: 18 },
          { combatantId: bId, d20: 5, modifier: 0, total: 5 },
        ],
      } satisfies InitiativeRolledEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterStarted',
        encounterId,
      } satisfies EncounterStartedEvent,
    ];
    const mid = applyAll(state, events);
    expect(() =>
      apply(mid, {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: bId,
        round: 1,
      } satisfies TurnStartedEvent),
    ).toThrow(/mismatch/);
  });

  it('rejects round-end before all combatants have acted', () => {
    const { state, aId, bId } = seedTwoFighters();
    const encounterId = newEncounterId();
    const events = [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterCreated',
        encounterId,
        combatantIds: [aId, bId],
      } satisfies EncounterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: aId, d20: 18, modifier: 0, total: 18 },
          { combatantId: bId, d20: 5, modifier: 0, total: 5 },
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
        combatantId: aId,
        round: 1,
      } satisfies TurnStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnEnded',
        encounterId,
        combatantId: aId,
        round: 1,
      } satisfies TurnEndedEvent,
    ];
    const mid = applyAll(state, events);
    expect(() =>
      apply(mid, {
        id: eventId(),
        at: isoTimestamp(),
        type: 'RoundEnded',
        encounterId,
        round: 1,
      } satisfies RoundEndedEvent),
    ).toThrow(/Not all combatants have acted/);
  });
});
