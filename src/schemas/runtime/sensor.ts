import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

// Slice 135: a placed remote sensor. RAW 2024 Clairvoyance creates
// "an invisible sensor within range in a location familiar to you ...
// You can use the chosen sense through the sensor as if you were in
// its space. As your action, you can switch between seeing and
// hearing." Scrying creates a similar sensor near a creature target.
//
// The engine doesn't model perception or position outside combat
// cells, so the sensor's `location` is consumer-supplied free text
// (the placed area; consumers / DMs decide what's seen / heard
// through it). What the engine DOES track:
//   - which character placed the sensor (concentration owner)
//   - the spell that placed it (sourceSpellId)
//   - the effect-instance link (so a concentration drop can clean up
//     this sensor specifically; mirrors the slice-110 sourceEffect
//     InstanceId pattern used by rider-applied conditions)
//   - current sense mode (seeing or hearing; planSwitchSensorMode
//     toggles)
//   - free-text label / location for consumer display
//
// Sensors are not creatures, can't be attacked, have no HP, and
// don't appear in encounters. They live entirely in
// `state.sensors`. clearConcentrationEffect drops sensors tagged
// with the dropped effect's id.

export const SensorModeSchema = z.enum(['sight', 'hearing']);
export type SensorMode = z.infer<typeof SensorModeSchema>;

export const SensorSchema = z.object({
  id: ULIDSchema,
  // Human-readable display label for consumers ("Clairvoyant Eye
  // over Lord Westra's study").
  label: z.string(),
  // Free-text description of where the sensor was placed. Consumer
  // territory; the engine doesn't reason about the location.
  location: z.string(),
  // The character whose concentration sustains this sensor. When
  // their concentration drops, the sensor is removed.
  casterId: ULIDSchema,
  sourceSpellId: z.string(),
  // Optional link to the EffectInstance that owns this sensor.
  // Populated when the spell was cast via the standard concentration
  // path; consumed by clearConcentrationEffect to cull this sensor
  // when the linked effect ends.
  sourceEffectInstanceId: ULIDSchema.optional(),
  mode: SensorModeSchema,
  // Slice 138: Arcane Eye creates a mobile sensor the caster moves
  // with a bonus action. Clairvoyance / Scrying sensors stay fixed.
  // planMoveSensor rejects moves on immobile sensors.
  mobile: z.boolean().default(false),
  // Optional darkvision range in feet. RAW Arcane Eye: 30 ft.
  // Informational for consumer display; the engine doesn't reason
  // about light through the sensor.
  darkvisionRange: z.number().int().min(0).optional(),
});
export type Sensor = z.infer<typeof SensorSchema>;
