import { z } from 'zod';
import { EffectSchema } from '../effects.js';
import { AbilityScoreSchema } from '../primitives.js';

// Recurring saving-throw metadata. When set, the consumer calls
// `engine.plan.tickRecurringSave` at the indicated trigger moment on
// the bearer's turn; the planner rolls a save against the source
// caster's spell DC, emits a SaveRolled, and on failure executes the
// `onFail` consequence. Bestow Curse's "Inactive Turn" variant uses
// this to enforce the WIS save / wasted action on the cursed
// creature's turn. Source caster + casting class are read from the
// AppliedCondition's `sourceCharacterId` (set by spell planners since
// slice 88) and the caster's primary spellcasting class, with consumer
// overrides on the intent.
export const RecurringSaveSchema = z.object({
  ability: AbilityScoreSchema,
  // 'turnStart' fires when the consumer ticks at the bearer's start
  // of turn; 'turnEnd' at the end. Engine doesn't track turn moments
  // directly — this field is metadata that the consumer reads to know
  // when to fire the tick.
  trigger: z.enum(['turnStart', 'turnEnd']).default('turnStart'),
  // What happens on a failed save:
  //   'consumeAction' = ActionEconomyConsumed (action) for the bearer
  //                     (only emitted when the bearer is a combatant
  //                     in the active encounter).
  onFail: z.enum(['consumeAction']),
});
export type RecurringSave = z.infer<typeof RecurringSaveSchema>;

export const ConditionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  effects: z.array(EffectSchema).default([]),
  stackable: z.boolean().default(false),
  endsOn: z
    .array(
      z.union([
        z.object({ kind: z.literal('shortRest') }),
        z.object({ kind: z.literal('longRest') }),
        z.object({ kind: z.literal('turnEnd'), ownerId: z.string().optional() }),
        z.object({ kind: z.literal('saveSuccess'), ability: z.string(), dc: z.number().int() }),
        z.object({ kind: z.literal('damageTaken') }),
      ]),
    )
    .default([]),
  recurringSave: RecurringSaveSchema.optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;
