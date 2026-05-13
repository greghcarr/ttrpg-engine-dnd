# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The bump policy and pre-release roadmap are documented in [VERSIONING.md](VERSIONING.md).

## Unreleased

Engine-gap punch-list cleanup: of the 16 items the punch-list opened with, only two ⚪ items remain (sanity and mass-combat variant rules, each its own slice). Closed 14 items across this development cycle — all 4 🔴, all 7 🟡, and 3 of the 5 ⚪. Test count grew from 563 to 626 (63 new tests across 16 new files); all replay-equivalence and RNG-capture invariants still hold.

### Added

- **`hp-pool-knockout` spell mechanic** — new `SpellMechanic` kind for Sleep-style spells. Rolls a dice pool (`poolDice`, optional `extraPoolDicePerSlotLevel`), walks targets in ascending current-HP order, and applies the configured condition until the pool runs out. Targets already carrying the condition are skipped. Sleep is now fully wired (5d8 base, +2d8 per slot above 1st, applies `unconscious`).
- **`engine.plan.shield`** — reactive +5 AC planner. Takes the triggering attack's d20 total and the original AC; emits `ActionEconomyConsumed(reaction)`, `SpellSlotConsumed`, `ConditionApplied('shielded')`, and a new `ShieldCast` event with `preventedHit: boolean`. The new `shielded` condition grants +5 AC via `AddModifier`. Magic Missile damage immunity is not yet modeled (would need per-spell immunity primitive).
- **`engine.plan.mistyStep`** — dedicated bonus-action teleport planner. Validates spell knowledge, slot, bonus-action availability, and 30-ft Chebyshev range; emits `SpellCastDeclared`, `SpellSlotConsumed(2+)`, `ActionEconomyConsumed(bonusAction)`, and `CombatantMoved(feetTraveled: 0)`.
- **`engine.plan.expireSpellDurations`** — emits `ConcentrationBroken(reason='durationEnded')` events for every active effect whose listed duration has elapsed by the current in-game clock. New `parseSpellDurationMinutes` parses common 2024 duration phrasings. `EffectInstance` gains `durationMinutes` / `startedAtMinutes`; `ConcentrationStarted` carries `durationMinutes` which the reducer pairs with the in-game clock.
- **`DerivedCharacter.hpMaxBonus` / `effectiveHpMax`** — character-view derivation now surfaces the sum of `AddModifier{target:'hpMax'}` effects. Aid adds a new `aid-buffed` condition that grants +5 hpMax. Reducer-side massive-damage threshold still compares against the stored `hp.max` (full enforcement is a larger refactor).
- **`engine.plan.consumeGuidance`** — rolls the Guidance d4 for the target, removes the `guided` condition, and ends the caster's concentration (`reason='used'`). Pairs with a new `GuidanceUsed` event and a new `'guided'` condition (no static effects; the d4 is rolled at consume time so the player can choose when to apply it).
- **`engine.plan.cleave`** — companion to a successful melee hit with a Cleave-mastery weapon. Rolls a follow-up attack against a second target, strips the attacker's positive ability modifier from damage per RAW, and marks `mastery:cleave` as fired this turn (re-invocation in the same turn throws).
- **Nick mastery in `engine.plan.offHandAttack`** — when the off-hand weapon has Nick, the planner emits `TriggerFired('mastery:nick')` instead of `ActionEconomyConsumed('bonusAction')` once per turn.
- **Flex mastery in `engine.plan.attack`** — versatile weapons with Flex mastery wielded two-handed (off-hand empty) roll the larger `versatileDice` at attack time.
- **`engine.plan.tickAura`** + `aura-damage` `SpellMechanic` — concentration auras like Spirit Guardians register at cast time (only `ConcentrationStarted` fires) and the consumer calls `tickAura({ casterId, targetIds })` per turn for the affected creatures. Each tick rolls a save and applies damage independently per target.
- **`engine.plan.polymorph`** — full RAW validation: caster knowledge, 4th+ slot, target's level caps the form CR, optional WIS save for unwilling targets (the slot is still spent on a successful save), breaks the caster's prior concentration before starting the new one. Returns `{ events, resisted }`.
- **`engine.plan.wildShape`** — druid bonus-action transform. Validates druid level ≥ 2, available `wild-shape` resource pool, form CR cap by level (1/4 / 1/2 / 1 at L2 / L4 / L8), and flying-speed gating until L8. Emits `ActionEconomyConsumed('bonusAction')` (when in an encounter), `ResourceSpent('wild-shape', 1)`, and `PolymorphApplied(kind='wild-shape')`.
- **Events / enums**: `ShieldCastEvent`, `GuidanceUsedEvent`, new `ConcentrationBrokenReason` values `'unconscious'` and `'used'`, new `SpellMechanic` kinds `aura-damage` and `hp-pool-knockout`, new `EffectInstance` fields `slotLevel` / `durationMinutes` / `startedAtMinutes`, new `ConcentrationStartedEvent.slotLevel` (so planners that need the upcast level at tick time can read it off the instance).
- **`engine.plan.forcedMarch`** — RAW 2024 ch.4 forced-march CON-save loop. For each hour past 8, every traveler makes a Constitution save at climbing DC (10 + 1 per hour past 8); failures gain a level of exhaustion. Travelers already at exhaustion max are skipped.
- **`engine.plan.simulacrum`** — RAW 2024 7th-level illusion. Validates caster knowledge, slot, materials (1500 gp ruby dust via `materialsConsumed` flag), and the "one Simulacrum per source creature" constraint. Returns `{ events, simulacrumId }` so consumers can wire UI to the new creature pre-commit.
- **`engine.plan.wish`** — RAW 2024 9th-level conjuration. Eight predefined effects bypass the stress cascade; anything else rolls a d100 and applies exhaustion on a result of 33 or lower. Returns `{ events, stressApplied }`.
- **`hp.maxBonus`** field on Character + `Character.appliedConditions[].hpMaxBonusDelta` stamping. The damage reducer's massive-damage threshold now compares against `hp.max + hp.maxBonus`, so an Aid-buffed character (effective max 17 instead of 12) doesn't die instantly to a 12-damage hit when at -4 HP. The buff planner sets the delta on `ConditionAppliedEvent.hpMaxBonusDelta`; the reducer copies it into the applied-condition entry and bumps `hp.maxBonus`. Removal (ConditionRemoved, ConcentrationBroken, LongRestStarted concentration-clearing) reads the stored delta and reverses it.
- **`grittyRest` flag wired**: rest events carry `expectedDurationMinutes` (60/480 standard, 480/10080 gritty). The planner reads `state.settings.grittyRest` and stamps the right value.
- **`heroPoints` flag wired**: `Character.heroPoints` field, `HeroPointGranted` / `HeroPointSpent` events, `engine.plan.grantInitialHeroPoints` (5 + level − 1 per PC), `engine.plan.spendHeroPoint` (rolls a d6 the consumer adds to the augmented roll, decrements the pool).

