import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';
import { PositionSchema } from '../runtime/encounter.js';
import {
  DoorStateSchema,
  LocationMapSchema,
} from '../runtime/location.js';

export const LocationCreatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('LocationCreated'),
  locationId: ULIDSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  parentLocationId: ULIDSchema.optional(),
  map: LocationMapSchema.optional(),
});
export type LocationCreatedEvent = z.infer<typeof LocationCreatedEventSchema>;

export const DoorAddedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('DoorAdded'),
  doorId: ULIDSchema,
  locationId: ULIDSchema,
  name: z.string().optional(),
  position: PositionSchema,
  state: DoorStateSchema,
});
export type DoorAddedEvent = z.infer<typeof DoorAddedEventSchema>;

export const DoorStateChangedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('DoorStateChanged'),
  doorId: ULIDSchema,
  toState: DoorStateSchema,
  byCharacterId: ULIDSchema.optional(),
});
export type DoorStateChangedEvent = z.infer<typeof DoorStateChangedEventSchema>;

export const CharacterLocationChangedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CharacterLocationChanged'),
  characterId: ULIDSchema,
  toLocationId: ULIDSchema.optional(),
});
export type CharacterLocationChangedEvent = z.infer<typeof CharacterLocationChangedEventSchema>;
