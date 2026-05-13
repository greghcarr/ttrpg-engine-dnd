import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import { newJournalEntryId, newPartyId } from '../../src/ids.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { PartyCreatedEvent } from '../../src/schemas/events/party.js';
import type { LocationCreatedEvent } from '../../src/schemas/events/locations.js';
import type { TravelLegCompletedEvent } from '../../src/schemas/events/travel.js';
import type { ExhaustionChangedEvent } from '../../src/schemas/events/combat.js';

describe('golden: travel (Slice 25)', () => {
  it('party travels three legs, navigates, forages, and pushes through with forced-march exhaustion', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(25) });
    const alyx = buildFighter({ name: 'Alyx', WIS: 14 });
    const borin = buildFighter({ name: 'Borin', WIS: 12 });
    const partyId = newPartyId();
    const villageId = newJournalEntryId();
    const cavernId = newJournalEntryId();

    let campaign = engine.createCampaign({ name: 's25' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: borin } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PartyCreated',
        partyId,
        name: 'The Bridge Burners',
        memberIds: [alyx.id, borin.id],
      } satisfies PartyCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'LocationCreated',
        locationId: villageId,
        name: 'Riverside Village',
      } satisfies LocationCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'LocationCreated',
        locationId: cavernId,
        name: 'The Sundered Caverns',
      } satisfies LocationCreatedEvent,
    ]);

    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TravelLegCompleted',
        partyId,
        pace: 'normal',
        hours: 8,
        miles: 24,
        fromLocationId: villageId,
        notes: 'Sunny day, easy road.',
      } satisfies TravelLegCompletedEvent,
    ]);

    campaign = commit(campaign, engine.plan.navigationCheck(campaign.state, {
      partyId,
      navigatorId: alyx.id,
      dc: 12,
    }).events);

    campaign = commit(campaign, engine.plan.forage(campaign.state, {
      partyId,
      foragerId: borin.id,
      dc: 10,
    }).events);

    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TravelLegCompleted',
        partyId,
        pace: 'fast',
        hours: 4,
        miles: 16,
        toLocationId: cavernId,
        notes: 'Forced march into dusk.',
      } satisfies TravelLegCompletedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ExhaustionChanged',
        targetId: alyx.id,
        fromLevel: 0,
        toLevel: 1,
      } satisfies ExhaustionChangedEvent,
    ]);

    expect(campaign.state.travelLog).toHaveLength(2);
    expect(campaign.state.characters[alyx.id]?.exhaustion).toBe(1);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 25: Travel and Foraging',
      }),
    ).toMatchFileSnapshot('./transcripts/s25-travel.transcript.rtf');
  });
});