### Fixed

- **Concentration ends on drop to 0 HP** (RAW 2024 PHB ch.7). All five damage-emitting planners (attack, falling, weapon-mastery, off-hand attack, cast-spell) now emit `ConcentrationBroken(reason='unconscious')` when damage drops a concentrating target to 0 HP. Magic Missile tracks per-target simulated HP so only the dart that actually drops the target emits the break.
- **Death save auto-roll at start of turn** (RAW 2024 PHB ch.1). `planAdvanceTurn` and `planBeginFirstTurn` emit `DeathSaveRolled` for any combatant whose turn starts while they're at 0 HP and not stable / not already at 3 failures. The reducer invariant for `DeathSaveRolled` was relaxed from `=== 0` to `<= 0` (the engine tracks overflow internally; rules-side anything ≤ 0 is "at 0 HP").

### Documentation

- **README "Known gaps"** updated as each gap closed — engine count 16 → 5, spell-coverage row updated, partial-status bullets reworded, Slice 41 roadmap entry rewritten.
- **docs/authoring-content-packs.md** SpellMechanic table now lists eight kinds (adds `hp-pool-knockout` and `aura-damage`).
- **docs/api-overview.md** planner lists updated with `mistyStep`, `shield`, `expireSpellDurations`, `consumeGuidance`, `cleave`, `tickAura`, `polymorph`, `wildShape`.

