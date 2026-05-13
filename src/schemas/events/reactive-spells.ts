import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';

export const SpellCounteredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SpellCountered'),
  originalSpellEventId: ULIDSchema,
  counterCasterId: ULIDSchema,
  targetCasterId: ULIDSchema,
  spellId: z.string(),
});
export type SpellCounteredEvent = z.infer<typeof SpellCounteredEventSchema>;

export const SpellDispelledEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SpellDispelled'),
  effectInstanceId: ULIDSchema,
  dispelledByCharacterId: ULIDSchema,
});
export type SpellDispelledEvent = z.infer<typeof SpellDispelledEventSchema>;

export const ItemIdentifiedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemIdentified'),
  itemInstanceId: ULIDSchema,
  identifiedByCharacterId: ULIDSchema,
});
export type ItemIdentifiedEvent = z.infer<typeof ItemIdentifiedEventSchema>;

export const ShieldCastEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ShieldCast'),
  casterId: ULIDSchema,
  triggeringAttackEventId: ULIDSchema,
  // Whether +5 AC was enough to convert the triggering hit into a miss.
  // The consumer uses this to decide whether to commit the damage chain.
  preventedHit: z.boolean(),
});
export type ShieldCastEvent = z.infer<typeof ShieldCastEventSchema>;

export const GuidanceUsedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('GuidanceUsed'),
  targetId: ULIDSchema,
  // The 1d4 roll the target adds to their ability check. The consumer
  // is responsible for surfacing this number to whoever made the check
  // (Guidance lets the target see the roll and decide whether to apply
  // it, but mechanically the engine has already rolled the d4 — the
  // d4 just goes onto the check's total).
  d4: z.number().int().min(1).max(4),
  // Optional reference to the AbilityCheckRolled event this d4 is being
  // applied to, when the consumer is consuming Guidance in tandem with
  // a check. Purely informational.
  abilityCheckEventId: ULIDSchema.optional(),
});
export type GuidanceUsedEvent = z.infer<typeof GuidanceUsedEventSchema>;
