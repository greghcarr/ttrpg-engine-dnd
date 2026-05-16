import { z } from 'zod';
import {
  AbilityScoreSchema,
  DamageTypeSchema,
  DiceExpressionSchema,
  ULIDSchema,
} from '../primitives.js';

// A primed trap: armed at cast time by a spell with the 'trap'
// SpellMechanic, fired later when the consumer detects the trigger
// condition (creature enters proximity, opens the warded object,
// etc.) by calling `engine.plan.triggerTrap`. The engine doesn't
// model positions or trigger predicates; the consumer (DM, VTT,
// adventure runner) decides when a trap fires. Charges go down by
// one each fire; when they hit zero, the trap is removed from state
// via TrapExpired.
//
// The payload is fully pre-baked at arm time so the trap is self-
// contained: the caster's spell DC at arm time is captured numerically,
// and the damage type (if caster-chosen) is locked in. This matters
// for Glyph of Warding, whose 1-hour-cast / until-dispelled lifecycle
// means the caster's stats may change between arming and triggering.
//
// Used by Glyph of Warding's Explosive Runes variant (1 charge,
// caster DC, caster-chosen damage type) and Cordon of Arrows (4
// charges, fixed DC 13, piercing).

export const TrapPayloadSchema = z.object({
  saveAbility: AbilityScoreSchema,
  // DC pre-baked at arm time so trigger-time resolution doesn't depend
  // on the caster's current stats.
  saveDC: z.number().int().min(1),
  damageDice: DiceExpressionSchema,
  damageType: DamageTypeSchema,
  halfOnSuccess: z.boolean().default(true),
});
export type TrapPayload = z.infer<typeof TrapPayloadSchema>;

export const TrapSchema = z.object({
  id: ULIDSchema,
  // Human-readable label for consumers ("Explosive Runes", "Arrow").
  label: z.string(),
  sourceCharacterId: ULIDSchema,
  sourceSpellId: z.string(),
  payload: TrapPayloadSchema,
  chargesRemaining: z.number().int().min(0),
});
export type Trap = z.infer<typeof TrapSchema>;
