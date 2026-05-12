import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';

export const RESURRECTION_SPELLS = [
  'revivify',
  'raise-dead',
  'reincarnate',
  'resurrection',
  'true-resurrection',
] as const;
export const ResurrectionSpellSchema = z.enum(RESURRECTION_SPELLS);
export type ResurrectionSpell = z.infer<typeof ResurrectionSpellSchema>;

export const CharacterResurrectedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CharacterResurrected'),
  characterId: ULIDSchema,
  spell: ResurrectionSpellSchema,
  byCharacterId: ULIDSchema.optional(),
  hpAfter: z.number().int().min(1),
  newSpeciesId: z.string().optional(),
});
export type CharacterResurrectedEvent = z.infer<typeof CharacterResurrectedEventSchema>;
