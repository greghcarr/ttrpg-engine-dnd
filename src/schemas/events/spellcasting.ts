import { z } from 'zod';
import { SpellLevelSchema, ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const SpellSlotSourceSchema = z.enum(['standard', 'pact']);
export type SpellSlotSource = z.infer<typeof SpellSlotSourceSchema>;

export const SpellCastDeclaredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SpellCastDeclared'),
  characterId: ULIDSchema,
  spellId: z.string(),
  slotLevel: SpellLevelSchema,
  slotSource: SpellSlotSourceSchema,
  targetIds: z.array(ULIDSchema).default([]),
  castAsRitual: z.boolean().default(false),
});
export type SpellCastDeclaredEvent = z.infer<typeof SpellCastDeclaredEventSchema>;

export const SpellSlotConsumedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SpellSlotConsumed'),
  characterId: ULIDSchema,
  slotLevel: SpellLevelSchema,
});
export type SpellSlotConsumedEvent = z.infer<typeof SpellSlotConsumedEventSchema>;

export const PactSlotConsumedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('PactSlotConsumed'),
  characterId: ULIDSchema,
});
export type PactSlotConsumedEvent = z.infer<typeof PactSlotConsumedEventSchema>;
