import { z } from 'zod';
import { CharacterSchema } from '../runtime/character.js';
import { EventEnvelopeSchema } from './envelope.js';

export const CharacterCreatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CharacterCreated'),
  snapshot: CharacterSchema,
});
export type CharacterCreatedEvent = z.infer<typeof CharacterCreatedEventSchema>;
