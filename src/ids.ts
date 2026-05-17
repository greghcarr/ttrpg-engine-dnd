import { ulid } from 'ulid';

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type CharacterId = Brand<string, 'CharacterId'>;
export type CreatureId = Brand<string, 'CreatureId'>;
export type CombatantId = CharacterId | CreatureId;
export type PartyId = Brand<string, 'PartyId'>;
export type EncounterId = Brand<string, 'EncounterId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type LocationId = Brand<string, 'LocationId'>;
export type QuestId = Brand<string, 'QuestId'>;
export type JournalEntryId = Brand<string, 'JournalEntryId'>;
export type EventId = Brand<string, 'EventId'>;
export type ChoiceId = Brand<string, 'ChoiceId'>;
export type EffectInstanceId = Brand<string, 'EffectInstanceId'>;
export type AppliedConditionId = Brand<string, 'AppliedConditionId'>;
export type TrapId = Brand<string, 'TrapId'>;
export type SensorId = Brand<string, 'SensorId'>;
export type IllusionId = Brand<string, 'IllusionId'>;

export type SpeciesId = Brand<string, 'SpeciesId'>;
export type BackgroundId = Brand<string, 'BackgroundId'>;
export type ClassId = Brand<string, 'ClassId'>;
export type SubclassId = Brand<string, 'SubclassId'>;
export type ClassFeatureId = Brand<string, 'ClassFeatureId'>;
export type FeatId = Brand<string, 'FeatId'>;
export type SpellId = Brand<string, 'SpellId'>;
export type ConditionId = Brand<string, 'ConditionId'>;
export type MonsterStatblockId = Brand<string, 'MonsterStatblockId'>;
export type ResourceId = Brand<string, 'ResourceId'>;

export type ItemDefinitionId = Brand<string, 'ItemDefinitionId'>;
export type ItemInstanceId = Brand<string, 'ItemInstanceId'>;

export type ContentPackId = Brand<string, 'ContentPackId'>;
export type HandlerId = Brand<string, 'HandlerId'>;

export const newCharacterId = (): CharacterId => ulid() as CharacterId;
export const newCreatureId = (): CreatureId => ulid() as CreatureId;
export const newPartyId = (): PartyId => ulid() as PartyId;
export const newEncounterId = (): EncounterId => ulid() as EncounterId;
export const newCampaignId = (): CampaignId => ulid() as CampaignId;
export const newSessionId = (): SessionId => ulid() as SessionId;
export const newLocationId = (): LocationId => ulid() as LocationId;
export const newQuestId = (): QuestId => ulid() as QuestId;
export const newJournalEntryId = (): JournalEntryId => ulid() as JournalEntryId;
export const newEventId = (): EventId => ulid() as EventId;
export const newChoiceId = (): ChoiceId => ulid() as ChoiceId;
export const newEffectInstanceId = (): EffectInstanceId => ulid() as EffectInstanceId;
export const newAppliedConditionId = (): AppliedConditionId => ulid() as AppliedConditionId;
export const newItemInstanceId = (): ItemInstanceId => ulid() as ItemInstanceId;
export const newTrapId = (): TrapId => ulid() as TrapId;
export const newSensorId = (): SensorId => ulid() as SensorId;
export const newIllusionId = (): IllusionId => ulid() as IllusionId;

export const asCharacterId = (s: string): CharacterId => s as CharacterId;
export const asCreatureId = (s: string): CreatureId => s as CreatureId;
export const asSpeciesId = (s: string): SpeciesId => s as SpeciesId;
export const asBackgroundId = (s: string): BackgroundId => s as BackgroundId;
export const asClassId = (s: string): ClassId => s as ClassId;
export const asSubclassId = (s: string): SubclassId => s as SubclassId;
export const asClassFeatureId = (s: string): ClassFeatureId => s as ClassFeatureId;
export const asFeatId = (s: string): FeatId => s as FeatId;
export const asSpellId = (s: string): SpellId => s as SpellId;
export const asConditionId = (s: string): ConditionId => s as ConditionId;
export const asMonsterStatblockId = (s: string): MonsterStatblockId => s as MonsterStatblockId;
export const asResourceId = (s: string): ResourceId => s as ResourceId;
export const asItemDefinitionId = (s: string): ItemDefinitionId => s as ItemDefinitionId;
export const asItemInstanceId = (s: string): ItemInstanceId => s as ItemInstanceId;
export const asContentPackId = (s: string): ContentPackId => s as ContentPackId;
export const asHandlerId = (s: string): HandlerId => s as HandlerId;
