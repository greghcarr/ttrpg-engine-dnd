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
import {
  CombatantMovedEventSchema,
  DashedEventSchema,
  DisengagedEventSchema,
} from './movement.js';
import {
  ItemEquippedEventSchema,
  ItemUnequippedEventSchema,
  ItemAttunedEventSchema,
  ItemUnattunedEventSchema,
} from './inventory.js';
import {
  PartyCreatedEventSchema,
  PartyMembersChangedEventSchema,
  CurrencyAcquiredEventSchema,
  CurrencySpentEventSchema,
  ItemDepositedToPartyEventSchema,
  ItemWithdrawnFromPartyEventSchema,
} from './party.js';
import {
  SessionStartedEventSchema,
  SessionEndedEventSchema,
  JournalEntryAddedEventSchema,
  InGameTimeAdvancedEventSchema,
} from './session.js';
import {
  LocationCreatedEventSchema,
  DoorAddedEventSchema,
  DoorStateChangedEventSchema,
  CharacterLocationChangedEventSchema,
} from './locations.js';
import {
  QuestStartedEventSchema,
  ObjectiveProgressedEventSchema,
  ObjectiveCompletedEventSchema,
  ObjectiveFailedEventSchema,
  QuestCompletedEventSchema,
  QuestFailedEventSchema,
  QuestAbandonedEventSchema,
  QuestRewardClaimedEventSchema,
  XPAwardedEventSchema,
  MilestoneAwardedEventSchema,
} from './quests.js';
import {
  SpellCounteredEventSchema,
  SpellDispelledEventSchema,
  ItemIdentifiedEventSchema,
} from './reactive-spells.js';
import { WeaponMasteryActivatedEventSchema } from './weapon-mastery.js';
import {
  MountedEventSchema,
  DismountedEventSchema,
  VehicleAcquiredEventSchema,
  VehicleBoardedEventSchema,
  VehicleDepartedEventSchema,
  VehicleDamagedEventSchema,
  VehicleRepairedEventSchema,
} from './mounts-vehicles.js';
import {
  TravelLegCompletedEventSchema,
  NavigationCheckRolledEventSchema,
  ForagedForEventSchema,
} from './travel.js';
import {
  AttitudeChangedEventSchema,
  MoraleCheckRolledEventSchema,
  MoraleBrokenEventSchema,
} from './npc.js';
import { DowntimeActivityResolvedEventSchema } from './downtime.js';
import {
  ItemChargeConsumedEventSchema,
  ItemRechargedEventSchema,
  SentientItemConflictEventSchema,
} from './charges.js';
import { CharacterResurrectedEventSchema } from './resurrection.js';

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
  CombatantMovedEventSchema,
  DashedEventSchema,
  DisengagedEventSchema,
  ItemEquippedEventSchema,
  ItemUnequippedEventSchema,
  ItemAttunedEventSchema,
  ItemUnattunedEventSchema,
  PartyCreatedEventSchema,
  PartyMembersChangedEventSchema,
  CurrencyAcquiredEventSchema,
  CurrencySpentEventSchema,
  ItemDepositedToPartyEventSchema,
  ItemWithdrawnFromPartyEventSchema,
  SessionStartedEventSchema,
  SessionEndedEventSchema,
  JournalEntryAddedEventSchema,
  InGameTimeAdvancedEventSchema,
  LocationCreatedEventSchema,
  DoorAddedEventSchema,
  DoorStateChangedEventSchema,
  CharacterLocationChangedEventSchema,
  QuestStartedEventSchema,
  ObjectiveProgressedEventSchema,
  ObjectiveCompletedEventSchema,
  ObjectiveFailedEventSchema,
  QuestCompletedEventSchema,
  QuestFailedEventSchema,
  QuestAbandonedEventSchema,
  QuestRewardClaimedEventSchema,
  XPAwardedEventSchema,
  MilestoneAwardedEventSchema,
  SpellCounteredEventSchema,
  SpellDispelledEventSchema,
  ItemIdentifiedEventSchema,
  WeaponMasteryActivatedEventSchema,
  MountedEventSchema,
  DismountedEventSchema,
  VehicleAcquiredEventSchema,
  VehicleBoardedEventSchema,
  VehicleDepartedEventSchema,
  VehicleDamagedEventSchema,
  VehicleRepairedEventSchema,
  TravelLegCompletedEventSchema,
  NavigationCheckRolledEventSchema,
  ForagedForEventSchema,
  AttitudeChangedEventSchema,
  MoraleCheckRolledEventSchema,
  MoraleBrokenEventSchema,
  DowntimeActivityResolvedEventSchema,
  ItemChargeConsumedEventSchema,
  ItemRechargedEventSchema,
  SentientItemConflictEventSchema,
  CharacterResurrectedEventSchema,
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
  'CombatantMoved',
  'Dashed',
  'Disengaged',
  'ItemEquipped',
  'ItemUnequipped',
  'ItemAttuned',
  'ItemUnattuned',
  'PartyCreated',
  'PartyMembersChanged',
  'CurrencyAcquired',
  'CurrencySpent',
  'ItemDepositedToParty',
  'ItemWithdrawnFromParty',
  'SessionStarted',
  'SessionEnded',
  'JournalEntryAdded',
  'InGameTimeAdvanced',
  'LocationCreated',
  'DoorAdded',
  'DoorStateChanged',
  'CharacterLocationChanged',
  'QuestStarted',
  'ObjectiveProgressed',
  'ObjectiveCompleted',
  'ObjectiveFailed',
  'QuestCompleted',
  'QuestFailed',
  'QuestAbandoned',
  'QuestRewardClaimed',
  'XPAwarded',
  'MilestoneAwarded',
  'SpellCountered',
  'SpellDispelled',
  'ItemIdentified',
  'WeaponMasteryActivated',
  'Mounted',
  'Dismounted',
  'VehicleAcquired',
  'VehicleBoarded',
  'VehicleDeparted',
  'VehicleDamaged',
  'VehicleRepaired',
  'TravelLegCompleted',
  'NavigationCheckRolled',
  'ForagedFor',
  'AttitudeChanged',
  'MoraleCheckRolled',
  'MoraleBroken',
  'DowntimeActivityResolved',
  'ItemChargeConsumed',
  'ItemRecharged',
  'SentientItemConflict',
  'CharacterResurrected',
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
export {
  ItemAcquiredEventSchema,
  ItemEquippedEventSchema,
  ItemUnequippedEventSchema,
  ItemAttunedEventSchema,
  ItemUnattunedEventSchema,
  EquipSlotSchema,
  EQUIP_SLOTS,
} from './inventory.js';
export type {
  ItemAcquiredEvent,
  ItemEquippedEvent,
  ItemUnequippedEvent,
  ItemAttunedEvent,
  ItemUnattunedEvent,
  EquipSlot,
} from './inventory.js';
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
export {
  CombatantMovedEventSchema,
  DashedEventSchema,
  DisengagedEventSchema,
} from './movement.js';
export type {
  CombatantMovedEvent,
  DashedEvent,
  DisengagedEvent,
} from './movement.js';
export {
  PartyCreatedEventSchema,
  PartyMembersChangedEventSchema,
  CurrencyAcquiredEventSchema,
  CurrencySpentEventSchema,
  ItemDepositedToPartyEventSchema,
  ItemWithdrawnFromPartyEventSchema,
} from './party.js';
export type {
  PartyCreatedEvent,
  PartyMembersChangedEvent,
  CurrencyAcquiredEvent,
  CurrencySpentEvent,
  ItemDepositedToPartyEvent,
  ItemWithdrawnFromPartyEvent,
} from './party.js';
export {
  SessionStartedEventSchema,
  SessionEndedEventSchema,
  JournalEntryAddedEventSchema,
  InGameTimeAdvancedEventSchema,
} from './session.js';
export type {
  SessionStartedEvent,
  SessionEndedEvent,
  JournalEntryAddedEvent,
  InGameTimeAdvancedEvent,
} from './session.js';
export {
  LocationCreatedEventSchema,
  DoorAddedEventSchema,
  DoorStateChangedEventSchema,
  CharacterLocationChangedEventSchema,
} from './locations.js';
export type {
  LocationCreatedEvent,
  DoorAddedEvent,
  DoorStateChangedEvent,
  CharacterLocationChangedEvent,
} from './locations.js';
export {
  QuestStartedEventSchema,
  ObjectiveProgressedEventSchema,
  ObjectiveCompletedEventSchema,
  ObjectiveFailedEventSchema,
  QuestCompletedEventSchema,
  QuestFailedEventSchema,
  QuestAbandonedEventSchema,
  QuestRewardClaimedEventSchema,
  XPAwardedEventSchema,
  MilestoneAwardedEventSchema,
  MilestoneKindSchema,
  MILESTONE_KINDS,
} from './quests.js';
export type {
  QuestStartedEvent,
  ObjectiveProgressedEvent,
  ObjectiveCompletedEvent,
  ObjectiveFailedEvent,
  QuestCompletedEvent,
  QuestFailedEvent,
  QuestAbandonedEvent,
  QuestRewardClaimedEvent,
  XPAwardedEvent,
  MilestoneAwardedEvent,
  MilestoneKind,
} from './quests.js';
export {
  SpellCounteredEventSchema,
  SpellDispelledEventSchema,
  ItemIdentifiedEventSchema,
} from './reactive-spells.js';
export type {
  SpellCounteredEvent,
  SpellDispelledEvent,
  ItemIdentifiedEvent,
} from './reactive-spells.js';
export { WeaponMasteryActivatedEventSchema } from './weapon-mastery.js';
export type { WeaponMasteryActivatedEvent } from './weapon-mastery.js';
export {
  MountedEventSchema,
  DismountedEventSchema,
  VehicleAcquiredEventSchema,
  VehicleBoardedEventSchema,
  VehicleDepartedEventSchema,
  VehicleDamagedEventSchema,
  VehicleRepairedEventSchema,
} from './mounts-vehicles.js';
export type {
  MountedEvent,
  DismountedEvent,
  VehicleAcquiredEvent,
  VehicleBoardedEvent,
  VehicleDepartedEvent,
  VehicleDamagedEvent,
  VehicleRepairedEvent,
} from './mounts-vehicles.js';
export {
  TravelLegCompletedEventSchema,
  NavigationCheckRolledEventSchema,
  ForagedForEventSchema,
} from './travel.js';
export type {
  TravelLegCompletedEvent,
  NavigationCheckRolledEvent,
  ForagedForEvent,
} from './travel.js';
export {
  AttitudeChangedEventSchema,
  MoraleCheckRolledEventSchema,
  MoraleBrokenEventSchema,
  AttitudeSchema,
  ATTITUDES,
} from './npc.js';
export type {
  AttitudeChangedEvent,
  MoraleCheckRolledEvent,
  MoraleBrokenEvent,
  Attitude,
} from './npc.js';
export {
  DowntimeActivityResolvedEventSchema,
  DowntimeKindSchema,
  DowntimeOutcomeSchema,
  DOWNTIME_KINDS,
  DOWNTIME_OUTCOMES,
} from './downtime.js';
export type {
  DowntimeActivityResolvedEvent,
  DowntimeKind,
  DowntimeOutcome,
} from './downtime.js';
export {
  ItemChargeConsumedEventSchema,
  ItemRechargedEventSchema,
  SentientItemConflictEventSchema,
  RechargeCadenceSchema,
  RECHARGE_CADENCES,
} from './charges.js';
export type {
  ItemChargeConsumedEvent,
  ItemRechargedEvent,
  SentientItemConflictEvent,
  RechargeCadence,
} from './charges.js';
export {
  CharacterResurrectedEventSchema,
  ResurrectionSpellSchema,
  RESURRECTION_SPELLS,
} from './resurrection.js';
export type {
  CharacterResurrectedEvent,
  ResurrectionSpell,
} from './resurrection.js';
