import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

export const EncounterStatusSchema = z.enum(['planning', 'active', 'ended']);
export type EncounterStatus = z.infer<typeof EncounterStatusSchema>;

export const TurnUsageSchema = z.object({
  actionUsed: z.boolean().default(false),
  bonusActionUsed: z.boolean().default(false),
  attacksMadeThisTurn: z.number().int().min(0).default(0),
  reactionUsedThisRound: z.boolean().default(false),
});
export type TurnUsage = z.infer<typeof TurnUsageSchema>;

export const EMPTY_TURN_USAGE: TurnUsage = {
  actionUsed: false,
  bonusActionUsed: false,
  attacksMadeThisTurn: 0,
  reactionUsedThisRound: false,
};

export const CombatantSchema = z.object({
  combatantId: ULIDSchema,
  initiative: z.number().int(),
  initiativeOrder: z.number().int().min(0),
  hasActedThisRound: z.boolean().default(false),
  turnUsage: TurnUsageSchema.default(EMPTY_TURN_USAGE),
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
