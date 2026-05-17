import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { DamageTypeSchema, ULIDSchema } from '../primitives.js';

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

export const AbsorbElementsCastEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('AbsorbElementsCast'),
  casterId: ULIDSchema,
  // The DamageApplied event id whose damage prompted the reaction.
  triggeringDamageEventId: ULIDSchema,
  damageType: DamageTypeSchema,
  // The damage absorbed (refunded as a `Healed` event of the same
  // amount). Surfaced here for transcript readability so a reader
  // doesn't need to compute it from the Healed event amount.
  halvedAmount: z.number().int().min(0),
});
export type AbsorbElementsCastEvent = z.infer<typeof AbsorbElementsCastEventSchema>;

// Record-only event surfaced by `planSanctuaryWardSave` when an
// attacker fails their WIS save against a Sanctuary-warded creature.
// The consumer reads this to know the declared attack must be
// redirected or dropped per RAW (the attack roll never happens).
// Mirrors the Counterspell / Shield "reaction outcome record"
// pattern: the SaveRolled event captures the roll; this event marks
// the outcome for the transcript and the consumer's branching.
export const SanctuaryProtectedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('SanctuaryProtected'),
  attackerId: ULIDSchema,
  wardedCharacterId: ULIDSchema,
  triggeringSaveEventId: ULIDSchema,
});
export type SanctuaryProtectedEvent = z.infer<typeof SanctuaryProtectedEventSchema>;

// Slice 120. Record-only event surfaced by `planProtection` when a
// Fighting Style: Protection bearer spends their reaction to impose
// disadvantage on an attack against a nearby ally. The planner rolls
// one additional d20; the consumer pairs it with the original
// AttackRolled's d20 to compute the disadvantaged outcome (lower of
// the two). Engine doesn't model positions / line-of-sight, so the
// consumer is responsible for the "ally within 5 ft / attacker
// visible" preconditions.
export const ProtectionUsedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ProtectionUsed'),
  protectorId: ULIDSchema,
  attackerId: ULIDSchema,
  // The AttackRolled event id that the disadvantage is being imposed
  // on. Recorded so the consumer can pair the new d20 with the
  // original roll for the final outcome.
  triggeringAttackEventId: ULIDSchema,
  // Fresh d20 representing the disadvantage roll. Consumers compute
  // the disadvantaged result as min(original d20, this d20).
  newD20: z.number().int().min(1).max(20),
});
export type ProtectionUsedEvent = z.infer<typeof ProtectionUsedEventSchema>;

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