## 0.1.0-alpha.2 (2026-05-13)

Alpha refinement. A multi-round D&D-correctness audit surfaced a long list of bugs across the engine, the starter pack content, and the showcase; this release closes them. The README's status and roadmap sections are also rewritten to mark partial slices honestly instead of claiming uniform completeness.

### Added

- **Spell mechanic kinds**: `auto-hit` (Magic Missile-style spells with N darts, no save / no attack roll), `buff` (Bless / Mage Armor / Faerie Fire-style condition application with no save), `remove-condition` (Lesser Restoration-style targeted condition stripping).
- **Effect kind `GrantAdvantageToAttackers`** — when present on a character's effect stack, attacks against them have advantage. Used by Faerie Fire's condition and the Restrained status; the attack planner now consults the *target's* effect stack rather than only the attacker's.
- **`engine.plan.resurrect`** — new planner with proper validation: caster must know or prepare the spell, must have a slot of sufficient level, target must be at 0 HP. Supports `via: 'spell-slot' | 'scroll' | 'special'` so scroll consumption and special revivals can skip caster validation. Replaces consumer-side hand-emitted `CharacterResurrected` events.
- **`SaveRolled` / `AbilityCheckRolled` breakdown** — both events gain an optional `breakdown: Array<{source, value}>` field. The transcript formatter shows the breakdown when the flat bonus has two or more contributing sources, so a +0 save reads as "+2 CON-mod, -2 exhaustion" rather than an apparently missing modifier.
- **`Character.armorClass`** — optional natural-armor AC override. When set, `computeAC` uses it directly (effect modifiers still stack); used by creature statblocks and polymorph forms. Polymorph reducers copy `form.ac` into this field and the snapshot preserves the prior value for revert.
- **Heal mechanic `flatAmount`** — fixed-value heal supplement for spells like Aid (+5 per target).
- **`tests/unit/rules-truth.test.ts`** — ~58 short PHB 2024 assertions covering ability modifiers, proficiency bonus, single-class spell slots, AC under several armor scenarios, attack and save derivations, spell save DC and attack bonus, Sneak Attack dice at every odd Rogue level, and Blessed-condition propagation. Writing this surfaced the half/third caster slot bug.
- **`tests/unit/engine/spell-coverage.test.ts`** — per-shipped-spell smoke test. Each spell either has an explicit event-kind expectation or a `skip` with reason. Catches Magic-Missile-class bugs where a spell ships with no mechanical effect at all.
- **`Character.armorClass` + `CharacterResurrectedEvent.via`** event-shape fields propagated through schemas and reducers.

### Fixed

- **Fireball-class AoE damage rolled once** (PHB 2024 "Areas of Effect"). Previously `planSaveMechanic` rolled damage inside the per-target loop, so each target got an independent roll; now the dice roll once for the whole effect and each target's save determines full vs half.
- **Half / third-caster spell slots use round-up (RAW 2024)**. The previous engine used `floor(level/2)` (the 2014 multiclass rule); 2024 changed it to round-up and gave half-casters slots starting at level 1. Paladin 5 now correctly returns 4 first + 2 second slots (was 3 / 0). Eldritch Knight 4 returns 3 first-level slots (was 2).
- **Sneak Attack scales per Rogue level**. Starter pack previously shipped only the L1 entry (1d6); the class table now declares the feature at every odd level (1d6 -> 10d6 at L19), and the effect-stack dedupes class features by id so only the highest-level instance fires.
- **Creature natural-armor AC** honored via `Character.armorClass`. Ogre 11, Young Red Dragon 18, Goblin Scout 15, etc. Previously every creature defaulted to 10 + DEX.
- **Polymorph AC applies** in combat. Previously a polymorphed character kept their original AC; the form's AC is now copied onto the character.
- **Counterspell consumes the original caster's slot** (RAW 2024: the slot is still spent on a successful counter). `CounterspellIntent.originalSpellLevel` is now required.
- **Long rest ends concentration**. Sleep -> unconscious -> concentration breaks per RAW. The reducer also lifts conditions the broken effect had applied on other targets.
- **Many inert starter-pack spells now wired**: Magic Missile (5 darts at 3rd level), Bless (+2 to attack and all six saves via the new `blessed` condition), Bane (-2 via `baned`), Mage Armor (AC override via `mage-armored`), Faerie Fire (DEX save -> `faerie-fired` -> attackers get advantage), Aid (+5 HP flat heal per target), Web (DEX save -> `restrained`), Lesser Restoration (removes one of: blinded / deafened / paralyzed / poisoned), Polymorph (now in the content pack so slot consumption reads).
- **Dragon weapon dice**. The showcase dragon used a longsword stand-in for both bite and claws (1d8 slashing). Added `dragon-bite` (2d10 piercing) and `dragon-claw` (2d6 slashing) creature-statblock items.
- **Ogre weapon dice**. The "greatclub" in the showcase was secretly a greatsword (2d6 slashing). Added a proper PC `greatclub` (1d8 bludgeoning) and a creature `ogre-greatclub` (2d8 bludgeoning).
- **Restrained condition** gains `GrantAdvantageToAttackers` (the RAW status was missing the "attackers have advantage" leg).
- **Transcript formatter improvements**: damage events show source attribution; sized markdown headings with blank-line paragraph breaks so the rendered preview shows one action per line; creatures and NPCs no longer render as "fighter 1"; spell slots use ordinal labels; polymorph displays the caster.

