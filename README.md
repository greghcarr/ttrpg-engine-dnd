# dnd-engine

[![CI](https://github.com/greghcarr/dnd-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/greghcarr/dnd-engine/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange)](README.md#status)

A standalone, event-sourced TypeScript domain engine for Dungeons & Dragons 5.5e (the 2024 rules update).

If you are building a D&D character sheet, encounter tracker, virtual tabletop, automation tool, or AI dungeon master and you do not want to reimplement the rules engine from scratch, this is for you.

## Why this engine

- **Built for accuracy first.** Full mechanical coverage of the 2024 Player's Handbook, Dungeon Master's Guide, and Monster Manual is the explicit goal. Every printed class, subclass, species, background, feat, spell, weapon, armor, magic item, condition, and monster statblock can be expressed.
- **No content, no IP problems.** The library ships schemas and an engine. It does not ship any rulebook text or statblocks. You bring your own content packs (built from the SRD 5.2 or your own homebrew), and the engine validates and runs them.
- **Event-sourced, fully deterministic replay.** Every state change is an event. A captured event log replays to byte-identical state across machines. Undo and redo are free.
- **Plan/commit split.** All randomness is consumed inside `engine.plan(intent)` and baked into resolution events. `apply()` is pure and replay never re-rolls dice. This is the architectural foundation that makes multiplayer sync, save files, and audit logs work correctly.
- **Effect-primitive vocabulary plus escape hatch.** About 25 declarative primitives express the bulk of 5.5e features as pure data; a `CustomEffect` code-handler hook covers genuinely-procedural exotica (Wild Shape, Wish, Simulacrum) and table-specific houserules.
- **Solid foundations.** TypeScript strict mode. Zod validation at boundaries. Immer-backed reducers, immutable externally. ESM and CJS builds. Zero peer-dependency conflicts.
- **Living transcripts.** Every golden test emits a human-readable markdown transcript of its event log, checked into [tests/golden/transcripts/](tests/golden/transcripts/). Every PR that changes engine behavior shows the transcript diff alongside the code. See [the showcase transcript](tests/golden/transcripts/showcase.transcript.md) for a representative narrative: a three-PC party fights two goblins, one drops to 0, a death save lands, a paladin heals, fight ends, party rests.

## Architecture

- **Event-sourced.** State changes are events. `apply(state, event) -> state` is pure. Replay any campaign from its event log.
- **Plan/commit split.** RNG is consumed only inside `engine.plan(intent)`. Resolution events carry baked rolls, so `apply()` is deterministic. Replay never re-rolls.
- **Effect-primitive vocabulary.** Features (class features, feats, magic item powers, conditions) are described via a fixed vocabulary of about 25 effect primitives. Wild Shape, Polymorph, Wish, Simulacrum and a handful of others drop to code handlers.
- **Schema-only.** The library ships shapes (`Character`, `Spell`, `MagicItem`, `MonsterStatblock`, etc.) and the engine that operates on them. Consumers load rules content from their own JSON content packs. This keeps the IP story clean.
- **Branded IDs + ULIDs.** `CharacterId`, `SpellId`, `ItemDefinitionId` versus `ItemInstanceId`, etc. Backed by ULIDs (lexicographically sortable by time).
- **PendingChoice protocol.** Deferred player decisions (ASI vs feat, fighting style selection, spell target selection) are first-class events in the log.
- **Zod for validation, Immer for clean reducers, Vitest for tests.**

## Status

**Pre-alpha.** Thirty slices complete (Phases A, B, and C done), 443 tests across 80 files. The engine compiles, builds (ESM + CJS + `.d.ts`), and the architectural invariants (event-sourcing, plan/commit, RNG capture, replay equivalence, branded IDs, effect primitives) are locked and proven by the test suite.

The next priority is the adoption surface (npm publish, starter SRD content pack, examples directory, getting-started doc), tracked as Phase D in the Roadmap below. Until then, the library is install-via-git-URL and the test suite is the de facto API reference.

## Roadmap

Six phases. The slice catalog below is the canonical list; ✓ marks done, blank marks pending. Phases A, B, and C are complete (30 slices). Next up: Phase D (adoption surface) followed by Phase E (2024 content) and the optional Phase F (core extraction).

### Phase A: Engine mechanics (16 slices, all done)

Each slice landed a load-bearing combat or rules mechanic. Order was dependency-driven.

- ✓ **Slice 1.** Character creation, HP, damage, healing, temp HP, hit dice, short / long rest, exhaustion, conditions, death saves, stabilize.
- ✓ **Slice 2.** Combat resolution chain (`AttackDeclared` -> `AttackRolled` -> `DamageRolled` -> `DamageApplied`) with RNG-captured d20 + damage dice, advantage / disadvantage, critical hits, full encounter lifecycle (create, roll initiative, start, turn / round, end), item acquisition.
- ✓ **Slice 3.** Level-up flow with RNG-captured HP rolls (roll or average strategy), `PendingChoice` resolution protocol for deferred decisions (ASI vs feat, fighting style, subclass selection, spell selection). Resolved-choice effects feed into derivations.
- ✓ **Slice 4.** `plan.save`, `plan.abilityCheck` (with optional skill), record-only `SaveRolled` / `AbilityCheckRolled` resolution events. Honors caller-supplied advantage or derives it from the effect stack. Skill checks apply half / proficient / expertise multipliers. `computeAbilityCheck` + `computePassiveScore` derivations.
- ✓ **Slice 5.** Spellcasting. `plan.castSpell` handles cantrips and leveled spells; dispatches per-target attack / save / heal mechanics through the existing resolution chains; consumes standard or pact slots (auto-picks pact when both apply); upcasting via `extraDicePerSlotLevel`. `SpellCastDeclared`, `SpellSlotConsumed`, `PactSlotConsumed` events. Long rest restores all slots, short rest restores pact slots only. `computeAvailableSpellSlots` derivation.
- ✓ **Slice 6.** Concentration enforcement. `EffectInstance` table tracks active spell effects with their applied conditions; concentration spells emit `ConcentrationStarted` and set `Character.concentrationEffectId`. `plan.checkConcentration(characterId, damage)` rolls a CON save with DC `max(10, floor(damage/2))`, emits `ConcentrationBroken` on failure which auto-removes every condition the effect installed. Casting a new concentration spell while already concentrating evicts the prior effect.
- ✓ **Slice 7.** OnEvent trigger system. The dispatcher walks every character's effect stack after each triggering event, evaluates the `Predicate` filter against event facts, checks cadence (`oncePer: 'turn' | 'round' | 'shortRest' | 'longRest'`), and fires `AddDamage` actions producing rider events. `TriggerFired` event marks usage; `Character.triggerCounters` tracks per-cadence state. Test pack has a Rogue with Sneak Attack as the canonical OnEvent feature.
- ✓ **Slice 8.** Action economy. `Combatant.turnUsage` tracks per-turn usage; `ActionEconomyConsumed` events enforce "can't double-use the Action" / "Bonus Action" / "Reaction this round". `computeActionEconomyBudget` reads `ModifyActionEconomy` effects (Extra Attack, Action Surge, Bonus Action grants). `planAttack` enforces the attack budget when the attacker is the active combatant in an active encounter.
- ✓ **Slice 9.** Reactions protocol, scoped to opportunity attacks. `resolveAttack` extracted as a shared helper so `planOpportunityAttack` reuses the d20 / damage / OnEvent-trigger pipeline. Emits `ActionEconomyConsumed { kind: 'reaction' }` and bypasses the action / attack-budget checks. Throws on a second reaction same round; refreshes at `RoundEnded`.
- ✓ **Slice 9b.** Reaction-window expansion. Action Surge resets the action consumption flag; off-hand attacks consume the bonus action and suppress ability mod on damage; `FlatDamageReduction` effect primitive (Heavy Armor Master, similar) reduces incoming damage before resistance.
- ✓ **Slice 10.** Movement and positioning. Combatants gain optional `position: { x, y }` in feet and per-turn movement state (`feetMovedThisTurn`, `dashed`, `disengaged`). `planMove` enforces the budget against `Character.speedFeet` (doubled if Dashed) using Chebyshev distance.
- ✓ **Slice 11.** Damage mitigation order of operations. `mitigateDamage` walks the target's effect stack and applies flat reduction, then immunity (zero), then vulnerability (×2), then resistance (½ rounded down) to each damage component.
- ✓ **Slice 12.** Inventory mechanics. `ItemEquipped`, `ItemUnequipped`, `ItemAttuned`, `ItemUnattuned` events with reducers enforcing the 3-slot attunement cap. `computeCarryingCapacity` (STR × 15) and `computeEncumbrance` derivations.
- ✓ **Slice 13.** Creature as a first-class combatant. `Character.kind: 'pc' | 'npc' | 'creature'` discriminator with optional `statblockId` and `multiattack` pattern. `planMultiattack` consumes a single Action and runs `resolveAttack` once per weapon swing in the pattern.
- ✓ **Slice 14.** Environmental hazards. `planFalling` rolls 1d6 per 10ft (capped at 20d6) routed through `mitigateDamage` as bludgeoning. Cover (`half`, `three-quarters`, `total`) adds +2 / +5 AC respectively; total cover refuses the attack.
- ✓ **Slice 15.** Full 2024 conditions library. All 15 conditions (blinded, charmed, deafened, exhaustion, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious) load from content packs and apply their effects to derivations.
- ✓ **Slice 16.** Spellcasting polish. Cantrip damage scaling at character levels 5 / 11 / 17 via `cantripScalingDice`. Ritual casting via the `asRitual` flag (skips slot consumption; rejects non-ritual spells). Spell area targeting metadata (cone / cube / line / sphere / cylinder).

### Phase B: Full state schemas (4 slices, all done)

The campaign-state surface area beyond combatants.

- ✓ **Slice 17.** Parties, shared inventory, currency, treasure ledger. `PartyCreated`, `PartyMembersChanged`, `CurrencyAcquired`, `CurrencySpent`, `ItemDepositedToParty`, `ItemWithdrawnFromParty` events. Currency helpers (`totalInCopper`, `addCurrency`, `subtractCurrency`) refuse to let the purse go negative.
- ✓ **Slice 18.** Sessions, journal entries (player / DM, with party / dm-only / character visibility), in-game clock (minutes from epoch, formatted as `Day NN HH:MM`). Only one session can be active at a time; starting a session syncs the campaign clock and refuses to rewind it.
- ✓ **Slice 19.** Locations and environmental terrain. `Location` (with optional parent and `LocationMap` of cells: normal / difficult / impassable / water), `Door` (open / closed / locked, blocks LOS and movement when shut). New events `LocationCreated`, `DoorAdded`, `DoorStateChanged`, `CharacterLocationChanged`. Derivations `terrainAt`, `movementCostAt`, `chebyshevDistanceFeet`, `isInRangeFeet`, `hasLineOfSight`, `hasLineOfEffect` (Bresenham ray, blocked by impassable cells and closed/locked doors).
- ✓ **Slice 20.** Quests, objectives, rewards, milestone XP. `Quest` (active / completed / failed / abandoned) with required and optional `QuestObjective`s tracking progress against thresholds. New events `QuestStarted`, `ObjectiveProgressed` / `Completed` / `Failed`, `QuestCompleted` / `Failed` / `Abandoned`, `QuestRewardClaimed` (distributes XP per beneficiary and currency to the linked party), `XPAwarded` (direct grant), `MilestoneAwarded` (minor / major / campaign tags appended to the campaign state).

### Phase C: Combat fill-in (10 slices, all done)

High-impact mechanics consumers will immediately want. Each slice closes a gap that's currently missing or partial.

- ✓ **Slice 21.** Grapple, shove, hide actions. `planGrapple` rolls the attacker's unarmed save DC (8 + STR mod + prof) and emits a `SaveRolled` for the target (STR or DEX); failure applies the `grappled` condition. `planShove` does the same with a STR save and applies `prone` or emits a forced `CombatantMoved` (5 ft push). `planHide` rolls a DEX (stealth) check against DC 15 (or caller-provided DC) and applies the `invisible` condition on success. All three consume an Action when the actor is an active combatant; out-of-combat usage is unmetered.
- ✓ **Slice 22.** Counterspell, Dispel Magic, Identify. `planCounterspell` follows the 2024 model: reaction consumed, 3rd-level slot spent, target makes a CON save against the counter-caster's spell save DC; on failed save a `SpellCountered` event records the outcome (callers omit the original spell's resolution events). `planDispelMagic` auto-succeeds on effects whose level is at or below the dispel slot level, otherwise an `AbilityCheckRolled` against DC 10 + spell level; on success `SpellDispelled` removes the effect plus its conditions and clears any concentration link. `planIdentify` emits `ItemIdentified`, appending the character to `ItemInstance.identifiedByCharacterIds`.
- ✓ **Slice 23.** Weapon Mastery effects via `planWeaponMastery({mastery, attackerId, targetId, weaponInstanceId})`. Sap, Vex, and Slow apply marker conditions (`sapped`, `vexed-by`, `slowed-10ft`). Topple emits a CON save against the attacker's unarmed save DC; failure applies `prone`. Push emits a forced 10 ft `CombatantMoved` when positions exist. Graze emits a `DamageApplied` for the attacker's STR modifier in the weapon's damage type. Every activation also emits a `WeaponMasteryActivated` record event for replay narrative. Cleave / Nick / Flex are sequencing concerns that belong to the attack planner and are deferred.
- ✓ **Slice 24.** Mounts, vehicles, mounted combat. Mounts are creatures (kind `creature`) with a rider linked via `Character.mountedOnId`; `Mounted` and `Dismounted` events maintain that back-link. Vehicles are a separate entity (`land` / `water` / `air`) with their own HP, AC, capacity, and occupant roster. New events: `VehicleAcquired`, `VehicleBoarded`, `VehicleDeparted`, `VehicleDamaged`, `VehicleRepaired`; capacity is enforced at boarding time.
- ✓ **Slice 25.** Travel and overland. `TravelLegCompleted` events append to a `travelLog` on the campaign (pace, hours, miles, optional from/to locations, notes). `planNavigationCheck` rolls Wisdom (Survival) against caller DC and emits `NavigationCheckRolled`. `planForage` rolls Wisdom (Survival) and emits `ForagedFor` with food and water pounds gained on success. Forced-march exhaustion is recorded via the existing `ExhaustionChanged` event so callers can stack incremental exhaustion onto the same character without engine-side bookkeeping.
- ✓ **Slice 26.** NPCs with reaction and morale mechanics. Character schema gains optional `attitude`, `morale`, and `moraleBroken` fields. `planReactionRoll` rolls the presenter's CHA (Persuasion) against a DC and bumps the NPC's attitude (hostile / unfriendly / indifferent / friendly / helpful) based on margin. `planMoraleCheck` rolls the NPC's Wisdom against a DC; failed checks decrement morale and emit `MoraleBroken` (flee / surrender) when morale hits zero.
- ✓ **Slice 27.** Downtime, crafting, training. `DowntimeActivityResolved` appends to a `downtimeLog` on the campaign with kind (`crafting` / `training` / `recuperating` / `research` / `work` / `other`), day count, outcome (`success` / `partial` / `failure`), summary, optional produced item definition ID, and optional tool proficiency gained. Tool proficiencies accumulate per character in `toolProficienciesByCharacter`.
- ✓ **Slice 28.** Magic item charges, recharge, sentient items. ItemInstance gains `maxCharges` and `sentient { ego, alignment, personality }` fields. `ItemChargeConsumed` decrements `chargesRemaining` (refuses to over-spend), `ItemRecharged` adds back up to `maxCharges` on one of five cadences (`dawn`, `dusk`, `shortRest`, `longRest`, `manual`), `SentientItemConflict` records the outcome of an item-vs-wielder showdown.
- ✓ **Slice 29.** Resurrection variants. `CharacterResurrected` event with `spell` discriminator (`revivify`, `raise-dead`, `reincarnate`, `resurrection`, `true-resurrection`) restores the target to `hpAfter` HP, clears temp HP, resets death saves, and zeroes exhaustion. Reincarnate may set `newSpeciesId` to swap the character's species. Currency cost is left to the caller via the existing `CurrencySpent` event so consumers can apply table-specific economies.
- ✓ **Slice 30.** Wild Shape, Polymorph, Simulacrum, Wish. `PolymorphApplied` swaps HP, ability scores, speed, and species into a new form and snapshots the originals to `Character.polymorphedSnapshot`; `PolymorphReverted` restores them. `wild-shape`, `polymorph`, and `true-polymorph` share the machinery via a `kind` discriminator. `SimulacrumCreated` clones a character into a creature-kind duplicate at half-HP (transient state reset). `WishGranted` records a freeform wish description; `stressApplied: true` increments the granter's exhaustion. Concrete spell effects beyond the form swap stay in the consumer's hands.

### Phase D: Adoption surface (7 slices, 5 done)

These don't add rules; they make the library usable by people who didn't write it. Higher priority than Phase E for any consumer that isn't this repo's author.

- ✓ **Slice 31.** Starter content pack bundled in the package as `src/content/packs/starter-pack.json` and exported via `loadStarterPack()`. Includes Fighter, Wizard, Rogue, Paladin, and Warlock classes (levels 1-5 for combat-relevant features), Human species, Soldier background, all 15 conditions, ~6 spells, ~10 items, plus the canonical Sneak Attack OnEvent feature. Enough to instantiate a character and run combat without writing any content from scratch; consumers extend it from the 2024 SRD CC-BY release as their needs grow.
- ✓ **Slice 32.** `/examples` directory with three runnable TypeScript apps: a character-sheet printer ([01-character-sheet](examples/01-character-sheet/)), an encounter-and-replay demo ([02-combat-encounter](examples/02-combat-encounter/)), and a save/load round-trip ([03-save-and-load](examples/03-save-and-load/)). Each is a single `npx tsx`-runnable file. An integration test in [tests/integration/examples.test.ts](tests/integration/examples.test.ts) executes them in CI so regressions in the public API surface get caught immediately.
- ✓ **Slice 33.** Getting-started doc at [docs/getting-started.md](docs/getting-started.md) walking through install, engine setup, character creation, attack resolution, and save/load round-trip. API reference at [docs/api-overview.md](docs/api-overview.md) maps every public symbol by namespace (planners, derivations, events, schemas, content packs, RNG, IDs, migrations).
- ✓ **Slice 34.** Public API conveniences. `engine.do(campaign, intent)` dispatches on `intent.type` to the right planner and commits the result in one call (covers every Phase A-C planner). `serializeCampaign(c)` writes a JSON string with id, name, schemaVersion, and events only; state is omitted because `loadCampaign(json)` replays the events to reconstruct it. `createPC({name, speciesId, backgroundId, classId, hpMax, ...})` returns a `Character` with sensible defaults; caller emits the `CharacterCreated` event themselves to add to a campaign.
- ✓ **Slice 35.** Derivation memoization keyed on `CampaignState.version`. Every `engine.derive.*` method now caches its result per-engine; the cache invalidates automatically when `state.version` advances (i.e., on every commit). Repeated calls at the same version return the same object reference, so a UI that asks for derived AC ten times per frame across twelve combatants pays for one computation each.
- **Slice 36.** `npm publish` to the public registry. Until this, every install is via git URL.
- **Slice 37.** Content pack validator with helpful diagnostic errors (path-pointed Zod failures, cross-reference resolution failures with offending IDs).

### Phase E: 2024 content fill-out (9 slices, 0 done)

Heavy on data, light on engine code. Each class slice stress-tests Phases A and C.

- **Slice 38.** Classes group 1: Barbarian, Bard, Cleric, Druid (1-20, all subclasses).
- **Slice 39.** Classes group 2: Fighter, Monk, Paladin, Ranger.
- **Slice 40.** Classes group 3: Rogue, Sorcerer, Warlock, Wizard.
- **Slice 41.** All ~370 spells (primitives where possible, handlers for the exotic ones).
- **Slice 42.** Species, backgrounds, feats, fighting styles, equipment, tools.
- **Slice 43.** Magic items (DMG) and monster statblocks (MM, full or curated subset).
- **Slice 44.** Bastions (2024 stronghold system).
- **Slice 45.** Epic boons (post-20 progression).
- **Slice 46.** Optional variant rules (gritty realism, hero points, sanity, mass combat).

### Phase F: Core extraction (1 slice, optional, future)

- **Slice 47.** Extract `ttrpg-engine-core` as a separate package. The architectural layer (event sourcing, plan/commit, branded IDs, content packs, sessions, journal, party + currency abstraction, predicate + formula DSL, PendingChoice protocol, undo/redo, transcript formatter, RNG-capture proof) is system-agnostic and could be the foundation for other TTRPG engines (Pathfinder, Tales of the Valiant, Gamma World, etc.). `dnd-engine` becomes the 5.5e adapter on top. Only do this if multi-system support becomes a real goal; premature abstraction would slow the D&D work down for a hypothetical second consumer that doesn't exist yet. Estimated 2-4 weeks once `dnd-engine` is mature.

### What "perfect" cannot mean

5.5e explicitly delegates some rulings to the DM: improvised actions, narrative consequences, table houserules, ambiguous spell interactions that even Sage Advice has issued multiple clarifications on. A rules engine cannot adjudicate these. The `CustomEffect` code-handler escape hatch is the explicit spot for table-specific rulings. After all phases the engine covers ~95% of printed mechanics by surface area; the rest is documented as DM-discretion territory.

## Install

Not yet published to npm. While pre-alpha, install via git URL or a sibling directory:

```jsonc
// in your consumer's package.json
"dependencies": {
  "dnd-engine": "github:greghcarr/dnd-engine"
  // or, when developing alongside the engine:
  // "dnd-engine": "file:../dnd-engine"
}
```

`npm publish` is tracked as Slice 36 in the roadmap.

## Usage (preview)

```ts
import {
  createEngine,
  loadContentPack,
  seededRNG,
} from 'dnd-engine';
import myContent from './my-content-pack.json';

const engine = createEngine({
  contentPacks: [loadContentPack(myContent)],
  rng: seededRNG(42),
});

let campaign = engine.createCampaign({ name: 'home game' });
// commit CharacterCreated + ItemAcquired events, then:

// melee attack
campaign = engine.commit(campaign, engine.plan.attack(campaign.state, {
  attackerId: alyx.id,
  targetId: goblin.id,
  weaponInstanceId: longsword.id,
}).events);

// cast a spell
campaign = engine.commit(campaign, engine.plan.castSpell(campaign.state, {
  characterId: wizard.id,
  spellId: 'fireball',
  slotLevel: 3,
  targetIds: [goblin1.id, goblin2.id, goblin3.id],
}).events);

// level up with a rolled HP gain
campaign = engine.commit(campaign, engine.plan.levelUp(campaign.state, {
  characterId: alyx.id,
  classId: 'fighter',
  hpStrategy: 'roll',
}).events);

// derive a character sheet (effective AC, saves, spell slots, etc.)
const sheet = engine.derive.character(campaign.state, alyx.id);
// sheet.ac, sheet.savingThrows, sheet.spellSlots, etc.
```

For a step-by-step walkthrough, see [docs/getting-started.md](docs/getting-started.md). For the full surface, see [docs/api-overview.md](docs/api-overview.md). See [DEVELOPMENT.md](DEVELOPMENT.md) for the dev workflow and [CLAUDE.md](CLAUDE.md) for architecture conventions.

## Intellectual property

This library is original work. It contains zero text, statblocks, or content from the Wizards of the Coast D&D 5.5e rulebooks. The schemas describe the *shape* of D&D content (a spell has a level, a school, a list of mechanical effects) but no copyrighted content.

D&D content is published by Wizards of the Coast. The 2024 SRD (System Reference Document) is released under Creative Commons CC BY 4.0; portions of older 5e content are available under the OGL 1.0a. If you build a content pack to load into this engine, your pack is subject to those licenses, not this library's license. This library does not ship, distribute, or endorse any specific content pack.

Dungeons & Dragons is a trademark of Wizards of the Coast LLC. This project is not affiliated with or endorsed by Wizards of the Coast.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The architecture is locked (see [CLAUDE.md](CLAUDE.md)); contributions that fit within it are very welcome. Open an issue before a large change.

## License

[MIT](LICENSE). Copyright (c) 2026 Greg Carr.
