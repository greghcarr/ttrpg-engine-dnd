import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import { newJournalEntryId } from '../../src/ids.js';
import { hasLineOfSight, chebyshevDistanceFeet, isInRangeFeet } from '../../src/derive/terrain.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  CharacterLocationChangedEvent,
  DoorAddedEvent,
  DoorStateChangedEvent,
  LocationCreatedEvent,
} from '../../src/schemas/events/locations.js';

const fillTerrain = (
  w: number,
  h: number,
  overrides: ReadonlyArray<{ x: number; y: number; t: 'difficult' | 'impassable' | 'water' }>,
): Array<Array<'normal' | 'difficult' | 'impassable' | 'water'>> => {
  const grid: Array<Array<'normal' | 'difficult' | 'impassable' | 'water'>> = Array.from(
    { length: h },
    () => Array.from({ length: w }, () => 'normal' as const),
  );
  for (const o of overrides) grid[o.y]![o.x] = o.t;
  return grid;
};

describe('golden: locations, doors, environmental terrain (Slice 19)', () => {
  it('models a dungeon room with a locked door, terrain, and visibility checks', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(19) });
    const alyx = buildFighter({ name: 'Alyx', hpMax: 30, hpCurrent: 30 });
    const ambushPredator = buildFighter({
      name: 'Goblin Ambusher',
      hpMax: 15,
      hpCurrent: 15,
    });

    const dungeonId = newJournalEntryId();
    const guardRoomId = newJournalEntryId();
    const ironDoorId = newJournalEntryId();
    const rubbleDoorId = newJournalEntryId();

    let campaign = engine.createCampaign({ name: 'goblin-caves' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ambushPredator } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'LocationCreated',
        locationId: dungeonId,
        name: 'The Goblin Caves',
        description: 'A network of damp tunnels.',
      } satisfies LocationCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'LocationCreated',
        locationId: guardRoomId,
        name: 'Guard Room',
        description: 'Where the boss watches the entrance.',
        parentLocationId: dungeonId,
        map: {
          widthCells: 8,
          heightCells: 6,
          cellSizeFeet: 5,
          terrain: fillTerrain(8, 6, [
            { x: 3, y: 2, t: 'difficult' },
            { x: 4, y: 2, t: 'difficult' },
            { x: 5, y: 3, t: 'impassable' },
            { x: 0, y: 5, t: 'water' },
          ]),
        },
      } satisfies LocationCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DoorAdded',
        doorId: ironDoorId,
        locationId: guardRoomId,
        name: 'Iron door',
        position: { x: 4, y: 4 },
        state: 'locked',
      } satisfies DoorAddedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DoorAdded',
        doorId: rubbleDoorId,
        locationId: guardRoomId,
        name: 'Rubble passage',
        position: { x: 2, y: 5 },
        state: 'closed',
      } satisfies DoorAddedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterLocationChanged',
        characterId: alyx.id,
        toLocationId: guardRoomId,
      } satisfies CharacterLocationChangedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterLocationChanged',
        characterId: ambushPredator.id,
        toLocationId: guardRoomId,
      } satisfies CharacterLocationChangedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DoorStateChanged',
        doorId: rubbleDoorId,
        toState: 'open',
        byCharacterId: alyx.id,
      } satisfies DoorStateChangedEvent,
    ]);

    const room = campaign.state.locations[guardRoomId];
    expect(room).toBeDefined();
    expect(room!.parentLocationId).toBe(dungeonId);
    expect(room!.doorIds).toEqual([ironDoorId, rubbleDoorId]);
    expect(campaign.state.doors[ironDoorId]?.state).toBe('locked');
    expect(campaign.state.doors[rubbleDoorId]?.state).toBe('open');
    expect(campaign.state.characterLocations[alyx.id]).toBe(guardRoomId);

    const doorsInRoom = room!.doorIds.map((id) => campaign.state.doors[id]!);
    const map = room!.map!;

    expect(chebyshevDistanceFeet({ x: 0, y: 0 }, { x: 6, y: 0 }, 5)).toBe(30);
    expect(isInRangeFeet({ x: 0, y: 0 }, { x: 6, y: 0 }, 30, 5)).toBe(true);
    expect(isInRangeFeet({ x: 0, y: 0 }, { x: 7, y: 0 }, 30, 5)).toBe(false);

    // Through the open rubble door: line of sight holds.
    expect(hasLineOfSight(map, doorsInRoom, { x: 0, y: 5 }, { x: 4, y: 5 })).toBe(true);
    // Through the locked iron door at (4,4): blocked from (4,5) to (4,3).
    expect(hasLineOfSight(map, doorsInRoom, { x: 4, y: 5 }, { x: 4, y: 3 })).toBe(false);
    // Across an impassable wall cell at (5,3): blocked from (4,3) to (6,3).
    expect(hasLineOfSight(map, doorsInRoom, { x: 4, y: 3 }, { x: 6, y: 3 })).toBe(false);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 19: The Guard Room',
      }),
    ).toMatchFileSnapshot('./transcripts/s19-locations-terrain.transcript.rtf');
  });
});
