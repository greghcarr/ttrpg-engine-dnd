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
