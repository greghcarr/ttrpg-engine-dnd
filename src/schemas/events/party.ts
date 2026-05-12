import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';
import { ULIDSchema } from '../primitives.js';
import { CurrencySchema } from '../runtime/currency.js';

export const PartyCreatedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('PartyCreated'),
  partyId: ULIDSchema,
  name: z.string().min(1),
  memberIds: z.array(ULIDSchema).default([]),
});
export type PartyCreatedEvent = z.infer<typeof PartyCreatedEventSchema>;

export const PartyMembersChangedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('PartyMembersChanged'),
  partyId: ULIDSchema,
  added: z.array(ULIDSchema).default([]),
  removed: z.array(ULIDSchema).default([]),
});
export type PartyMembersChangedEvent = z.infer<typeof PartyMembersChangedEventSchema>;

export const CurrencyAcquiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CurrencyAcquired'),
  partyId: ULIDSchema,
  amounts: CurrencySchema,
  source: z.string().optional(),
});
export type CurrencyAcquiredEvent = z.infer<typeof CurrencyAcquiredEventSchema>;

export const CurrencySpentEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CurrencySpent'),
  partyId: ULIDSchema,
  amounts: CurrencySchema,
  purpose: z.string().optional(),
});
export type CurrencySpentEvent = z.infer<typeof CurrencySpentEventSchema>;

export const ItemDepositedToPartyEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemDepositedToParty'),
  partyId: ULIDSchema,
  itemInstanceId: ULIDSchema,
  sourceCharacterId: ULIDSchema.optional(),
});
export type ItemDepositedToPartyEvent = z.infer<typeof ItemDepositedToPartyEventSchema>;

export const ItemWithdrawnFromPartyEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('ItemWithdrawnFromParty'),
  partyId: ULIDSchema,
  itemInstanceId: ULIDSchema,
  recipientCharacterId: ULIDSchema.optional(),
});
export type ItemWithdrawnFromPartyEvent = z.infer<typeof ItemWithdrawnFromPartyEventSchema>;