### Documentation

- **README Status section** rewritten with a three-bucket split (fully wired / partially wired / known engine gaps), an honest 563-tests / 90-files count, and explicit notes on what alpha consumers can rely on versus author.
- **README Roadmap** uses a new ✓/◐/blank legend; every ◐ entry names what's missing. Phase C is "7 fully wired + 3 partial", Phase D is "6 + 1", Phase E is "2 + 7" with class L2+ features, subclasses, the full spell catalog, the DMG / MM catalogs, and variant-rule enforcement all flagged as content-layer gaps.
- **docs/getting-started.md** content-pack description updated to match the recalibrated story; points at the README Status section.

### Internal

- Stale `dnd-engine` references cleaned out of DEVELOPMENT.md, README.md, CLAUDE.md, and the bug-report issue template (the historical CHANGELOG note remains).

## 0.1.0-alpha.1 (2026-05-12)

Patch release. Documentation and attribution only; no API changes.

### Added

- `NOTICE` file with full CC BY 4.0 attribution for SRD 5.2-derived starter-pack content. Shipped in the npm tarball alongside `LICENSE`.
- `docs/content-attribution.md`: item-by-item audit of the starter content pack against SRD 5.2, flagging confidently-covered material, likely-covered items worth verifying for commercial use, and not-confirmed items (Bastions, Epic Boons).
- `ContentPack` schema extended with optional `license`, `attribution`, and `derivedFrom` metadata fields. The starter pack carries `license: "CC-BY-4.0"` and a full attribution string.
- npm package now also ships under name `ttrpg-engine-dnd` (renamed from `dnd-engine` because the original name was an unpublished squat on npm). GitHub repo renamed to match.

### Changed

- `LICENSE` restructured to explain dual licensing: engine code MIT, starter content pack CC BY 4.0.
- README "Intellectual property" section rewritten to point at the new attribution surface; Documentation table gains a row for IP / attribution.

## 0.1.0-alpha.0 (2026-05-12)

First alpha. All six phases of the roadmap are complete except the optional `ttrpg-engine-core` extraction. Forty-six slices shipped across engine mechanics, state schemas, combat fill-in, adoption surface, and 2024 content.

### Engine architecture (Phase A, Slices 1-16)

- Event-sourced state machine. `apply(state, event) -> state` is pure; `replay(events)` reconstructs state byte-for-byte.
- Plan/commit split: all RNG is consumed inside `engine.plan.*` planners; resolution events carry baked rolls. `apply()` never touches RNG. Tested via `ThrowOnCallRNG` on every golden scenario.
- Branded IDs (`CharacterId`, `EncounterId`, etc.) backed by ULIDs. Normalized state. Immer internally, immutable externally.
- Twenty-five effect primitives plus a `CustomEffect` code-handler hook.
- `PendingChoice` protocol for deferred player decisions.
- Combat resolution chain (`AttackDeclared` -> `AttackRolled` -> `DamageRolled` -> `DamageApplied`), full encounter lifecycle, level-up flow with HP rolls, ability checks and saves, spellcasting with cantrip scaling and ritual casting and area shapes, concentration enforcement, OnEvent triggers (Sneak Attack), action economy (Action Surge, Extra Attack, Bonus Action), reactions (opportunity attacks, off-hand strikes, flat damage reduction), movement and positioning, damage mitigation order of operations, inventory equip/attune with 3-slot cap, creature as combatant with multiattack, environmental hazards (falling, cover), all 15 2024 conditions.

