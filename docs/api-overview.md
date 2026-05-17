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

Also exported: `engine.do(campaign, intent)` (dispatches on `intent.type` to the right planner and commits in one call), `engine.content` (the resolved content pack), `engine.schemaVersion`, `engine.rng`.

## Planners

Every planner returns `{ events: Event[] }` (or `{ events, ...outcome }` for the handful that surface a derived bool / id / d4 alongside the chain). RNG-consuming planners bake the dice rolls into the resolution events; `apply()` is RNG-free.

**Encounter lifecycle**: `createEncounter`, `rollInitiative`, `startEncounter`, `beginFirstTurn`, `advanceTurn`, `endEncounter`.

**Combat (attack-side)**: `attack`, `cleave`, `opportunityAttack`, `actionSurge`, `offHandAttack`, `multiattack`, `falling`. Plus mastery-specific `weaponMastery({mastery, ...})`.

**Combat (defense-side)**: `dodge`, `shield`, `absorbElements`, `sanctuaryWardSave`, `consumeGuidance`, `cuttingWords`. Each is a dedicated reaction planner the consumer calls after observing the trigger event. `sanctuaryWardSave` is the inverse direction: called BEFORE an attack against a sanctuary-warded creature, rolling the attacker's WIS save and emitting `SanctuaryProtected` on failure so the consumer drops the attack.

**Class-specific actions**: `sacredWeapon` (Paladin Devotion), `recklessAttack` (Barbarian), `stunningStrike` (Monk), `frenzy` (Barbarian Berserker), `metamagic` (Sorcerer), `wildCompanion` (Druid).

**Movement**: `move`, `dash`, `disengage`, `mistyStep`.

**Spellcasting (cast-time)**: `castSpell` (the general dispatcher), `magicWeapon`, `elementalWeapon`, `counterspell`, `dispelMagic`, `identify`.

**Spellcasting (tick / trigger)**: `checkConcentration`, `expireSpellDurations`, `tickAura`, `tickMovementDamage`, `tickRecurring`, `tickRecurringSave`, `triggerTrap`. Consumers call these at the appropriate moments (per-turn ticks, on-movement, on-trigger).

**Summons**: `dismissCompanion`. Summoning happens via `castSpell` against a `summon` SpellMechanic (find-familiar, find-steed, the summon-X family); the planner emits `CompanionSummoned`.

**Transformations**: `polymorph`, `wildShape`, `simulacrum`, `wish`.

**Resurrection**: `resurrect({characterId, spellId, via})`. Supports `via: 'spell-slot' | 'scroll' | 'special'` so scroll consumption and special revivals can skip caster validation.

**Resting & resources**: `shortRest`, `longRest`, `rest` (generic dispatcher on rest kind).

**Inventory**: `equip` (enforces two-handed-vs-shield arbitration before stamping `ItemEquipped`).

**Contested actions**: `grapple`, `shove`, `hide`.

**Travel & exploration**: `forage`, `navigationCheck`, `forcedMarch`.

**NPC mechanics**: `moraleCheck`, `reactionRoll`.

**Variant rules**: `grantInitialHeroPoints`, `spendHeroPoint` (both require `CampaignSettings.heroPoints: true`).

**Checks & saves**: `save`, `abilityCheck`.

**Progression**: `levelUp`, `resolveChoice`.

## Derivations

All read-only and pure. Memoized per `CampaignState.version`.

- `character(state, id)` → `DerivedCharacter` (totalLevel, proficiency bonus, ability modifiers, HP, `hpMaxBonus` / `effectiveHpMax`, AC, saves, spell slots, pending choices, known languages).
- `ac(state, id)`, `savingThrow(state, id, ability)`, `attackBonus(state, id, weaponInstanceId)`.
- `spellSaveDC(state, id, classId)`, `spellAttackBonus(state, id, classId)`, `spellSlots(state, id)`.
- `abilityModifier(score)`, `proficiencyBonus(level)`: pure helpers.

Stand-alone derivations also exported from the public barrel:

- Effect-stack composition: `buildEffectStack` (returns an `EffectAccumulator` with `advantageFor`, `advantageVsSource`, `hasResistance`, `hasImmunity`, `flatDamageReductionFor`, `critThreshold`, `hasHealingBlocked`, `hasConditionImmunity`, ...).
- Spatial / movement: `terrainAt`, `movementCostFor`, `movementCostAt`, `chebyshevDistanceFeet`, `isInRangeFeet`, `hasLineOfSight`, `hasLineOfEffect`.
- Ability checks: `computeAbilityCheck`, `computePassiveScore`.

