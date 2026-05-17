import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';
import { SensorModeSchema } from '../runtime/sensor.js';

// Slice 135: lifecycle events for remote sensors (Clairvoyance,
// Scrying). The sensor is placed at cast time (RemoteSensorPlaced),
// switched between sight / hearing on the caster's action
// (RemoteSensorModeChanged), and removed when concentration drops or
// the caster ends the spell (RemoteSensorRemoved).

export const RemoteSensorPlacedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('RemoteSensorPlaced'),
  sensorId: ULIDSchema,
  label: z.string(),
  location: z.string(),
  casterId: ULIDSchema,
  sourceSpellId: z.string(),
  sourceEffectInstanceId: ULIDSchema.optional(),
  mode: SensorModeSchema,
});
export type RemoteSensorPlacedEvent = z.infer<typeof RemoteSensorPlacedEventSchema>;

export const RemoteSensorModeChangedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('RemoteSensorModeChanged'),
  sensorId: ULIDSchema,
  mode: SensorModeSchema,
});
export type RemoteSensorModeChangedEvent = z.infer<typeof RemoteSensorModeChangedEventSchema>;

export const SENSOR_REMOVAL_REASONS = [
  'concentrationDropped',
  'spellEnded',
  'casterAction',
  'dispelled',
] as const;
export const SensorRemovalReasonSchema = z.enum(SENSOR_REMOVAL_REASONS);
export type SensorRemovalReason = z.infer<typeof SensorRemovalReasonSchema>;

export const RemoteSensorRemovedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('RemoteSensorRemoved'),
  sensorId: ULIDSchema,
  reason: SensorRemovalReasonSchema,
});
export type RemoteSensorRemovedEvent = z.infer<typeof RemoteSensorRemovedEventSchema>;