### State schemas (Phase B, Slices 17-20)

- Parties + shared inventory + currency + treasure ledger.
- Sessions + journal entries (player / DM / character visibility) + in-game clock formatted as `Day NN HH:MM`.
- Locations + maps (normal / difficult / impassable / water cells) + doors (open / closed / locked) + Bresenham line-of-sight and line-of-effect.
- Quests + objectives + rewards + milestone XP.

### Combat fill-in (Phase C, Slices 21-30)

- Grapple, shove, hide (2024 unarmed save-DC model).
- Counterspell, Dispel Magic, Identify.
- Weapon Mastery effects: Sap, Vex, Slow, Topple, Push, Graze.
- Mounts and vehicles (land / water / air, with HP, AC, capacity, occupants).
- Travel + forage + navigation + forced-march exhaustion.
- NPCs as first-class with attitude (hostile / unfriendly / indifferent / friendly / helpful) and morale.
- Downtime + crafting + training + tool proficiency tracking.
- Magic item charges + recharge cadence + sentient items.
- Resurrection variants: Revivify, Raise Dead, Reincarnate, Resurrection, True Resurrection.
- Wild Shape, Polymorph, Simulacrum, Wish.

### Adoption surface (Phase D, Slices 31-37)

- Starter content pack bundled with the package. `loadStarterPack()` returns a fully-populated `ContentPack`.
- `examples/` directory with three runnable apps: character-sheet printer, encounter + replay demo, save/load round-trip. CI executes them to catch public-API regressions.
- Getting-started doc and API reference under `docs/`.
- Public API conveniences: `engine.do(campaign, intent)`, `serializeCampaign(c)` / `loadCampaign(json)`, `createPC({...})`.
- Per-engine derivation memoization keyed on `CampaignState.version`. Repeated `engine.derive.*` calls return the same object reference until the next commit.
- npm publish prep. Package ships ESM + CJS + `.d.ts`. `prepublishOnly` runs the full CI gate. `publishConfig: public`.
- Content pack validator with path-pointed Zod failures and Levenshtein "Did you mean X?" suggestions on cross-reference errors.

### 2024 content (Phase E, Slices 38-46)

- All 12 PHB classes in the starter pack with 1-20 level tables and signature features at landmark levels.
- ~31 spells across cantrip + level 1-3 tiers covering the common archetypes.
- 7 species, 8 backgrounds, 22 feats (origin + general + all six fighting styles), 25+ items including armor variety, 5 tools, 7 adventuring-gear items.
- 9 magic items across all rarity tiers (common Bag of Holding through legendary Deck of Many Things) including a charged Wand of Magic Missiles.
- 6 monster statblocks (Goblin, Orc, Wolf, Skeleton, Ogre, Young Red Dragon).
- 2024 Bastion stronghold system: facilities, hirelings, turn orders, damage and level-up.
- 9 epic boons under the `epic-boon` feat category.
- Variant rule toggles on `CampaignState.settings`: gritty rest, hero points, sanity, mass combat, custom houserules.

### Testing

- 475 tests across 87 files. Replay-equivalence and RNG-capture invariants asserted on every golden scenario. 80% line coverage gate on `src/engine/`, `src/derive/`, `src/effects/`.
- Showcase scenario "The Stoneheart Saga" exercises 46 distinct mechanical surfaces in one coherent campaign narrative.

### Not yet done

- Phase F: optional `ttrpg-engine-core` extraction for multi-system support.
- Subclass mechanics for individual classes (the level tables ship; specific subclass features are consumer territory).
- The full ~370 spell catalog (representative sample ships; bulk content is for consumers to fill out from the 2024 SRD).
- Specific scenario content (specific NPCs, adventures, named magic items beyond the starter set).
