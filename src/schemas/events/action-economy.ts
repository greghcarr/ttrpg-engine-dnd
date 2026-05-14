import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { EventEnvelopeSchema } from './envelope.js';

export const ACTION_ECONOMY_KINDS = ['action', 'bonusAction', 'reaction', 'attack'] as const;
export const ActionEconomyKindSchema = z.enum(ACTION_ECONOMY_KINDS);
export type ActionEconomyKind = z.infer<typeof ActionEconomyKindSchema>;

export const ActionEconomyConsumedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ActionEconomyConsumed'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
  kind: ActionEconomyKindSchema,
});
export type ActionEconomyConsumedEvent = z.infer<typeof ActionEconomyConsumedEventSchema>;

// Barbarian Reckless Attack toggle. Set on the combatant's turnUsage
// before their first attack. Persists until their next TurnStarted.
export const RecklessAttackActivatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('RecklessAttackActivated'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
});
export type RecklessAttackActivatedEvent = z.infer<typeof RecklessAttackActivatedEventSchema>;

// Monk Stunning Strike attempt marker. Records the monk used their
// once-per-turn Stunning Strike; the reducer sets the corresponding
// turnUsage flag. The actual save + condition application are emitted
// as separate SaveRolled + ConditionApplied events.
export const StunningStrikeAttemptedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('StunningStrikeAttempted'),
  encounterId: ULIDSchema,
  combatantId: ULIDSchema,
  targetId: ULIDSchema,
});
export type StunningStrikeAttemptedEvent = z.infer<typeof StunningStrikeAttemptedEventSchema>;
