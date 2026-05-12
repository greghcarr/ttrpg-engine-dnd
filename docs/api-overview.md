# API overview

The public surface is everything re-exported from [src/index.ts](../src/index.ts). Anything not exported is internal and may change without notice.

## Engine

```ts
const engine = createEngine({ contentPacks, rng, handlers? });
```

Returns an `Engine` with five namespaces:

- `engine.createCampaign({ name })` builds a fresh `Campaign` with an empty state.
- `engine.apply(state, event)`, `engine.applyAll(state, events)`, `engine.replay(events)`: pure state transitions.
- `engine.commit(campaign, events)`: append events to a campaign, returning the new campaign.
- `engine.undo(campaign)`, `engine.redo(campaign)`: move the cursor along the log.
- `engine.plan.*`: planners that consume RNG and return events to commit. See [planners](#planners).
- `engine.derive.*`: pure derivations that read state and return typed results. See [derivations](#derivations).

## Planners

Every planner returns `{ events: Event[] }` with the resolution chain baked in (dice rolls included). `apply()` is RNG-free.

**Resting & resources**: `shortRest`, `longRest`, `rest` (generic).

**Combat**: `attack`, `opportunityAttack`, `actionSurge`, `offHandAttack`, `multiattack`, `falling`.

**Encounter lifecycle**: `createEncounter`, `rollInitiative`, `startEncounter`, `beginFirstTurn`, `advanceTurn`, `endEncounter`.

**Movement**: `move`, `dash`, `disengage`.

**Spellcasting**: `castSpell`, `checkConcentration`, `counterspell`, `dispelMagic`, `identify`.

**Checks & saves**: `save`, `abilityCheck`.

**Progression**: `levelUp`, `resolveChoice`.

**Contested actions (Slice 21)**: `grapple`, `shove`, `hide`.

**Weapon mastery (Slice 23)**: `weaponMastery({mastery, attackerId, targetId, weaponInstanceId})`.

**Travel & exploration (Slice 25)**: `forage`, `navigationCheck`.

**NPC mechanics (Slice 26)**: `moraleCheck`, `reactionRoll`.

## Derivations

All read-only.

- `character(state, id)` → `DerivedCharacter` (totalLevel, proficiency bonus, ability modifiers, HP, AC, saves, spell slots, pending choices).
- `ac(state, id)`, `savingThrow(state, id, ability)`, `attackBonus(state, id, weaponInstanceId)`.
- `spellSaveDC(state, id, classId)`, `spellAttackBonus(state, id, classId)`, `spellSlots(state, id)`.
- `abilityModifier(score)`, `proficiencyBonus(level)`: pure helpers.

Stand-alone derivations also exported: `computeAbilityCheck`, `computePassiveScore`, `computeAC`, `buildEffectStack`, plus terrain helpers `terrainAt`, `movementCostFor`, `movementCostAt`, `chebyshevDistanceFeet`, `isInRangeFeet`, `hasLineOfSight`, `hasLineOfEffect`.

## Events

Every state transition is an event. The discriminated union `Event` lives at `EventSchema` (Zod) and `Event` (TypeScript). The full list is at [src/schemas/events/index.ts](../src/schemas/events/index.ts) in the `EVENT_TYPES` constant.

Categories:

- **Combat**: `DamageApplied`, `Healed`, `TempHPGranted`, `ConditionApplied/Removed`, `DeathSaveRolled`, `Stabilized`, `ExhaustionChanged`, `AttackRolled`, `DamageRolled`, `SpellCastDeclared`, `SpellSlotConsumed`, `PactSlotConsumed`, `ConcentrationStarted/Broken`, `TriggerFired`, `ActionEconomyConsumed`, `CombatantMoved`, `Dashed`, `Disengaged`, `SaveRolled`, `AbilityCheckRolled`.
- **Spellcasting (reactive)**: `SpellCountered`, `SpellDispelled`, `ItemIdentified`.
- **Weapon mastery**: `WeaponMasteryActivated`.
- **Encounter**: `EncounterCreated/Started/Ended`, `InitiativeRolled`, `TurnStarted/Ended`, `RoundEnded`.
- **Resting**: `ShortRestStarted/Ended`, `LongRestStarted/Ended`, `HitDieSpent`, `ResourceSpent/Restored`.
- **Progression**: `CharacterCreated`, `LevelUpResolved`, `ChoiceRequired/Resolved`, `XPAwarded`, `MilestoneAwarded`.
- **Inventory**: `ItemAcquired/Equipped/Unequipped/Attuned/Unattuned`, `ItemChargeConsumed`, `ItemRecharged`, `SentientItemConflict`.
- **Party & treasure**: `PartyCreated`, `PartyMembersChanged`, `CurrencyAcquired/Spent`, `ItemDepositedToParty/WithdrawnFromParty`.
- **Sessions & journal**: `SessionStarted/Ended`, `JournalEntryAdded`, `InGameTimeAdvanced`.
- **Locations & terrain**: `LocationCreated`, `DoorAdded`, `DoorStateChanged`, `CharacterLocationChanged`.
- **Quests**: `QuestStarted`, `ObjectiveProgressed/Completed/Failed`, `QuestCompleted/Failed/Abandoned`, `QuestRewardClaimed`.
- **Travel**: `TravelLegCompleted`, `NavigationCheckRolled`, `ForagedFor`.
- **NPC mechanics**: `AttitudeChanged`, `MoraleCheckRolled`, `MoraleBroken`.
- **Downtime**: `DowntimeActivityResolved`.
- **Mounts & vehicles**: `Mounted`, `Dismounted`, `VehicleAcquired`, `VehicleBoarded`, `VehicleDeparted`, `VehicleDamaged`, `VehicleRepaired`.
- **Resurrection & transformation**: `CharacterResurrected`, `PolymorphApplied/Reverted`, `SimulacrumCreated`, `WishGranted`.

## Schemas

Every shape is a Zod schema (parse at boundaries, types via `z.infer`):

- Content: `ContentPackSchema`, `SpeciesSchema`, `BackgroundSchema`, `FeatSchema`, `ClassSchema`, `SubclassSchema`, `ClassFeatureSchema`, `SpellSchema`, `ConditionSchema`, `ItemDefinitionSchema` (and its variants `WeaponSchema`, `ArmorSchema`, `ToolSchema`, `MagicItemSchema`, `ConsumableSchema`, `GearSchema`), `MonsterStatblockSchema`.
- Runtime: `CharacterSchema`, `ItemInstanceSchema`, `EncounterSchema`, `EffectInstanceSchema`, `PartySchema`, `SessionSchema`, `JournalEntrySchema`, `LocationSchema`, `DoorSchema`, `LocationMapSchema`, `QuestSchema`, `QuestObjectiveSchema`, `VehicleSchema`, `CampaignStateSchema`.

## Content packs

```ts
const pack = loadContentPack(json);
const resolved = resolveContent([pack1, pack2]);
const issues = validateCrossReferences(resolved);
```

`loadStarterPack()` returns the bundled starter pack. `STARTER_PACK_RAW` exposes the underlying object if you need to inspect or extend it.

## RNG

```ts
import { defaultRNG, seededRNG, throwOnCallRNG } from 'ttrpg-engine-dnd';
```

`seededRNG(seed)` for deterministic tests. `throwOnCallRNG()` is the architectural canary: pass it into a replay to prove `apply()` never reaches for randomness.

## IDs

Branded string types per kind. Factories: `newCharacterId`, `newCreatureId`, `newPartyId`, `newEncounterId`, `newCampaignId`, `newSessionId`, `newLocationId`, `newQuestId`, `newJournalEntryId`, `newEventId`, `newChoiceId`, `newEffectInstanceId`, `newAppliedConditionId`, `newItemInstanceId`. Brand casts: `asCharacterId`, `asSpeciesId`, etc.

## Migrations

`migrate(json) → CampaignState` walks the on-disk version forward.
