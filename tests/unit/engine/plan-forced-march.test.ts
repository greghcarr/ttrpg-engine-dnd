import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { newPartyId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';
import type { ExhaustionChangedEvent } from '../../../src/schemas/events/combat.js';
import type { PartyCreatedEvent } from '../../../src/schemas/events/party.js';

const seedParty = (rng = seededRNG(42)) => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng });
  const alyx = buildFighter({ name: 'Alyx', CON: 14 });
  const mira = buildFighter({ name: 'Mira', CON: 10 });
  let campaign = engine.createCampaign({ name: 'march' });
  const partyId = newPartyId();
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: alyx,
    } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: mira,
    } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'PartyCreated',
      partyId,
      name: 'Marchers',
      memberIds: [alyx.id, mira.id],
    } satisfies PartyCreatedEvent,
  ]);
  return { engine, campaign, partyId, alyxId: alyx.id, miraId: mira.id };
};

describe('planForcedMarch', () => {
  it('returns no events for 8 hours or less of marching', () => {
    const { engine, campaign, partyId, alyxId, miraId } = seedParty();
    const eight = engine.plan.forcedMarch(campaign.state, {
      partyId,
      travelerIds: [alyxId, miraId],
      hoursMarched: 8,
    });
    expect(eight.events).toEqual([]);
    const six = engine.plan.forcedMarch(campaign.state, {
      partyId,
      travelerIds: [alyxId, miraId],
      hoursMarched: 6,
    });
    expect(six.events).toEqual([]);
  });

  it('rolls one CON save per traveler per hour past 8 with a climbing DC', () => {
    const { engine, campaign, partyId, alyxId, miraId } = seedParty();
    const { events } = engine.plan.forcedMarch(campaign.state, {
      partyId,
      travelerIds: [alyxId, miraId],
      hoursMarched: 11, // 3 extra hours
    });
    const saves = events.filter((e): e is SaveRolledEvent => e.type === 'SaveRolled');
    expect(saves).toHaveLength(6); // 2 travelers * 3 hours
    // DCs go 11, 12, 13 — paired (one per traveler at each hour). Take
    // every other save (alyx, then mira at the same hour) and check
    // the DC sequence: alyx-h1, mira-h1, alyx-h2, mira-h2, ...
    const dcs = saves.map((s) => s.dc);
    expect(dcs).toEqual([11, 11, 12, 12, 13, 13]);
    for (const save of saves) {
      expect(save.ability).toBe('CON');
    }
  });

  it('emits ExhaustionChanged when a save fails; running exhaustion increments correctly', () => {
    // High extra-hour count guarantees several failures across seeds —
    // we don't need a specific seed.
    const { engine, campaign, partyId, alyxId, miraId } = seedParty(seededRNG(7));
    const { events } = engine.plan.forcedMarch(campaign.state, {
      partyId,
      travelerIds: [alyxId, miraId],
      hoursMarched: 16, // 8 extra hours, DCs 11..18
    });
    const exhEvents = events.filter(
      (e): e is ExhaustionChangedEvent => e.type === 'ExhaustionChanged',
    );
    expect(exhEvents.length).toBeGreaterThan(0);
    // For each traveler, exhaustion should never jump by more than 1
    // per event, and `toLevel == fromLevel + 1` always.
    for (const e of exhEvents) {
      expect(e.toLevel).toBe(e.fromLevel + 1);
    }
  });

  it('skips travelers already at exhaustion max', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(5) });
    const alyx = buildFighter({ name: 'Alyx', CON: 14, exhaustion: 6 });
    let campaign = engine.createCampaign({ name: 'march-max' });
    const partyId = newPartyId();
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PartyCreated',
        partyId,
        name: 'Solo',
        memberIds: [alyx.id],
      } satisfies PartyCreatedEvent,
    ]);
    const { events } = engine.plan.forcedMarch(campaign.state, {
      partyId,
      travelerIds: [alyx.id],
      hoursMarched: 12,
    });
    expect(events).toEqual([]);
  });

  it('committing the chain advances exhaustion in state', () => {
    let found = false;
    for (let seed = 0; seed < 30 && !found; seed++) {
      const { engine, campaign, partyId, alyxId, miraId } = seedParty(seededRNG(seed));
      const { events } = engine.plan.forcedMarch(campaign.state, {
        partyId,
        travelerIds: [alyxId, miraId],
        hoursMarched: 12,
      });
      const after = commit(campaign, events);
      const aExh = after.state.characters[alyxId]?.exhaustion ?? 0;
      const mExh = after.state.characters[miraId]?.exhaustion ?? 0;
      if (aExh + mExh > 0) {
        expect(aExh + mExh).toBeGreaterThanOrEqual(1);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
