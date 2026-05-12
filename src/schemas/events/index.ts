import { z } from 'zod';
import {
  DamageAppliedEventSchema,
  HealedEventSchema,
  TempHPGrantedEventSchema,
  ConditionAppliedEventSchema,
  ConditionRemovedEventSchema,
  ExhaustionChangedEventSchema,
  DeathSaveRolledEventSchema,
  StabilizedEventSchema,
} from './combat.js';
import {
  ResourceSpentEventSchema,
  ResourceRestoredEventSchema,
  HitDieSpentEventSchema,
} from './resources.js';
import {
  ShortRestStartedEventSchema,
  ShortRestEndedEventSchema,
  LongRestStartedEventSchema,
  LongRestEndedEventSchema,
} from './rest.js';
import { CharacterCreatedEventSchema } from './progression.js';
import {
  EncounterCreatedEventSchema,
  EncounterEndedEventSchema,
  EncounterStartedEventSchema,
  InitiativeRolledEventSchema,
  RoundEndedEventSchema,
  TurnEndedEventSchema,
  TurnStartedEventSchema,
} from './encounter.js';
import {
  AttackRolledEventSchema,
  DamageRolledEventSchema,
} from './attack.js';
import { ItemAcquiredEventSchema } from './inventory.js';
import {
  LevelUpResolvedEventSchema,
  ChoiceRequiredEventSchema,
  ChoiceResolvedEventSchema,
} from './level-up.js';
import {
  SaveRolledEventSchema,
  AbilityCheckRolledEventSchema,
} from './checks.js';
import {
  SpellCastDeclaredEventSchema,
  SpellSlotConsumedEventSchema,
  PactSlotConsumedEventSchema,
} from './spellcasting.js';
import {
  ConcentrationStartedEventSchema,
  ConcentrationBrokenEventSchema,
} from './concentration.js';
import { TriggerFiredEventSchema } from './triggers.js';
import { ActionEconomyConsumedEventSchema } from './action-economy.js';

export const EventSchema = z.discriminatedUnion('type', [
  CharacterCreatedEventSchema,
  DamageAppliedEventSchema,
  HealedEventSchema,
  TempHPGrantedEventSchema,
  ConditionAppliedEventSchema,
  ConditionRemovedEventSchema,
  ExhaustionChangedEventSchema,
  DeathSaveRolledEventSchema,
  StabilizedEventSchema,
  ResourceSpentEventSchema,
  ResourceRestoredEventSchema,
  HitDieSpentEventSchema,
  ShortRestStartedEventSchema,
  ShortRestEndedEventSchema,
  LongRestStartedEventSchema,
  LongRestEndedEventSchema,
  EncounterCreatedEventSchema,
  EncounterStartedEventSchema,
  InitiativeRolledEventSchema,
  TurnStartedEventSchema,
  TurnEndedEventSchema,
  RoundEndedEventSchema,
  EncounterEndedEventSchema,
  AttackRolledEventSchema,
  DamageRolledEventSchema,
  ItemAcquiredEventSchema,
  LevelUpResolvedEventSchema,
  ChoiceRequiredEventSchema,
  ChoiceResolvedEventSchema,
  SaveRolledEventSchema,
  AbilityCheckRolledEventSchema,
  SpellCastDeclaredEventSchema,
  SpellSlotConsumedEventSchema,
  PactSlotConsumedEventSchema,
  ConcentrationStartedEventSchema,
  ConcentrationBrokenEventSchema,
  TriggerFiredEventSchema,
  ActionEconomyConsumedEventSchema,
]);
export type Event = z.infer<typeof EventSchema>;
export type EventType = Event['type'];

export const EVENT_TYPES = [
  'CharacterCreated',
  'DamageApplied',
  'Healed',
  'TempHPGranted',
  'ConditionApplied',
  'ConditionRemoved',
  'ExhaustionChanged',
  'DeathSaveRolled',
  'Stabilized',
  'ResourceSpent',
  'ResourceRestored',
  'HitDieSpent',
  'ShortRestStarted',
  'ShortRestEnded',
  'LongRestStarted',
  'LongRestEnded',
  'EncounterCreated',
  'EncounterStarted',
  'InitiativeRolled',
  'TurnStarted',
  'TurnEnded',
  'RoundEnded',
  'EncounterEnded',
  'AttackRolled',
  'DamageRolled',
  'ItemAcquired',
  'LevelUpResolved',
  'ChoiceRequired',
  'ChoiceResolved',
  'SaveRolled',
  'AbilityCheckRolled',
  'SpellCastDeclared',
  'SpellSlotConsumed',
  'PactSlotConsumed',
  'ConcentrationStarted',
  'ConcentrationBroken',
  'TriggerFired',
  'ActionEconomyConsumed',
] as const satisfies ReadonlyArray<EventType>;