Several helpers are intentionally engine-internal (used by planners, not on the public barrel): `mitigateDamage`, `isImmuneToCondition`, `isHealingBlocked`, `getCreatureType`, `getEffectiveSpeed`, `computeCarryingCapacity`, `computeEncumbrance`. Consumers compose these effects through the planner / event surface instead. All take a `characters?: Record<string, Character>` field (slice 105) so source-relative formulas on condition effects resolve correctly when threaded through.

## Events

Every state transition is an event. The discriminated union `Event` lives at `EventSchema` (Zod) and `Event` (TypeScript). The full list (~120 event types) is at [src/schemas/events/index.ts](../src/schemas/events/index.ts) in the `EVENT_TYPES` constant.

Grouped by category:

- **Combat**: `DamageApplied`, `Healed`, `TempHPGranted`, `HPMaxBonusChanged`, `ConditionApplied`, `ConditionRemoved`, `CreaturePushed`, `DeathSaveRolled`, `Stabilized`, `ExhaustionChanged`, `AttackRolled`, `DamageRolled`, `WeaponLoaded`, `SaveRolled`, `AbilityCheckRolled`.
- **Spellcasting**: `SpellCastDeclared`, `SpellSlotConsumed`, `PactSlotConsumed`, `ConcentrationStarted`, `ConcentrationBroken`, `TriggerFired`.
- **Reactive spells**: `SpellCountered`, `SpellDispelled`, `ItemIdentified`, `ShieldCast`, `AbsorbElementsCast`, `SanctuaryProtected`, `GuidanceUsed`.
- **Action economy**: `ActionEconomyConsumed`, `RecklessAttackActivated`, `StunningStrikeAttempted`.
- **Weapon mastery**: `WeaponMasteryActivated`.
- **Encounter**: `EncounterCreated`, `EncounterStarted`, `EncounterEnded`, `InitiativeRolled`, `TurnStarted`, `TurnEnded`, `RoundEnded`.
- **Resting**: `ShortRestStarted`, `ShortRestEnded`, `LongRestStarted`, `LongRestEnded`, `HitDieSpent`, `ResourceSpent`, `ResourceRestored`.
- **Progression**: `CharacterCreated`, `LevelUpResolved`, `ChoiceRequired`, `ChoiceResolved`, `XPAwarded`, `MilestoneAwarded`.
- **Inventory**: `ItemAcquired`, `ItemEquipped`, `ItemUnequipped`, `ItemAttuned`, `ItemUnattuned`, `ItemBuffApplied`, `ItemBuffRemoved`, `ItemChargeConsumed`, `ItemRecharged`, `SentientItemConflict`.
- **Movement**: `CombatantMoved`, `Dashed`, `Disengaged`, `OpportunityAvailable`.
- **Party & treasure**: `PartyCreated`, `PartyMembersChanged`, `CurrencyAcquired`, `CurrencySpent`, `ItemDepositedToParty`, `ItemWithdrawnFromParty`.
- **Sessions & journal**: `SessionStarted`, `SessionEnded`, `JournalEntryAdded`, `InGameTimeAdvanced`.
- **Locations & terrain**: `LocationCreated`, `DoorAdded`, `DoorStateChanged`, `CharacterLocationChanged`.
- **Quests**: `QuestStarted`, `ObjectiveProgressed`, `ObjectiveCompleted`, `ObjectiveFailed`, `QuestCompleted`, `QuestFailed`, `QuestAbandoned`, `QuestRewardClaimed`.
- **Travel**: `TravelLegCompleted`, `NavigationCheckRolled`, `ForagedFor`.
- **NPC mechanics**: `AttitudeChanged`, `MoraleCheckRolled`, `MoraleBroken`.
- **Downtime**: `DowntimeActivityResolved`.
- **Mounts & vehicles**: `Mounted`, `Dismounted`, `VehicleAcquired`, `VehicleBoarded`, `VehicleDeparted`, `VehicleDamaged`, `VehicleRepaired`.
- **Resurrection & transformation**: `CharacterResurrected`, `PolymorphApplied`, `PolymorphReverted`, `SimulacrumCreated`, `WishGranted`.
- **Summons**: `CompanionSummoned`, `CompanionDismissed`.
- **Traps**: `TrapArmed`, `TrapTriggered`, `TrapExpired`.
- **Bastions**: `BastionFounded`, `BastionFacilityAdded`, `BastionHirelingAdded`, `BastionTurnTaken`, `BastionDamaged`, `BastionLevelChanged`.
- **Variant rules**: `CampaignSettingsChanged`, `HeroPointGranted`, `HeroPointSpent`.

## Schemas

Every shape is a Zod schema (parse at boundaries, types via `z.infer`):

