# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The bump policy and pre-release roadmap are documented in [VERSIONING.md](VERSIONING.md).

## Unreleased

### Added

- `NOTICE` file with full CC BY 4.0 attribution for SRD 5.2-derived starter-pack content. Shipped in the npm tarball alongside `LICENSE`.
- `docs/content-attribution.md`: item-by-item audit of the starter content pack against SRD 5.2, flagging confidently-covered material, likely-covered items worth verifying for commercial use, and not-confirmed items (Bastions, Epic Boons).
- `ContentPack` schema extended with optional `license`, `attribution`, and `derivedFrom` metadata fields. The starter pack carries `license: "CC-BY-4.0"` and a full attribution string.

### Changed

- `LICENSE` restructured to explain dual licensing: engine code MIT, starter content pack CC BY 4.0.
- README "Intellectual property" section rewritten to point at the new attribution surface; Documentation table gains a row.

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
