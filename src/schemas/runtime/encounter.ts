import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

export const EncounterStatusSchema = z.enum(['planning', 'active', 'ended']);
export type EncounterStatus = z.infer<typeof EncounterStatusSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const TurnUsageSchema = z.object({
  actionUsed: z.boolean().default(false),
  bonusActionUsed: z.boolean().default(false),
  attacksMadeThisTurn: z.number().int().min(0).default(0),
  reactionUsedThisRound: z.boolean().default(false),
  feetMovedThisTurn: z.number().min(0).default(0),
  dashed: z.boolean().default(false),
  disengaged: z.boolean().default(false),
  // Item-instance ids of any weapons with the `loading` property that
  // were fired this turn. RAW Loading: a Loading weapon can fire only
  // one piece of ammunition per attack action / bonus action / reaction.
  // Reset alongside the other per-turn flags at TurnStarted.
  loadedWeaponsFiredThisTurn: ULIDSchema.array().default([]),
});
export type TurnUsage = z.infer<typeof TurnUsageSchema>;

export const EMPTY_TURN_USAGE: TurnUsage = {
  actionUsed: false,
  bonusActionUsed: false,
  attacksMadeThisTurn: 0,
  reactionUsedThisRound: false,
  feetMovedThisTurn: 0,
  dashed: false,
  disengaged: false,
  loadedWeaponsFiredThisTurn: [],
};

export const CombatantSchema = z.object({
  combatantId: ULIDSchema,
  initiative: z.number().int(),
  initiativeOrder: z.number().int().min(0),
  hasActedThisRound: z.boolean().default(false),
  turnUsage: TurnUsageSchema.default(EMPTY_TURN_USAGE),
  position: PositionSchema.optional(),
});
export type Combatant = z.infer<typeof CombatantSchema>;

export const EncounterSchema = z.object({
  id: ULIDSchema,
  name: z.string().optional(),
  status: EncounterStatusSchema,
  combatants: z.array(CombatantSchema).default([]),
  round: z.number().int().min(0),
  activeIndex: z.number().int().min(0),
  startedAtEventId: ULIDSchema.optional(),
  endedAtEventId: ULIDSchema.optional(),
  outcome: z.enum(['victory', 'defeat', 'fled', 'parley']).optional(),
});
export type Encounter = z.infer<typeof EncounterSchema>;
