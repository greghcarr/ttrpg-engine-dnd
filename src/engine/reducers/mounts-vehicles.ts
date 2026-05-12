import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  MountedEvent,
  DismountedEvent,
  VehicleAcquiredEvent,
  VehicleBoardedEvent,
  VehicleDepartedEvent,
  VehicleDamagedEvent,
  VehicleRepairedEvent,
} from '../../schemas/events/mounts-vehicles.js';
import { invariant } from '../../internal/invariants.js';

export const applyMounted = (state: Draft<CampaignState>, event: MountedEvent): void => {
  const rider = state.characters[event.riderId];
  invariant(rider !== undefined, `Rider ${event.riderId} not found`);
  invariant(rider.mountedOnId === undefined, `${event.riderId} is already mounted`);
  invariant(state.characters[event.mountId] !== undefined, `Mount ${event.mountId} not found`);
  rider.mountedOnId = event.mountId;
};

export const applyDismounted = (state: Draft<CampaignState>, event: DismountedEvent): void => {
  const rider = state.characters[event.riderId];
  invariant(rider !== undefined, `Rider ${event.riderId} not found`);
  invariant(
    rider.mountedOnId === event.mountId,
    `${event.riderId} is not mounted on ${event.mountId}`,
  );
  rider.mountedOnId = undefined;
};

export const applyVehicleAcquired = (
  state: Draft<CampaignState>,
  event: VehicleAcquiredEvent,
): void => {
  invariant(state.vehicles[event.vehicleId] === undefined, `Vehicle ${event.vehicleId} already exists`);
  state.vehicles[event.vehicleId] = {
    id: event.vehicleId,
    name: event.name,
    kind: event.kind,
    speedFeet: event.speedFeet,
    ac: event.ac,
    hp: { current: event.maxHp, max: event.maxHp },
    capacity: event.capacity,
    occupantIds: [],
  };
};

export const applyVehicleBoarded = (
  state: Draft<CampaignState>,
  event: VehicleBoardedEvent,
): void => {
  const vehicle = state.vehicles[event.vehicleId];
  invariant(vehicle !== undefined, `Vehicle ${event.vehicleId} not found`);
  invariant(state.characters[event.characterId] !== undefined, `Character ${event.characterId} not found`);
  invariant(
    vehicle.occupantIds.length < vehicle.capacity,
    `Vehicle ${event.vehicleId} is at capacity`,
  );
  if (!vehicle.occupantIds.includes(event.characterId)) {
    vehicle.occupantIds.push(event.characterId);
  }
};

export const applyVehicleDeparted = (
  state: Draft<CampaignState>,
  event: VehicleDepartedEvent,
): void => {
  const vehicle = state.vehicles[event.vehicleId];
  invariant(vehicle !== undefined, `Vehicle ${event.vehicleId} not found`);
  invariant(
    vehicle.occupantIds.includes(event.characterId),
    `${event.characterId} is not aboard ${event.vehicleId}`,
  );
  vehicle.occupantIds = vehicle.occupantIds.filter((id) => id !== event.characterId);
};

export const applyVehicleDamaged = (
  state: Draft<CampaignState>,
  event: VehicleDamagedEvent,
): void => {
  const vehicle = state.vehicles[event.vehicleId];
  invariant(vehicle !== undefined, `Vehicle ${event.vehicleId} not found`);
  vehicle.hp.current = Math.max(0, vehicle.hp.current - event.amount);
};

export const applyVehicleRepaired = (
  state: Draft<CampaignState>,
  event: VehicleRepairedEvent,
): void => {
  const vehicle = state.vehicles[event.vehicleId];
  invariant(vehicle !== undefined, `Vehicle ${event.vehicleId} not found`);
  vehicle.hp.current = Math.min(vehicle.hp.max, vehicle.hp.current + event.amount);
};
