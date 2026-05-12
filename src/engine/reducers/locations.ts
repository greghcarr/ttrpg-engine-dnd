import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  LocationCreatedEvent,
  DoorAddedEvent,
  DoorStateChangedEvent,
  CharacterLocationChangedEvent,
} from '../../schemas/events/locations.js';
import { invariant } from '../../internal/invariants.js';

export const applyLocationCreated = (
  state: Draft<CampaignState>,
  event: LocationCreatedEvent,
): void => {
  invariant(state.locations[event.locationId] === undefined, `Location ${event.locationId} already exists`);
  if (event.parentLocationId !== undefined) {
    invariant(
      state.locations[event.parentLocationId] !== undefined,
      `Parent location ${event.parentLocationId} not found`,
    );
  }
  if (event.map !== undefined) {
    invariant(
      event.map.terrain.length === event.map.heightCells,
      `Map terrain rows (${event.map.terrain.length}) must equal heightCells (${event.map.heightCells})`,
    );
    for (const row of event.map.terrain) {
      invariant(
        row.length === event.map.widthCells,
        `Map terrain row width (${row.length}) must equal widthCells (${event.map.widthCells})`,
      );
    }
  }
  state.locations[event.locationId] = {
    id: event.locationId,
    name: event.name,
    description: event.description,
    parentLocationId: event.parentLocationId,
    map: event.map,
    doorIds: [],
  };
};

export const applyDoorAdded = (
  state: Draft<CampaignState>,
  event: DoorAddedEvent,
): void => {
  invariant(state.doors[event.doorId] === undefined, `Door ${event.doorId} already exists`);
  const location = state.locations[event.locationId];
  invariant(location !== undefined, `Location ${event.locationId} not found`);
  if (location.map !== undefined) {
    invariant(
      event.position.x >= 0 && event.position.x < location.map.widthCells,
      `Door x ${event.position.x} out of map bounds`,
    );
    invariant(
      event.position.y >= 0 && event.position.y < location.map.heightCells,
      `Door y ${event.position.y} out of map bounds`,
    );
  }
  state.doors[event.doorId] = {
    id: event.doorId,
    locationId: event.locationId,
    name: event.name,
    position: { x: event.position.x, y: event.position.y },
    state: event.state,
  };
  location.doorIds.push(event.doorId);
};

export const applyDoorStateChanged = (
  state: Draft<CampaignState>,
  event: DoorStateChangedEvent,
): void => {
  const door = state.doors[event.doorId];
  invariant(door !== undefined, `Door ${event.doorId} not found`);
  if (event.byCharacterId !== undefined) {
    invariant(
      state.characters[event.byCharacterId] !== undefined,
      `Character ${event.byCharacterId} not found`,
    );
  }
  door.state = event.toState;
};

export const applyCharacterLocationChanged = (
  state: Draft<CampaignState>,
  event: CharacterLocationChangedEvent,
): void => {
  invariant(
    state.characters[event.characterId] !== undefined,
    `Character ${event.characterId} not found`,
  );
  if (event.toLocationId === undefined) {
    delete state.characterLocations[event.characterId];
  } else {
    invariant(
      state.locations[event.toLocationId] !== undefined,
      `Location ${event.toLocationId} not found`,
    );
    state.characterLocations[event.characterId] = event.toLocationId;
  }
};