export type {
  DamageAppliedEvent,
  DamageComponent,
  HealedEvent,
  TempHPGrantedEvent,
  ConditionAppliedEvent,
  ConditionRemovedEvent,
  ExhaustionChangedEvent,
  DeathSaveRolledEvent,
  StabilizedEvent,
} from './combat.js';
export type {
  ResourceSpentEvent,
  ResourceRestoredEvent,
  HitDieSpentEvent,
} from './resources.js';
export type {
  ShortRestStartedEvent,
  ShortRestEndedEvent,
  LongRestStartedEvent,
  LongRestEndedEvent,
} from './rest.js';
export type { CharacterCreatedEvent } from './progression.js';
export type { EventEnvelope } from './envelope.js';
export type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  InitiativeRoll,
  TurnStartedEvent,
  TurnEndedEvent,
  RoundEndedEvent,
  EncounterEndedEvent,
} from './encounter.js';
export type {
  AttackRolledEvent,
  DamageRolledEvent,
  DamageRoll,
  AttackAdvantage,
} from './attack.js';
export {
  DamageAppliedEventSchema,
  HealedEventSchema,
  TempHPGrantedEventSchema,
  ConditionAppliedEventSchema,
  ConditionRemovedEventSchema,
  ExhaustionChangedEventSchema,
  DeathSaveRolledEventSchema,
  StabilizedEventSchema,
} from './combat.js';
export {
  ResourceSpentEventSchema,
  ResourceRestoredEventSchema,
  HitDieSpentEventSchema,
} from './resources.js';
export {
  ShortRestStartedEventSchema,
  ShortRestEndedEventSchema,
  LongRestStartedEventSchema,
  LongRestEndedEventSchema,
} from './rest.js';
export { CharacterCreatedEventSchema } from './progression.js';
export { EventEnvelopeSchema } from './envelope.js';
export {
  EncounterCreatedEventSchema,
  EncounterStartedEventSchema,
  InitiativeRolledEventSchema,
  InitiativeRollSchema,
  TurnStartedEventSchema,
  TurnEndedEventSchema,
  RoundEndedEventSchema,
  EncounterEndedEventSchema,
} from './encounter.js';
export {
  AttackRolledEventSchema,
  DamageRolledEventSchema,
  DamageRollSchema,
  AttackAdvantageSchema,
} from './attack.js';
export { ItemAcquiredEventSchema } from './inventory.js';
export type { ItemAcquiredEvent } from './inventory.js';
export {
  LevelUpResolvedEventSchema,
  ChoiceRequiredEventSchema,
  ChoiceResolvedEventSchema,
  HPStrategySchema,
} from './level-up.js';
export type {
  LevelUpResolvedEvent,
  ChoiceRequiredEvent,
  ChoiceResolvedEvent,
  HPStrategy,
} from './level-up.js';
export {
  SaveRolledEventSchema,
  AbilityCheckRolledEventSchema,
  CheckAdvantageSchema,
} from './checks.js';
export type {
  SaveRolledEvent,
  AbilityCheckRolledEvent,
  CheckAdvantage,
} from './checks.js';
export {
  SpellCastDeclaredEventSchema,
  SpellSlotConsumedEventSchema,
  PactSlotConsumedEventSchema,
  SpellSlotSourceSchema,
} from './spellcasting.js';
export type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
  PactSlotConsumedEvent,
  SpellSlotSource,
} from './spellcasting.js';
export {
  ConcentrationStartedEventSchema,
  ConcentrationBrokenEventSchema,
  ConcentrationBrokenReasonSchema,
} from './concentration.js';
export type {
  ConcentrationStartedEvent,
  ConcentrationBrokenEvent,
  ConcentrationBrokenReason,
} from './concentration.js';
export { TriggerFiredEventSchema } from './triggers.js';
export type { TriggerFiredEvent } from './triggers.js';
export {
  ActionEconomyConsumedEventSchema,
  ActionEconomyKindSchema,
  ACTION_ECONOMY_KINDS,
} from './action-economy.js';
export type { ActionEconomyConsumedEvent, ActionEconomyKind } from './action-economy.js';
