import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import {
  newSessionId,
  newJournalEntryId,
} from '../../src/ids.js';
import { breakdownInGameTime, formatInGameTime } from '../../src/schemas/runtime/in-game-time.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  SessionStartedEvent,
  SessionEndedEvent,
  JournalEntryAddedEvent,
  InGameTimeAdvancedEvent,
} from '../../src/schemas/events/session.js';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SHORT_REST_MINUTES = 60;
const LONG_REST_MINUTES = 8 * MINUTES_PER_HOUR;

describe('golden: session, journal, in-game clock (Slice 18)', () => {
  it('full session: starts, advances the clock through rests and travel, captures journal entries, ends', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(31) });
    const alyx = buildFighter({ name: 'Alyx', hpMax: 30, hpCurrent: 30 });
    const borin = buildFighter({ name: 'Borin', hpMax: 30, hpCurrent: 30 });
    const sessionId = newSessionId();
    const dmNoteId = newJournalEntryId();
    const playerLogId = newJournalEntryId();
    const secretId = newJournalEntryId();

    let campaign = engine.createCampaign({ name: 'session-one' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: borin } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'SessionStarted',
        sessionId,
        name: 'The Goblin Caves',
        inGameStart: { totalMinutes: 8 * MINUTES_PER_HOUR },
      } satisfies SessionStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'JournalEntryAdded',
        entryId: dmNoteId,
        sessionId,
        authorKind: 'dm',
        visibility: 'dm-only',
        visibleToCharacterIds: [],
        title: 'Cave entrance',
        body: 'Hidden tripwire 10ft inside; sets off rockfall (4d10 bludgeoning, DC 14 DEX).',
      } satisfies JournalEntryAddedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InGameTimeAdvanced',
        minutes: 90,
        reason: 'travel to the caves',
      } satisfies InGameTimeAdvancedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'JournalEntryAdded',
        entryId: playerLogId,
        sessionId,
        authorKind: 'player',
        authorCharacterId: alyx.id,
        visibility: 'party',
        visibleToCharacterIds: [],
        title: 'We made it',
        body: 'Reached the entrance just before noon. Borin spotted tracks in the mud.',
      } satisfies JournalEntryAddedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InGameTimeAdvanced',
        minutes: SHORT_REST_MINUTES,
        reason: 'short rest',
      } satisfies InGameTimeAdvancedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'JournalEntryAdded',
        entryId: secretId,
        sessionId,
        authorKind: 'dm',
        visibility: 'character',
        visibleToCharacterIds: [alyx.id],
        title: 'A whisper in the dark',
        body: 'Alyx alone hears it: "...turn back, child of the stone..."',
      } satisfies JournalEntryAddedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InGameTimeAdvanced',
        minutes: LONG_REST_MINUTES,
        reason: 'long rest at the cave mouth',
      } satisfies InGameTimeAdvancedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'SessionEnded',
        sessionId,
        summary: 'Reached the caves; rested up. Next session: into the dark.',
      } satisfies SessionEndedEvent,
    ]);

    const session = campaign.state.sessions[sessionId];
    expect(session?.endedAtIso).toBeDefined();
    expect(session?.journalEntryIds).toEqual([dmNoteId, playerLogId, secretId]);
    expect(session?.inGameStart.totalMinutes).toBe(8 * MINUTES_PER_HOUR);
    const expectedEnd = 8 * MINUTES_PER_HOUR + 90 + SHORT_REST_MINUTES + LONG_REST_MINUTES;
    expect(session?.inGameEnd?.totalMinutes).toBe(expectedEnd);
    expect(campaign.state.activeSessionId).toBeUndefined();
    expect(campaign.state.inGameTime.totalMinutes).toBe(expectedEnd);

    const dmEntry = campaign.state.journalEntries[dmNoteId]!;
    expect(dmEntry.visibility).toBe('dm-only');
    const secretEntry = campaign.state.journalEntries[secretId]!;
    expect(secretEntry.visibility).toBe('character');
    expect(secretEntry.visibleToCharacterIds).toEqual([alyx.id]);

    const breakdown = breakdownInGameTime(campaign.state.inGameTime);
    expect(breakdown.days).toBe(Math.floor(expectedEnd / (MINUTES_PER_HOUR * HOURS_PER_DAY)));

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    expect(formatInGameTime({ totalMinutes: 0 })).toBe('Day 00 00:00');

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Session One: The Goblin Caves',
      }),
    ).toMatchFileSnapshot('./transcripts/s18-session-journal.transcript.rtf');
  });

  it('rejects starting a second session while one is active', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx' });
    const id1 = newSessionId();
    const id2 = newSessionId();
    let campaign = engine.createCampaign({ name: 'overlap' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'SessionStarted',
        sessionId: id1,
        name: 'First',
      } satisfies SessionStartedEvent,
    ]);
    expect(() =>
      commit(campaign, [
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'SessionStarted',
          sessionId: id2,
          name: 'Second',
        } satisfies SessionStartedEvent,
      ]),
    ).toThrow(/already active/);
  });
});
