import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import { invariant } from '../../internal/invariants.js';
import type {
  RemoteSensorPlacedEvent,
  RemoteSensorModeChangedEvent,
  RemoteSensorRemovedEvent,
} from '../../schemas/events/sensors.js';

export const applyRemoteSensorPlaced = (
  draft: Draft<CampaignState>,
  event: RemoteSensorPlacedEvent,
): void => {
  invariant(
    draft.sensors[event.sensorId] === undefined,
    `Sensor ${event.sensorId} already placed`,
  );
  draft.sensors[event.sensorId] = {
    id: event.sensorId,
    label: event.label,
    location: event.location,
    casterId: event.casterId,
    sourceSpellId: event.sourceSpellId,
    sourceEffectInstanceId: event.sourceEffectInstanceId,
    mode: event.mode,
  };
};

export const applyRemoteSensorModeChanged = (
  draft: Draft<CampaignState>,
  event: RemoteSensorModeChangedEvent,
): void => {
  const sensor = draft.sensors[event.sensorId];
  invariant(sensor !== undefined, `Sensor ${event.sensorId} not found`);
  sensor.mode = event.mode;
};

export const applyRemoteSensorRemoved = (
  draft: Draft<CampaignState>,
  event: RemoteSensorRemovedEvent,
): void => {
  invariant(
    draft.sensors[event.sensorId] !== undefined,
    `Sensor ${event.sensorId} not found`,
  );
  delete draft.sensors[event.sensorId];
};