- Content: `ContentPackSchema`, `SpeciesSchema`, `BackgroundSchema`, `FeatSchema`, `ClassSchema`, `SubclassSchema`, `ClassFeatureSchema`, `SpellSchema`, `ConditionSchema` (carrying optional `recurringSave` + `autoExpiry` metadata), `ItemDefinitionSchema` (with `WeaponSchema`, `ArmorSchema`, `ToolSchema`, `MagicItemSchema`, `ConsumableSchema`, `GearSchema` variants), `MonsterStatblockSchema`.
- Runtime: `CharacterSchema`, `ItemInstanceSchema` (carrying optional `temporaryBuff`), `EncounterSchema`, `EffectInstanceSchema`, `PartySchema`, `SessionSchema`, `JournalEntrySchema`, `LocationSchema`, `DoorSchema`, `LocationMapSchema`, `QuestSchema`, `QuestObjectiveSchema`, `VehicleSchema`, `BastionSchema`, `TrapSchema`, `CampaignStateSchema`.

## Effect primitives

The fixed vocabulary the engine reads to compute character state. About 30 kinds — see `EFFECT_KINDS` in [src/schemas/effects.ts](../src/schemas/effects.ts) for the canonical list. Highlights:

- Stats: `AddModifier`, `SetAdvantage`, `SetAdvantageVsSource`, `SetACFloor`, `OverrideACFormula`, `ModifySpeed`, `GrantSense`, `GrantProficiency`, `GrantWeaponMastery`.
- Damage / heal: `GrantResistance`, `GrantImmunity`, `GrantVulnerability`, `FlatDamageReduction`, `BlockHealing`, `BoostHealing`, `GrantEvasion`.
- Conditions / immunities: `GrantConditionImmunity` (carries optional `condition?: Predicate` for source-gated immunity arms like Protection from Evil and Good).
- Resources / slots: `GrantResource`, `RecoverResource`, `GrantSpellSlots`, `GrantSpell`, `ExpandSpellList`.
- Action economy: `ModifyActionEconomy`.
- Triggers: `OnEvent` (with `AddDamage`, `AddDamageToAttacker`, `Heal`, `ApplyCondition`, `ApplyConditionToAttacker`, `SpendResource`, `ModifyDamageTaken`, `EmitEvent` TriggerActions). The `ImposeDisadvantageOnAttackers` effect also carries an optional `condition?: Predicate` evaluated against attacker facts at attack time (used by the type-conditional wards).
- Misc: `ExpandCritRange`, `GrantHalfProficiencyBonusFloor`, `ImposeDisadvantageOnAttackers`, `GrantAdvantageToAttackers`, `GrantAura`, `GrantFallingProtection`, `OfferChoice`, `SetHPMaxFormula`, `CustomEffect` (code-handler escape hatch).

## Content packs

```ts
const pack = loadContentPack(json);
const resolved = resolveContent([pack1, pack2]);
const issues = validateCrossReferences(resolved);
```

`loadStarterPack()` returns the bundled starter pack. `STARTER_PACK_RAW` exposes the underlying object if you need to inspect or extend it. `import('ttrpg-engine-dnd/starter-pack')` is a real subpath so browser consumers can code-split the starter content off the main bundle.

## RNG

```ts
import { defaultRNG, seededRNG, throwOnCallRNG } from 'ttrpg-engine-dnd';
```

`seededRNG(seed)` for deterministic tests. `throwOnCallRNG()` is the architectural canary: pass it into a replay to prove `apply()` never reaches for randomness.

## IDs

Branded string types per kind. Factories: `newCharacterId`, `newCreatureId`, `newPartyId`, `newEncounterId`, `newCampaignId`, `newSessionId`, `newLocationId`, `newQuestId`, `newJournalEntryId`, `newEventId`, `newChoiceId`, `newEffectInstanceId`, `newAppliedConditionId`, `newItemInstanceId`, `newTrapId`. Brand casts: `asCharacterId`, `asSpeciesId`, etc.

## Migrations

`migrate(json) → CampaignState` walks the on-disk version forward. `SCHEMA_VERSION` lives in [src/version.ts](../src/version.ts); migrations live in [src/migrations/](../src/migrations/) and run automatically on `loadCampaign(json)`.

## Conveniences

`serializeCampaign(c)` writes a JSON string with id + name + schemaVersion + events only; state is omitted because `loadCampaign(json)` replays the events to reconstruct it. `createPC({name, speciesId, backgroundId, classId, hpMax, ...})` returns a `Character` with sensible defaults; caller emits the `CharacterCreated` event themselves to add to a campaign. `performIntent(campaign, intent)` is the engine.do convenience (same dispatcher as `engine.do`).
