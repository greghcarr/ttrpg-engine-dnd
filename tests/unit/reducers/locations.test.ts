import { describe, expect, it } from 'vitest';
import { apply } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { newJournalEntryId } from '../../../src/ids.js';
import { eventId, isoTimestamp, buildFighter } from '../../fixtures/index.js';
import type {
  LocationCreatedEvent,
  DoorAddedEvent,
  DoorStateChangedEvent,
  CharacterLocationChangedEvent,
} from '../../../src/schemas/events/locations.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const evt = <T extends { id: string; at: string }>(e: Omit<T, 'id' | 'at'>): T =>
  ({ id: eventId(), at: isoTimestamp(), ...e }) as T;

describe('reducer: locations and doors', () => {
  it('creates a location with no map', () => {
    const id = newJournalEntryId();
    const state = apply(
      emptyCampaignState(),
      evt<LocationCreatedEvent>({
        type: 'LocationCreated',
        locationId: id,
        name: 'Throne Room',
      }),
    );
    expect(state.locations[id]?.name).toBe('Throne Room');
    expect(state.locations[id]?.doorIds).toEqual([]);
  });

  it('creates a location with a map and validates dimensions', () => {
    const id = newJournalEntryId();
    const state = apply(
      emptyCampaignState(),
      evt<LocationCreatedEvent>({
        type: 'LocationCreated',
        locationId: id,
        name: 'Dungeon',
        map: {
          widthCells: 3,
          heightCells: 2,
          cellSizeFeet: 5,
          terrain: [
            ['normal', 'difficult', 'normal'],
            ['normal', 'impassable', 'normal'],
          ],
        },
      }),
    );
    expect(state.locations[id]?.map?.widthCells).toBe(3);
  });

  it('rejects a map whose terrain shape mismatches its dimensions', () => {
    const id = newJournalEntryId();
    expect(() =>
      apply(
        emptyCampaignState(),
        evt<LocationCreatedEvent>({
          type: 'LocationCreated',
          locationId: id,
          name: 'Bad',
          map: {
            widthCells: 3,
            heightCells: 2,
            cellSizeFeet: 5,
            terrain: [['normal', 'difficult']],
          },
        }),
      ),
    ).toThrow();
  });

  it('rejects duplicate location creation', () => {
    const id = newJournalEntryId();
    const create = evt<LocationCreatedEvent>({
      type: 'LocationCreated',
      locationId: id,
      name: 'A',
    });
    const state = apply(emptyCampaignState(), create);
    expect(() => apply(state, create)).toThrow(/already exists/);
  });

  it('rejects a parent that does not exist', () => {
    const id = newJournalEntryId();
    const fakeParent = newJournalEntryId();
    expect(() =>
      apply(
        emptyCampaignState(),
        evt<LocationCreatedEvent>({
          type: 'LocationCreated',
          locationId: id,
          name: 'Orphan',
          parentLocationId: fakeParent,
        }),
      ),
    ).toThrow(/Parent location/);
  });

  it('adds and toggles a door at a known location', () => {
    const locId = newJournalEntryId();
    const doorId = newJournalEntryId();
    let state = apply(
      emptyCampaignState(),
      evt<LocationCreatedEvent>({
        type: 'LocationCreated',
        locationId: locId,
        name: 'Hall',
        map: {
          widthCells: 5,
          heightCells: 5,
          cellSizeFeet: 5,
          terrain: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 'normal' as const)),
        },
      }),
    );
    state = apply(
      state,
      evt<DoorAddedEvent>({
        type: 'DoorAdded',
        doorId,
        locationId: locId,
        name: 'Iron door',
        position: { x: 2, y: 1 },
        state: 'closed',
      }),
    );
    expect(state.locations[locId]?.doorIds).toEqual([doorId]);
    expect(state.doors[doorId]?.state).toBe('closed');

    state = apply(
      state,
      evt<DoorStateChangedEvent>({
        type: 'DoorStateChanged',
        doorId,
        toState: 'open',
      }),
    );
    expect(state.doors[doorId]?.state).toBe('open');
  });

  it('rejects a door outside map bounds', () => {
    const locId = newJournalEntryId();
    const doorId = newJournalEntryId();
    const state = apply(
      emptyCampaignState(),
      evt<LocationCreatedEvent>({
        type: 'LocationCreated',
        locationId: locId,
        name: 'Small',
        map: {
          widthCells: 2,
          heightCells: 2,
          cellSizeFeet: 5,
          terrain: [
            ['normal', 'normal'],
            ['normal', 'normal'],
          ],
        },
      }),
    );
    expect(() =>
      apply(
        state,
        evt<DoorAddedEvent>({
          type: 'DoorAdded',
          doorId,
          locationId: locId,
          position: { x: 5, y: 0 },
          state: 'closed',
        }),
      ),
    ).toThrow(/out of map bounds/);
  });

  it('tracks character location changes and clears on undefined', () => {
    const alyx = buildFighter({ name: 'Alyx' });
    const locId = newJournalEntryId();
    let state = apply(
      emptyCampaignState(),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    );
    state = apply(
      state,
      evt<LocationCreatedEvent>({ type: 'LocationCreated', locationId: locId, name: 'Cellar' }),
    );
    state = apply(
      state,
      evt<CharacterLocationChangedEvent>({
        type: 'CharacterLocationChanged',
        characterId: alyx.id,
        toLocationId: locId,
      }),
    );
    expect(state.characterLocations[alyx.id]).toBe(locId);
    state = apply(
      state,
      evt<CharacterLocationChangedEvent>({
        type: 'CharacterLocationChanged',
        characterId: alyx.id,
      }),
    );
    expect(state.characterLocations[alyx.id]).toBeUndefined();
  });
});
