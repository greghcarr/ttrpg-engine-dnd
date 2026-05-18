# ttrpg-engine-dnd

[![CI](https://github.com/greghcarr/ttrpg-engine-dnd/actions/workflows/ci.yml/badge.svg)](https://github.com/greghcarr/ttrpg-engine-dnd/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)
[![Status](https://img.shields.io/badge/status-alpha-yellow)](README.md#status)

A standalone, event-sourced TypeScript domain engine for Dungeons & Dragons 5.5e (the 2024 rules update). Schema-only. Bring your own content pack (a starter SRD-shaped pack ships in the box).

The package is named `ttrpg-engine-dnd` because the long-term plan extracts the system-agnostic core (event sourcing, plan/commit, branded IDs, content packs, sessions, party, predicate / formula DSL) into a future `ttrpg-engine-core` package, with `ttrpg-engine-dnd` becoming the 5.5e adapter. See [VERSIONING.md](VERSIONING.md) and the Phase F slice in the roadmap below.

If you are building a D&D character sheet, encounter tracker, virtual tabletop, automation tool, or AI dungeon master and you do not want to reimplement the rules engine from scratch, this is for you.

## Try it in your browser

A live demo of the engine — combat sandbox + event inspector + import/export with replay verification — runs on GitHub Pages: **https://greghcarr.github.io/ttrpg-engine-dnd/** (deployed via `.github/workflows/deploy-demo.yml`; one-time setup is Settings → Pages → Source = "GitHub Actions"). Source lives under [web/](web/). See [web/README.md](web/README.md) for local development.

## Quick start

The engine is not currently published to a package registry. Clone the repo and work against source:

```sh
git clone https://github.com/greghcarr/ttrpg-engine-dnd.git
cd ttrpg-engine-dnd
npm install
npm test
```

Then import from `src/` (or a local path alias) the same shapes the planned public API surfaced:

```ts
import {
  createEngine, loadStarterPack, createPC, commit,
  seededRNG, newEventId,
} from './src/index.js';

const engine = createEngine({ contentPacks: [loadStarterPack()], rng: seededRNG(42) });
const alyx = createPC({
  name: 'Alyx', speciesId: 'human', backgroundId: 'soldier',
  classId: 'fighter', level: 3, hpMax: 26,
  abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
});

let campaign = engine.createCampaign({ name: 'demo' });
campaign = commit(campaign, [
  { id: newEventId(), at: new Date().toISOString(), type: 'CharacterCreated', snapshot: alyx },
]);

const sheet = engine.derive.character(campaign.state, alyx.id);
console.log(`${alyx.name}: AC ${sheet.ac.total}, HP ${sheet.hp.current}/${sheet.hp.max}`);
```

## Documentation

Pick the doc that matches what you want:

| You want to... | Read this |
|---|---|
| Try the smallest possible working example | [examples/00-quickstart](examples/00-quickstart/) |
| Walk through your first character, attack, and save/load | [docs/getting-started.md](docs/getting-started.md) |
| Understand the mental model (events, plan/commit, content packs) | [docs/concepts.md](docs/concepts.md) |
| Look up a specific public symbol | [docs/api-overview.md](docs/api-overview.md) |
| See common patterns (save, undo, houserules, multiplayer sync) | [docs/recipes.md](docs/recipes.md) |
| Author content packs (spells, classes, feats, items, monsters) | [docs/authoring-content-packs.md](docs/authoring-content-packs.md) |
| Try the web demo in your browser | [https://greghcarr.github.io/ttrpg-engine-dnd/](https://greghcarr.github.io/ttrpg-engine-dnd/) |
| Hack on the web demo locally | [web/README.md](web/README.md) |
| Read the demo's architecture decisions | [docs/web-demo-plan.md](docs/web-demo-plan.md) |
| Understand what's missing before the engine is trustworthy for unsupervised play | [docs/trustworthiness-roadmap.md](docs/trustworthiness-roadmap.md) |
| Watch a full multi-act campaign run | [the showcase transcript](tests/golden/transcripts/showcase.transcript.md) |
| Know what each version means (alpha / beta / rc / 1.0) | [VERSIONING.md](VERSIONING.md) |
| Read the change history | [CHANGELOG.md](CHANGELOG.md) |
| Understand the IP / attribution situation | [NOTICE](NOTICE) and [docs/content-attribution.md](docs/content-attribution.md) |

## Why this engine

- **Built for accuracy first.** Full mechanical coverage of the 2024 Player's Handbook, Dungeon Master's Guide, and Monster Manual is the explicit goal. Every printed class, subclass, species, background, feat, spell, weapon, armor, magic item, condition, and monster statblock can be expressed.
- **No content, no IP problems.** The library ships schemas and an engine. It does not ship any rulebook text or statblocks. You bring your own content packs (built from the SRD 5.2 or your own homebrew), and the engine validates and runs them.
- **Event-sourced, fully deterministic replay.** Every state change is an event. A captured event log replays to byte-identical state across machines. Undo and redo are free.
- **Plan/commit split.** All randomness is consumed inside `engine.plan(intent)` and baked into resolution events. `apply()` is pure and replay never re-rolls dice. This is the architectural foundation that makes multiplayer sync, save files, and audit logs work correctly.
- **Effect-primitive vocabulary plus escape hatch.** About 25 declarative primitives express the bulk of 5.5e features as pure data; a `CustomEffect` code-handler hook covers genuinely-procedural exotica (Wild Shape, Wish, Simulacrum) and table-specific houserules.
- **Solid foundations.** TypeScript strict mode. Zod validation at boundaries. Immer-backed reducers, immutable externally. ESM and CJS builds. Zero peer-dependency conflicts.
- **Living transcripts.** Every golden test emits a human-readable markdown transcript of its event log (one action per paragraph; open in VS Code and run "Open Preview" to read it as rich text), checked into [tests/golden/transcripts/](tests/golden/transcripts/). Every PR that changes engine behavior shows the transcript diff alongside the code. See [the showcase transcript](tests/golden/transcripts/showcase.transcript.md) for "The Stoneheart Saga": a multi-act campaign that exercises sessions and journals, party currency and bastion management, locations + doors + terrain, NPC reaction rolls, mounts and a supply wagon, travel and forage, two combat encounters (goblin scouts then a young red dragon) covering attack chains with advantage and counterspell and weapon mastery and concentration breakage, action surge, off-hand strikes, sneak attack, opportunity attacks, falling, polymorph (Alyx into a giant ape), multiattack creatures, fire-mitigation, death save plus revivify, quest objectives plus milestone plus XP plus reward claim, magic-item charges plus dawn recharge, downtime training plus crafting, and replay-equivalence plus RNG-capture invariants over the whole 339-line transcript.

## Architecture

- **Event-sourced.** State changes are events. `apply(state, event) -> state` is pure. Replay any campaign from its event log.
- **Plan/commit split.** RNG is consumed only inside `engine.plan(intent)`. Resolution events carry baked rolls, so `apply()` is deterministic. Replay never re-rolls.
- **Effect-primitive vocabulary.** Features (class features, feats, magic item powers, conditions) are described via a fixed vocabulary of 43 effect primitives. Wild Shape, Polymorph, Wish, Simulacrum and a handful of others drop to code handlers.
- **Schema-only.** The library ships shapes (`Character`, `Spell`, `MagicItem`, `MonsterStatblock`, etc.) and the engine that operates on them. Consumers load rules content from their own JSON content packs. This keeps the IP story clean.
- **Branded IDs + ULIDs.** `CharacterId`, `SpellId`, `ItemDefinitionId` versus `ItemInstanceId`, etc. Backed by ULIDs (lexicographically sortable by time).
- **PendingChoice protocol.** Deferred player decisions (ASI vs feat, fighting style selection, spell target selection) are first-class events in the log.
- **Zod for validation, Immer for clean reducers, Vitest for tests.**

## Status

**Alpha.** Architecturally complete and content-substantial. 1508 tests across 214 files; the engine compiles and builds (ESM + CJS + `.d.ts`); the load-bearing invariants (event-sourcing, plan/commit, RNG capture, replay equivalence, branded IDs, effect primitives) are locked and proven. The 48-probe RAW-compliance audit at [tests/audit/raw-compliance.test.ts](tests/audit/raw-compliance.test.ts) passes in full. Slice 195's [SRD drift audit harness](tests/audit/srd-drift.test.ts) catches regressions against the SRD 5.2.1 markdown clone on 15 script-detectable fields across spells, monsters, and magic items.

### Coverage at a glance

Engine and pack content tracked separately: the architecture is locked; what grows each slice is the effect-primitive vocabulary plus the content that exercises it. Engine *mechanics* are well past the halfway mark; *content* is dominated by the long tail of DMG magic items and the MM bestiary, both consumer-fillable. Row indicator: 🟩 fully shipped, 🟨 ≥ 50%, 🟧 20–49%, 🟥 below 20%. The first row is the weighted aggregate against SRD 5.2 (the licensable maximum for shipped content), not full PHB / DMG / MM.

| Category | Progress | Notes |
|---|---|---|
| **Full (achievable) SRD-compliance** | `████████████████░░░░` 🟨 ~80% | Weighted across the rows below: engine + primitives heavy weight (currently high), content rows lower. SRD 5.2.1's narrower content scope (vs full PHB / DMG / MM) is what makes the number reachable; the long content tail (DMG items, MM bestiary) is the floor on how fast this moves. Slices 141-149 standardized monsters (initial 111 entries); slices 150-153 audited items / spells / classes / character-creation; slices 177-196 swept ~310 drift fixes across every script-detectable field. Slice 195 codified the audit logic as a checked-in vitest harness. Monster lane batches 4.1-4.14 added 63 monsters (118 to 181); item lane batches 4.1-4.16 added 113 SRD adventuring-gear / tools / consumables (217 to 330 items); **monsters batch 5 (slices 199-203 timeline) added 71 statblocks to close SRD 5.2.1 at 234 / 235 (252 total in pack)**; **subclasses batch 1 added 8 wired + partial-wired subclass features across Champion, Circle of the Land, Draconic Sorcery, Fiend Patron, and Oath of Devotion**. |
| Engine architecture | `████████████████████` 🟩 100% | event-sourcing, plan/commit, RNG capture, replay equivalence, branded IDs, dispatcher: all locked |
| Effect-primitive vocabulary | `█████████████░░░░░░░` 🟨 ~65% | 44 primitives wired (current `EFFECT_KINDS` in [src/schemas/effects.ts](src/schemas/effects.ts)); per-modifier predicate gates now honored (slices 115/116/117). Slices 199-202 added four marker primitives for Rogue Elusive, Rogue Uncanny Dodge, Sorcerer Sorcery Incarnate (alt-cost arm), and Monk Self-Restoration, each paired with a dedicated planner; slice 203 fixed a save-derivation bug that had silently inerted `GrantProficiency target=save` effects (Slippery Mind, Disciplined Survivor); slice 204 threaded `modifierSum('damage', {event.damageType})` into cast-spell's attack + save mechanic paths, closing Draconic Sorcery's Elemental Affinity CHA-mod rider; **slice 205 added `GrantMaxHealingDice` and wired Life Domain L17 Supreme Healing (deterministic max-roll on every healing die in cast-spell)**. 15–25 still on the menu in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) |
| Classes (1 to 20 tables) | `████████████████████` 🟩 100% | 12/12 SRD 5.2.1-derived (slice 153 audit); features fully wired through L7, partial L8 to L20. ~13 level-placement drift items and ~17 SRD-listed L8+ features missing, tracked in [docs/srd-5.2.1-audit-classes.md](docs/srd-5.2.1-audit-classes.md) |
| Subclasses | `███████░░░░░░░░░░░░░` 🟧 ~33% | 12/12 SRD 5.2.1 subclasses (one per class); each ships L3 features. Subclasses batch 1 added 8 wired or partially-wired features beyond L3 (Champion L7 + L15, Circle of the Land L6 + L10, Draconic Sorcery L6, Fiend Patron L6 + L10, Oath of Devotion L7). 13 outstanding entries with deferred-with-reason annotations in [docs/srd-5.2.1-audit-classes.md](docs/srd-5.2.1-audit-classes.md); the engine-primitive queue for the rest is enumerated in the CHANGELOG. |
| Species | `███████████████░░░░░` 🟨 78% | 7/9 SRD 5.2.1 (Goliath + Orc are SRD-listed, not yet in pack). All 7 in pack are SRD-derived. |
| Backgrounds | `████████████████████` 🟩 100% SRD coverage + 15 PHB 2024 extras | 4/4 SRD 5.2.1 backgrounds (Acolyte, Criminal, Sage, Soldier) + 15 PHB 2024-only entries kept by policy for character creation breadth (audit at [docs/srd-5.2.1-audit-character-creation.md](docs/srd-5.2.1-audit-character-creation.md)) |
| Feats | `████████████████░░░░` 🟨 84% SRD coverage + 17 PHB 2024 extras | 14/17 SRD 5.2.1 feats (missing Boon of Fate, Grappler, treating Magic Initiate as 3 variants) + 17 PHB 2024-only entries kept by policy |
| Spells (shipped) | `███████████████████░` 🟩 95% | 324/340 SRD 5.2.1 spells across L0 to L9, plus 12 wired-non-SRD extras (XGE/TCE spells with dedicated engine planners or tests) for 336 total |
| Spells (mechanically wired) | `████████░░░░░░░░░░░░` 🟧 42% | ~141/336; remainder names the engine primitive each blocks on |
| Conditions | `████████████████████` 🟩 100% | 15/15 RAW + 83 mechanic-rider variants the engine emits |
| Magic items | `█████████░░░░░░░░░░░` 🟧 ~46% | 122 of ~264 SRD 5.2.1 magic items, spanning common through legendary; 27 charges-bearing. All entries audited against SRD 5.2.1 in slice 150; rarity + attunement re-audited in slices 183 + 192. |
| Monsters | `██████████████░░░░░░` 🟨 ~68% | 252/~370 MM statblocks across all 14 creature types (CR 0 to 30, with Tarrasque the schema-max CR 30 capstone added in batch 5.9). **SRD 5.2.1 catalog is 234 / 235 closed** (only Troll Limb deferred, gated on the Loathsome Limbs spawn primitive from batch 5.6). Both Chromatic + Metallic Dragon ladders fully closed (40 statblocks). Magic Resistance cohort 36, wired Breath Weapons 44, Legendary Resistance 16, Legendary Actions 12, Pack Tactics 5. |
| Variant rules enforced | `██████████░░░░░░░░░░` 🟨 50% | `grittyRest` + `heroPoints` enforce; `sanity` + `massCombat` toggle but don't yet enforce |

**What this means for use**: the engine is solid for "create a character, run combat, do a session." For a campaign that exercises the long tail of PHB spells, the missing subclasses, or the bulk of MM monsters, you'll be authoring content packs alongside the starter pack. See the per-category breakdown below and [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) for the canonical inventory.

Phase F (`ttrpg-engine-core` extraction) is explicitly optional; it remains the only fully un-attempted slice in the original Phase A–F roadmap.

## Known gaps

The canonical "what's missing" surface. Three subsections — engine, content, test infrastructure — covering things the project ships partial or not at all. Use this as the punch-list for PRs.

Severity column throughout: 🔴 immediately visible to a player at low levels, 🟡 visible in specific situations, ⚪ rare or content-bound.

### Engine gaps

**🔴 / 🟡 status: 0 open.** The RAW-compliance audit at [tests/audit/raw-compliance.test.ts](tests/audit/raw-compliance.test.ts) probes 48 first-page-of-the-PHB rules across action economy, conditions, positioning, concentration, combat math, equipment, and death/dying — **all 48 pass, 0 skipped, 0 failing**. The audit's commit history is the canonical record of which rules were closed when; the [trustworthiness roadmap](docs/trustworthiness-roadmap.md) frames the four-tier path from "alpha" to "trustworthy for unsupervised tabletop play."

The audit is a floor, not a ceiling — it probes 48 specific rules. RAW areas the audit doesn't yet probe (exhaustion progression effects, multiclass spell-slot math, death-save nat-1/nat-20 edge cases, Frightened-on-attack-roll disadvantage, etc.) could surface new gaps. Adding a probe is ~10-15 lines; the file is structured for incremental growth.

#### Variant-rule enforcement (deferred, ⚪)

Two opt-in variant-rule toggles. Both have campaign-state plumbing (the boolean flips); neither has rule-interpretation logic.

| Gap | Severity | Slice | What's missing |
|---|---|---|---|
| `CampaignSettings.sanity` is inert | ⚪ | 46 | The flag toggles, but the engine doesn't track a sanity score on Character or expose a Sanity ability. A real 2024 sanity-rule wiring needs a 7th ability score path through character creation, derivations, and saves — too large a change to bundle here. |
| `CampaignSettings.massCombat` is inert | ⚪ | 46 | The flag toggles, but the engine doesn't yet have a `Squad` entity, morale ladder, or mass-combat resolution planners. Whole-system addition; future slice. |

#### Targeted engine vocabulary still on the menu (⚪)

The architectural skeleton is locked. What's left is a long tail of focused primitives — each ~50–200 LoC, each unblocking a cohort of currently schema-only content. The full inventory lives in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) under "Future engine slices"; below are the categories most likely to bite a real campaign:

| Gap | Severity | What's wired | What's missing |
|---|---|---|---|
| Predicate DSL coverage | ⚪ | `eq` / `gt` / `gte` / `hasProperty` / `hasCondition` / `damageType` / `all` / `any` / `not` / `always` / `never`. `AddModifier.condition` is now honored at modifier-sum time (slice 115). Facts populated: `event.attackKind` + `bearer.wearingArmor` (slices 115/116), `event.attackerIsSource` / `event.targetIsSource` / `event.attackerCreatureType` etc. on the dispatcher, `bearer.tempHp` for "while temp HP > 0" retaliation gates (slice 122). | Remaining facts not yet populated for predicate use: `bearer.notIncapacitated`, `bearer.hpCurrent`, an explicit `event.attackKind` on AttackRolled (so retaliation riders can melee-gate). Mirror Image's "while not incapacitated" still waits on these. |
| Rage planner | ⚪ | Barbarian L1 grants the `rage` resource; Frenzy spends one charge + applies a `frenzied` condition (+2 damage). | No `planRage` to install Rage's actual effects (damage resistance to physical, attack-bonus on STR melee, exhaustion-at-end, advantage on STR checks while raging, duration tracking). Frenzy's bonus-action attack grant is consumer-driven. |
| Per-Metamagic-option spell modification | ⚪ | `engine.plan.metamagic({ option })` spends the right sorcery-point cost (1/2/3 SP per RAW). | Spell modification (Twinned target doubling, Distant range doubling, Quickened bonus-action timing, Empowered damage reroll, etc.) is consumer-driven. Each option's effect on `planCastSpell` is a future slice. |
| Familiar as a first-class entity | ⚪ | Druid Wild Companion spends a Wild Shape charge. | No Familiar entity / Find Familiar spell mechanic. Summoning a familiar is consumer-driven (`CharacterCreated` for the creature). |
| `OfferChoice` at L1 doesn't auto-fire | ⚪ | `planLevelUp` emits `ChoiceRequired` on level advancement. | Fresh L1 characters (built via `CharacterCreated` rather than leveled up to L1) don't receive their L1 `OfferChoice` grants. Fighter L1 Fighting Style is affected; Paladin/Ranger Fighting Style work because they're gained on L1→L2. |
| Fighting Style gates | 🟢 | All 6 PHB 2024 Fighting Styles wired. Archery's +2 attack gated on ranged attacks (slice 115). Defense's +1 AC gated on wearing armor (slice 116). Dueling's +2 damage gated on melee-attack + off-hand-not-weapon (slice 117). Two-Weapon Fighting adds the ability mod to off-hand damage via a `GrantTwoWeaponFighting` marker (slice 119). Protection reaction (slice 120): `engine.plan.protection` rolls a fresh d20 for the consumer to apply as disadvantage on a nearby ally's attacker; gates on `GrantProtectionFightingStyle` + shield equipped + reaction available. Great Weapon Fighting (slice 121) treats any 1 or 2 on a melee two-handed-wielded weapon's damage die as a 3 via `GrantGreatWeaponFighting`. Slice 117 also surfaced + fixed a latent miss: the `target: 'damage'` modifier sum was never being consumed by any planner; Frenzy's +2 damage was also dormant and is now wired. | None — the Fighting Style track is complete for the 2024 PHB. |
| ~~Auto-expiry for trigger-applied conditions~~ | 🟢 | `ApplyCondition` TriggerAction (slice 98) stamps `durationRounds` on the action, the dispatcher converts it to `expiresOnRound` on the emitted ConditionApplied when inside an active encounter (slice 102), and `planAdvanceTurn` sweeps the appliedConditions on each turn-start emitting `ConditionRemoved` for any whose source matches the new active combatant and whose expiry has arrived. Slice 109 extends the same plumbing with a `expiryTrigger: 'turnEnd'` branch for "1 round" / "until end of your next turn" durations: the condition def declares `autoExpiry: { afterRounds, trigger }`, the cast-spell buff branch stamps both fields on the emitted ConditionApplied, and `planAdvanceTurn` runs a separate sweep after `TurnEnded`. | Spirit Shroud's heal-block auto-expires at the start of the caster's next turn (turnStart); Blade Ward's 1-round buff auto-expires at the end of the bearer's next turn (turnEnd). Future trigger-applied or cast-applied conditions with the same shape wire for free. Outside an encounter the expiry stays consumer-managed. |
| Spell Glyph variant of Glyph of Warding | ⚪ | Explosive Runes variant ships via the trap primitive (slice 94). | The Spell Glyph variant stores an arbitrary spell whose targets resolve at trigger time. The trap payload only models save + damage today; storing a spell is a bigger change. |

### Content gaps

The starter pack is intentionally a slice, not the full 2024 catalogs. This table is the canonical inventory of what's shipped vs what the books contain. Content gaps are *fillable by anyone* (no engine work required, just JSON) — see [docs/authoring-content-packs.md](docs/authoring-content-packs.md).

| Category | Shipped | RAW total (approx) | Severity | Notes |
|---|---|---|---|---|
| Classes (table scaffolding) | 12 of 12 | 12 | 🟡 | All 12 classes carry full L1–L20 tables populated with features. The remaining content gaps are subclass progression (L7 / L10 / L14 features per subclass) and a handful of narrowly-deferred Tier 3 stubs (per [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md)). The class-feature matrix is **fully wired through L7** across all 12 classes; later tiers ship features at every grant level with effects wired where the primitive vocabulary covers them, narrative-only otherwise. |
| Subclasses | 12 (1 per class, L3 baseline + 8 wired or partial post-L3) | ~50+ | 🟡 | One canonical PHB-2024 subclass per class lands at L3 (the gating level). The L3 features are a mix of fully wired (Draconic Resilience AC, Thief Second-Story climb speed, College of Lore proficiencies + Cutting Words, Champion Remarkable Athlete + Improved Critical, Oath of Devotion Sacred Weapon, Life Domain Disciple of Life, Path of the Berserker Frenzy, Cleric Blessed Strikes / Divine Strike) and a small remainder of content-stubs (Circle of the Land's cantrip + Land's Aid, Evoker's Sculpt Spells, Fiend Patron's Dark One's Blessing, Hunter's Lore + Hunter's Prey, Thief Fast Hands, Warrior of the Open Hand Technique). **Subclasses batch 1** added 8 wired or partial-wired features beyond L3: Champion L7 Additional Fighting Style + L15 Superior Critical, Circle of the Land L6 Natural Recovery + L10 Nature's Ward, Draconic Sorcery L6 Elemental Affinity, Fiend Patron L6 Dark One's Own Luck + L10 Fiendish Resilience, Oath of Devotion L7 Aura of Devotion. The 13 outstanding subclass features each ship as content-stubs with a documented engine-primitive blocker (full enumeration in [docs/srd-5.2.1-audit-classes.md](docs/srd-5.2.1-audit-classes.md)). The other 3–4 subclasses per class are still consumer territory. |
| Spells | 336 (324 SRD 5.2.1 + 12 wired-non-SRD) | 340 (SRD 5.2.1) | 🟢 | Pack ships 324 of 340 SRD 5.2.1 spells (95% coverage of the SRD spell catalog) plus 12 post-PHB spells with substantial engine investment (Absorb Elements, Armor of Agathys, Blade Ward, Cause Fear, Cloud of Daggers, Cordon of Arrows, Crusader's Mantle, Elemental Weapon, Hunger of Hadar, Spirit Shroud, Summon Beast, Thunder Step). Wired count ~141 via `mechanicalEffects` plus 10 dedicated planners (absorb-elements, counterspell, dispel-magic, elemental-weapon, identify, misty-step, shield, sanctuary, hunters-mark, polymorph). The remaining ~195 ship schema-only and each names the engine primitive blocking it. Slice 151 audited the cohort against SRD 5.2.1 and dropped 64 schema-only post-PHB spells (XGE/TCE summon-X cohort, investiture-X cohort, smite riders, etc.) + renamed 15 named-mage spells to their SRD 5.2.1 canonical names (Bigby's Hand to Arcane Hand, Mordenkainen's Sword to Arcane Sword, etc.). Audit at [docs/srd-5.2.1-audit-spells.md](docs/srd-5.2.1-audit-spells.md). See [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) for the per-spell catalog. |
| Magic items | 122 | ~260 (SRD 5.2.1 magic-item A-Z) | 🟢 | Spans common through legendary tiers. Includes the alpha.5 seed, the wondrous fillout (items batches 1.1 through 1.8, 1.10, 1.12 through 1.18), 8 named magic weapons (Vicious / Sun Blade / Frost Brand / Holy Avenger / Vorpal Sword / Dwarven Thrower / Hammer of Thunderbolts / Berserker Axe), 8 named armors and shields, +1 / +2 / +3 weapon and armor templates, the full Giant Strength belt and potion family, 8 Ioun Stones, 16 rings, 8 robes / cloaks / outer garments, 8 cloaks and small-slot accessories, and 27 charges-bearing items (rods / staves / wands / charged rings + the alpha.5 Wand of Magic Missiles). 30 consumables (16 potions + 8 spell scrolls cantrip-through-9th + 6 alpha.5). Slice 150 audited the cohort against SRD 5.2.1 and dropped 16 non-SRD entries (XGE cosmetics + a few DMG-only items); audit at [docs/srd-5.2.1-audit-items.md](docs/srd-5.2.1-audit-items.md). Wiring of most items' effects arrays remains deferred behind the magic-item-effect-projection pass (slice 132 unblocked it; content-side wiring is the remaining work). |
| Monster statblocks | 252 | ~370 (MM) | 🟢 | All 14 MM creature types now in pack: Humanoid, Beast, Undead, Giant, Dragon, Fiend, Elemental, Monstrosity, Ooze, Construct, Aberration, Fey, Celestial, Plant. CR 0 (Awakened Shrub, Lemure, Commoner) to **CR 30 (Tarrasque, schema-max PB +9, AC 25, HP 697 — the SRD 5.2.1 capstone, added in batch 5.9)**. Both Chromatic + Metallic Dragon ladders fully closed (40 statblocks). **44 statblocks with wired Recharge area-save Breath Weapons** (every dragon + Iron Golem + Ankheg + Winter Wolf + Dragon Turtle), 12 with Legendary Actions, 16 with Legendary Resistance, 36 with Magic Resistance, 5 with Pack Tactics. Highest-leverage remaining engine primitives are Frightful Presence, Innate Spellcasting per-spell envelope, Charge / Pounce / Trampling, save-induced multi-condition curses (Lamia / Rakshasa shape), and Swarm composite. Slices 141-149 standardized the initial 111 entries against SRD 5.2.1; monster lane batches 4.1-4.14 added 63 statblocks (118 to 181); **monsters batch 5 (slices 5.1 - 5.11) added 71 more statblocks closing the SRD 5.2.1 catalog at 234 / 235** (Troll Limb deferred pending the Loathsome Limbs spawn primitive). All 252 entries verified against the slice-195 SRD drift harness. Audit at [docs/srd-5.2.1-audit.md](docs/srd-5.2.1-audit.md). |
| Species | 7 | 9 in SRD 5.2.1 | 🟢 | All 7 pack species (Human, Elf, Dwarf, Halfling, Tiefling, Dragonborn, Gnome) are SRD 5.2.1-derived. Missing from pack: Goliath, Orc (both SRD-listed). |
| Backgrounds | 19 | 4 in SRD 5.2.1 | 🟢 SRD subset + ⚪ extras | Slice 152 audited: 4 SRD-derived (Acolyte, Criminal, Sage, Soldier); 15 PHB 2024-only kept by policy for character creation breadth (Artisan, Charlatan, Entertainer, Farmer, Folk Hero, Guard, Guide, Guild Artisan, Hermit, Merchant, Noble, Outlander, Sailor, Scribe, Wayfarer). Audit at [docs/srd-5.2.1-audit-character-creation.md](docs/srd-5.2.1-audit-character-creation.md). |
| Feats | 33 | 17 in SRD 5.2.1 | 🟢 SRD subset + ⚪ extras | Slice 152 audited: 16 SRD-derived (incl. Magic Initiate × 3 variants); 17 PHB 2024-only kept by policy. SRD-listed but missing from pack: Boon of Fate, Grappler. |
| Weapons / armors / tools / gear | 39 weapons + 13 armors + 37 tools + 77 gear + 42 consumables | full PHB chapter | 🟢 | All PHB 2024 weapons (simple + martial) plus their 9 masteries. All 13 PHB armors. Item lane batches 4.1-4.16 closed the SRD 5.2.1 equipment.md H4 surface: 17 artisan's tools, 6 Other Tools, 10 Musical Instruments, 4 Gaming Set variants, 5 Ammunition sub-forms, 8 adventuring packs, plus alchemical-hazard consumables, light sources, containers, clothing, writing, traps, spellcasting foci, etc. |
| Conditions | 98 (15 RAW + 83 rider) | 15 RAW | ✓ | All 15 RAW conditions plus 83 mechanic-rider conditions the engine uses (`blessed`, `baned`, `held-paralyzed-active`, `cursed-attacks-active`, `fire-shield-warm-active`, `healing-blocked-active`, `protection-from-evil-and-good-active`, `holy-aura-active`, `blade-warded-active`, `darkvision-active`, `sanctuary-active`, `studied-target-active`, `innate-sorcery-active`, etc.). |
| Epic boons | 9 | ~16 in DMG 2024 | ⚪ | About half of the published list. |
| Separate `ttrpg-engine-dnd-srd-2024` package | not built | — | 🟡 | Phase D Slice 31's deeper intent — extracting an SRD-derived pack as its own published package — was never done. The starter pack stands in. |

#### Content triage

The 🔴 items are the ones a level-1-to-5 family-tabletop run notices immediately: a Fighter at level 5 with no Extra Attack hooked up, a Rogue at level 3 with no subclass to pick, a Wizard wanting to cast Web (but it's in the spell list with no mechanics). Closing them is mostly JSON authoring — see the authoring guide.

The 🟡 items become relevant as the campaign progresses past low levels. The ⚪ items are the long tail.

### Test infrastructure gaps

All three test-infrastructure layers from the standard now ship: replay-equivalence + RNG-capture invariants (Layers 5 + 6), property-based tests with `fast-check` at 1000 iterations × 34 properties (Layer 7), a feature-coverage matrix that audits every class feature / mastery / condition / feat / magic item (Layer 8), and a public-API contract test that snapshots exports + locks key signatures (Layer 9). The engine ships **1508 tests across 214 files**, plus a 48-probe RAW-compliance audit (Layer 10, [tests/audit/raw-compliance.test.ts](tests/audit/raw-compliance.test.ts)), a 15-check SRD drift audit (Layer 11, [tests/audit/srd-drift.test.ts](tests/audit/srd-drift.test.ts)) that compares pack content against the SRD 5.2.1 markdown clone on every script-detectable field, and exhaustive boundary sweeps over the canonical PHB 2024 tables (ability modifier, proficiency bonus, full / half / pact slot tables, carrying capacity, exhaustion) in [tests/boundaries/](tests/boundaries/).

#### Property-test generator coverage

The Layer 7 property tests in [tests/property/](tests/property/) fuzz the engine across 28 invariants × 1000 iterations each (with the content-pack validator fuzz at 200 iterations to keep runs snappy), plus a stateful combat-sequence test (6 more invariants × 60-turn random fights). Coverage of the previously-missing generators landed in alpha.5: random spell-cast sequences (slot accounting, concentration consistency, replay equivalence across 5-20 random casts) and multi-class characters (10 invariants over 2-3-class mixes with PHB 2024 prerequisites). The remaining gaps are non-blocking expansion targets (each its own future slice):

| Generator | Severity | What it would exercise |
|---|---|---|
| Encounters with terrain | ⚪ | The combat-sequence test uses a bare grid; the engine also supports difficult / impassable / water cells, doors (open / closed / locked), and line-of-sight via Bresenham. A terrain generator would fuzz `terrainAt`, `movementCostFor`, `hasLineOfSight`, `hasLineOfEffect` against random maps. |
| Mounted combat | ⚪ | `Mounted` / `Dismounted` / vehicle entities and the planners around them (mounted attack rules, controlled vs independent mounts, vehicle damage). Untouched by current property tests. |
| Level-up flows | ⚪ | Random `LevelUp` intents producing valid `PendingChoice` chains, then random `ChoiceResolved` to clear them. Would fuzz the level-up planner + `applyLevelUpResolved` + the choice-resolution interactions. |
| Downtime / crafting sequences | ⚪ | The downtime planners (Slice 27) are tested via targeted fixtures only. A random-multi-day-downtime generator would fuzz the crafting / training / activity-resolution loop. |
| Random rest cycles interleaved with combat | ⚪ | Short rest mid-encounter, long rest with concentration spells active, resource recovery interleaving, the `LongRestStarted` concentration-clearing path. Currently exercised only by targeted rest tests. |

The threshold for adding one: a real bug suspected in the relevant code path, or a class-of-bug worth a categorical safety net. The shipped property tests already cover the core engine invariants; these are *expansion*, not *gap closure*.

## Roadmap

Six phases. The slice catalog below is the canonical list.

Legend:

- ✓ — slice ships completely (engine + content + tests covering it).
- ◐ — slice partially ships: the named events / reducers / planners exist, but either some called-out sub-features are deferred or the content layer is intentionally a starter slice. Each ◐ entry names what's missing.
- (blank) — slice not started.

Phase F is explicitly optional and not in scope unless multi-system support becomes a real goal.

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

### Phase C: Combat fill-in (10 slices, 7 fully wired + 3 partial)

High-impact mechanics consumers will immediately want.

- ✓ **Slice 21.** Grapple, shove, hide actions. `planGrapple` rolls the attacker's unarmed save DC (8 + STR mod + prof) and emits a `SaveRolled` for the target (STR or DEX); failure applies the `grappled` condition. `planShove` does the same with a STR save and applies `prone` or emits a forced `CombatantMoved` (5 ft push). `planHide` rolls a DEX (stealth) check against DC 15 (or caller-provided DC) and applies the `invisible` condition on success. All three consume an Action when the actor is an active combatant; out-of-combat usage is unmetered.
- ✓ **Slice 22.** Counterspell, Dispel Magic, Identify. `planCounterspell` follows the 2024 model: reaction consumed, 3rd-level slot spent, target makes a CON save against the counter-caster's spell save DC; on failed save a `SpellCountered` event records the outcome (callers omit the original spell's resolution events). `planDispelMagic` auto-succeeds on effects whose level is at or below the dispel slot level, otherwise an `AbilityCheckRolled` against DC 10 + spell level; on success `SpellDispelled` removes the effect plus its conditions and clears any concentration link. `planIdentify` emits `ItemIdentified`, appending the character to `ItemInstance.identifiedByCharacterIds`.
- ◐ **Slice 23.** Weapon Mastery effects via `planWeaponMastery({mastery, attackerId, targetId, weaponInstanceId})`. **Six of the nine masteries** ship: Sap, Vex, Slow apply marker conditions (`sapped`, `vexed-by`, `slowed-10ft`); Topple emits a CON save against the attacker's unarmed save DC and applies `prone` on failure; Push emits a forced 10 ft `CombatantMoved` when positions exist; Graze emits a `DamageApplied` for the attacker's STR modifier in the weapon's damage type. Every activation also emits a `WeaponMasteryActivated` record event. **Missing: Cleave / Nick / Flex** — these are sequencing concerns that belong inside the attack planner (extra-attack-on-adjacent, light-weapon-extra-attack, ability-pick-on-versatile) and were deferred.
- ✓ **Slice 24.** Mounts, vehicles, mounted combat. Mounts are creatures (kind `creature`) with a rider linked via `Character.mountedOnId`; `Mounted` and `Dismounted` events maintain that back-link. Vehicles are a separate entity (`land` / `water` / `air`) with their own HP, AC, capacity, and occupant roster. New events: `VehicleAcquired`, `VehicleBoarded`, `VehicleDeparted`, `VehicleDamaged`, `VehicleRepaired`; capacity is enforced at boarding time.
- ◐ **Slice 25.** Travel and overland. `TravelLegCompleted` events append to a `travelLog` on the campaign (pace, hours, miles, optional from/to locations, notes). `planNavigationCheck` rolls Wisdom (Survival) against caller DC and emits `NavigationCheckRolled`. `planForage` rolls Wisdom (Survival) and emits `ForagedFor` with food and water pounds gained on success. **Missing: forced-march CON-save loop** — the engine has no `planForcedMarchTick` that auto-rolls a save per hour over 8 and applies exhaustion on failure; consumers compute hours-traveled and emit `ExhaustionChanged` themselves.
- ✓ **Slice 26.** NPCs with reaction and morale mechanics. Character schema gains optional `attitude`, `morale`, and `moraleBroken` fields. `planReactionRoll` rolls the presenter's CHA (Persuasion) against a DC and bumps the NPC's attitude (hostile / unfriendly / indifferent / friendly / helpful) based on margin. `planMoraleCheck` rolls the NPC's Wisdom against a DC; failed checks decrement morale and emit `MoraleBroken` (flee / surrender) when morale hits zero.
- ✓ **Slice 27.** Downtime, crafting, training. `DowntimeActivityResolved` appends to a `downtimeLog` on the campaign with kind (`crafting` / `training` / `recuperating` / `research` / `work` / `other`), day count, outcome (`success` / `partial` / `failure`), summary, optional produced item definition ID, and optional tool proficiency gained. Tool proficiencies accumulate per character in `toolProficienciesByCharacter`.
- ✓ **Slice 28.** Magic item charges, recharge, sentient items. ItemInstance gains `maxCharges` and `sentient { ego, alignment, personality }` fields. `ItemChargeConsumed` decrements `chargesRemaining` (refuses to over-spend), `ItemRecharged` adds back up to `maxCharges` on one of five cadences (`dawn`, `dusk`, `shortRest`, `longRest`, `manual`), `SentientItemConflict` records the outcome of an item-vs-wielder showdown.
- ✓ **Slice 29.** Resurrection variants. `CharacterResurrected` event with `spell` discriminator (`revivify`, `raise-dead`, `reincarnate`, `resurrection`, `true-resurrection`) restores the target to `hpAfter` HP, clears temp HP, resets death saves, and zeroes exhaustion. Reincarnate may set `newSpeciesId` to swap the character's species. Currency cost is left to the caller via the existing `CurrencySpent` event so consumers can apply table-specific economies.
- ◐ **Slice 30.** Wild Shape, Polymorph, Simulacrum, Wish. The reducers exist: `PolymorphApplied` swaps HP, ability scores, AC, speed, and species into a new form and snapshots the originals to `Character.polymorphedSnapshot`; `PolymorphReverted` restores them. `wild-shape`, `polymorph`, and `true-polymorph` share the machinery via a `kind` discriminator. `SimulacrumCreated` clones a character into a creature-kind duplicate at half-HP (transient state reset). `WishGranted` records a freeform wish description; `stressApplied: true` increments the granter's exhaustion. **Missing**: there are no `planPolymorph` / `planWildShape` / `planSimulacrum` / `planWish` planners; consumers emit the events directly. The form-swap is correct as far as it goes, but spell-slot consumption, casting-ability-mod-driven form HP, concentration interaction, and the wider Wild Shape resource economy are consumer-side.

### Phase D: Adoption surface (7 slices, 6 fully wired + 1 partial)

These don't add rules; they make the library usable by people who didn't write it. Higher priority than Phase E for any consumer that isn't this repo's author.

- ◐ **Slice 31.** Starter content pack bundled in the package as `src/content/packs/starter-pack.json` and exported via `loadStarterPack()`. Current contents (after Phase E content fill-out): 12 classes with 1-20 level tables and spellcasting blocks; 7 species; 8 backgrounds; ~22 feats including all six 2024 fighting styles; 9 epic boons; ~33 spells (with ~21 fully wired and ~10 still schema-only); ~25 items including 9 magic items; 6 monster statblocks (CR 1/4 - 10); the 2024 Bastion system; all 15 conditions. **Missing — by intention and by gap**: the L2+ class features carry empty `features: []` arrays for most levels (only Sneak Attack scales at the content layer; Rage / Action Surge progression / Channel Divinity options / Wild Shape forms / Ki uses / Bardic Inspiration die scaling / Extra Attack / Stunning Strike / Evasion / etc. are content-layer TODOs). **No subclasses ship**. The pack is "enough to instantiate a character and run combat at level 1-5"; for higher-level play or any subclass, consumers extend the pack from the 2024 SRD CC-BY release. There is **no separate `ttrpg-engine-dnd-srd-2024` package**; the deeper Phase D intent of extracting one was not done.
- ✓ **Slice 32.** Two runnable adoption surfaces: (a) `/examples` with three CLI TypeScript apps — a character-sheet printer ([01-character-sheet](examples/01-character-sheet/)), an encounter-and-replay demo ([02-combat-encounter](examples/02-combat-encounter/)), and a save/load round-trip ([03-save-and-load](examples/03-save-and-load/)), each a single `npx tsx`-runnable file with an integration test in [tests/integration/examples.test.ts](tests/integration/examples.test.ts) that runs them in CI; and (b) `/web`, a browser demo deployed to GitHub Pages ([live link](https://greghcarr.github.io/ttrpg-engine-dnd/), source [web/](web/), plan [docs/web-demo-plan.md](docs/web-demo-plan.md)) featuring a Combat Sandbox (turn-aware action toolbar), an Event Inspector (virtualized event list with color-coding by category), and Export/Import event logs with on-page replay verification. A CI replay test at [tests/integration/web-scenarios.test.ts](tests/integration/web-scenarios.test.ts) asserts the replay-equivalence invariant against every shipped demo scenario. Auto-deploy via [.github/workflows/deploy-demo.yml](.github/workflows/deploy-demo.yml).
- ✓ **Slice 33.** Getting-started doc at [docs/getting-started.md](docs/getting-started.md) walking through install, engine setup, character creation, attack resolution, and save/load round-trip. API reference at [docs/api-overview.md](docs/api-overview.md) maps every public symbol by namespace (planners, derivations, events, schemas, content packs, RNG, IDs, migrations).
- ✓ **Slice 34.** Public API conveniences. `engine.do(campaign, intent)` dispatches on `intent.type` to the right planner and commits the result in one call (covers every Phase A-C planner). `serializeCampaign(c)` writes a JSON string with id, name, schemaVersion, and events only; state is omitted because `loadCampaign(json)` replays the events to reconstruct it. `createPC({name, speciesId, backgroundId, classId, hpMax, ...})` returns a `Character` with sensible defaults; caller emits the `CharacterCreated` event themselves to add to a campaign.
- ✓ **Slice 35.** Derivation memoization keyed on `CampaignState.version`. Every `engine.derive.*` method now caches its result per-engine; the cache invalidates automatically when `state.version` advances (i.e., on every commit). Repeated calls at the same version return the same object reference, so a UI that asks for derived AC ten times per frame across twelve combatants pays for one computation each.
- ✓ **Slice 36.** Build packaging. `package.json` declares `main` (CJS), `module` (ESM), `types` (`.d.ts`), and `exports` for both formats so consumers cloning the repo can resolve the engine cleanly. `files` whitelists `dist/`, `docs/`, license, and READMEs. The package itself is no longer distributed through npm (the older alpha versions were unpublished on IP grounds in May 2026; `private: true` is set to prevent accidental republish).
- ✓ **Slice 37.** Content pack validator with diagnostic errors. `loadContentPack` throws a `ContentPackLoadError` whose `.issues` is a list of `{path, message}` entries derived from Zod's `safeParse` (e.g. `classes.0.hitDie: Expected number, received string`). `validateCrossReferences` returns issues with optional Levenshtein-based `suggestion` strings like `Did you mean "savage-attacker"?` so a one-character typo is identifiable from the error alone.

### Phase E: 2024 content fill-out (9 slices, 2 fully wired + 7 partial)

Heavy on data, light on engine code. Each class slice stress-tests Phases A and C. **Most slices in this phase ship the schema scaffolding and a starter slice of content; the full PHB / DMG / MM catalogs are explicitly consumer territory.**

- ◐ **Slice 38.** Classes group 1: Barbarian, Bard, Cleric, Druid added to the starter pack with 1-20 level tables and spellcasting blocks for the three full-casters. **Most level entries carry empty `features: []` arrays** — the schema accepts the full 2024 progression but landmark features (Rage tiers, Bardic Inspiration die scaling, Channel Divinity options, Wild Shape forms, etc.) are content-layer TODOs. No subclasses ship.
- ◐ **Slice 39.** Classes group 2: Fighter and Paladin were already in the starter pack; Monk and Ranger added with 1-20 level tables. Monk has Martial Arts placeholder, Unarmored Defense (OverrideACFormula with DEX+WIS), Monk's Focus (Ki resource grant), Extra Attack listed at L5. Ranger has Hunter's Mark resource, Weapon Mastery grant (all 9 masteries, 2 slots), Fighting Style, half-caster spellcasting on WIS. **Stunning Strike, Evasion, Fast Movement, Favored Enemy mechanics are not wired** at the content layer — the tables list the slot but no triggering effect fires. No subclasses ship.
- ◐ **Slice 40.** Classes group 3: Rogue, Warlock, and Wizard were already in the starter pack; Sorcerer added with Innate Sorcery and Font of Magic (sorcery-points resource), full CHA spellcasting. **Metamagic is a placeholder** (resource exists, no metamagic options actually mutate spells). Rogue Sneak Attack scales correctly at every odd level (the only class feature that actually scales at the content layer). No subclasses ship.
- ◐ **Slice 41.** Spell catalog: ~33 spells across cantrips + L1-3 + a single L4 (Polymorph) covering common archetypes. **Of those, ~26 have full mechanical effects wired**, including Sleep (via new `hp-pool-knockout` mechanic), Shield (dedicated `planShield`), Misty Step (dedicated `planMistyStep`). Two are still schema-only TODOs: Guidance (single-use buff that expires on first ability check) and Spirit Guardians (damaging aura with per-turn ticks). The utility cantrips (Mage Hand, Prestidigitation, Light, Detect Magic) are intentionally narrative-only. Filling the full 2024 catalog (~370 spells) is consumer territory; the schema and planners support every required shape but the JSON content is sparse.
- ◐ **Slice 42.** Species + backgrounds + feats + fighting styles + equipment + tools. 7 species (Human, Elf, Dwarf, Halfling, Tiefling, Dragonborn, Gnome); 8 backgrounds each pointing at an origin feat; ~22 feats (origin, general, all six 2024 Fighting Styles); ~13 weapons and ~10 armors total; 5 tools; 7 adventuring-gear items. **The full PHB lists** (every species variant trait, every background's lore choices, every feat in the book, every weapon and armor entry in the equipment chapter) **are consumer territory.**
- ◐ **Slice 43.** Magic items and monster statblocks. 9 magic items across all rarity tiers (common Bag of Holding through legendary Deck of Many Things); a charged wand (Wand of Magic Missiles) demonstrating Slice 28 charge tracking. 6 monster statblocks at the original seed (Goblin Warrior, Orc, Wolf, Skeleton, Ogre, Young Red Dragon) covering Humanoid / Beast / Undead / Giant / Dragon types and CR 1/4-10. Orc was later dropped (slice 141, not in SRD 5.2.1); Goblin was renamed to Goblin Warrior (slice 142). **The DMG magic-item catalog and the MM bestiary** (hundreds of items, hundreds of statblocks) **are consumer territory.**
- ✓ **Slice 44.** Bastions (2024 stronghold system). New `Bastion` entity (id, name, owner character, optional location, level 1-9, facilities, hirelings, defenders, treasury, HP). Six new events: `BastionFounded`, `BastionFacilityAdded` (basic / special, cramped / roomy / vast), `BastionHirelingAdded`, `BastionTurnTaken` (turn order: maintain / craft / recruit / research / trade / empower, with treasury delta and optional summary), `BastionDamaged` (clamps HP at zero), `BastionLevelChanged` (rejects mismatched fromLevel). Sufficient state for a consumer to run a full Bastion progression alongside an adventuring campaign.
- ✓ **Slice 45.** Epic boons (post-20 progression). The Feat schema already supported `category: 'epic-boon'`; this slice adds 9 boons to the starter pack (Combat Prowess, Dimensional Travel, Energy Resistance, Fortitude, Irresistible Offense, Skill, Spell Recall, the Night Spirit, Truesight) so consumers have working post-20 reward content. Granting a boon uses the existing `featsTaken` array on a Character; no new event type required.
- ◐ **Slice 46.** Variant rules toggles. New `CampaignSettings` shape on `CampaignState.settings` with boolean flags for `grittyRest`, `heroPoints`, `sanity`, `massCombat`, `feaCharacterFlaws`, plus a `customHouserules: string[]` for arbitrary table-specific tags. `CampaignSettingsChanged` event flips any subset of toggles in one go and add/removes custom houserule strings (dedupe on add). **The engine does not enforce these flags** — `grittyRest` doesn't actually change rest durations, `heroPoints` doesn't grant hero-point resources, etc. Consumers must branch their own planner logic on the flags. The slice ships the toggle plumbing; the rule interpretation is not wired.

### Phase F: Core extraction (1 slice, optional, future)

- **Slice 47.** Extract `ttrpg-engine-core` as a separate package. The architectural layer (event sourcing, plan/commit, branded IDs, content packs, sessions, journal, party + currency abstraction, predicate + formula DSL, PendingChoice protocol, undo/redo, transcript formatter, RNG-capture proof) is system-agnostic and could be the foundation for other TTRPG engines (Pathfinder, Tales of the Valiant, Gamma World, etc.). `ttrpg-engine-dnd` (this package) becomes the 5.5e adapter on top of the core. Only do this if multi-system support becomes a real goal; premature abstraction would slow the D&D work down for a hypothetical second consumer that doesn't exist yet. Estimated 2-4 weeks once this package is mature.

### Post-alpha.5: vocabulary expansion (slices 48–122, ongoing)

After the original Phase A–E roadmap completed at alpha.5, work shifted to a "primitive + canonical content user" cadence: each slice adds a small targeted Effect kind, TriggerAction, or planner that unblocks a cohort of currently schema-only content, plus the first one or two RAW spells / features that exercise it. Slices land one per session; the architectural skeleton remains untouched.

Grouped by theme:

- **Spell catalog completion** (10 slices). Every PHB 2024 spell now ships in the pack across L0–L9 (399 total). Coverage went from ~33 to 399 spells; mechanically wired count went from ~26 to ~152.
- **Class features fill-out** (14 slices). All 12 classes have L1–L20 features populated, plus targeted subclass wirings (Cleric Blessed Strikes, Paladin Aura Improvements, etc.). The class-feature matrix is fully wired through L7.
- **Engine primitives** (~35 slices). New Effect kinds, TriggerAction variants, and planners. Highlights:
  - Summon system (slice 48): `CompanionSummoned` / `CompanionDismissed` events, summon SpellMechanic with inline statblock, slot-level HP scaling. 11 spells wired.
  - On-hit trigger primitive (slice 61) + smite cohort: divine-favor, searing-smite, wrathful-smite, thunderous-smite, branding-smite.
  - Aura primitive (slice 63) + source-relative formulas (slice 64): paladin Aura of Protection, Crusader's Mantle.
  - Condition-immunity gate (slice 66) in the spell pipeline.
  - Area-effect via aura-damage (slices 68 / 70 / 71): 12 zone spells wired.
  - AC-buff (slice 74): Shield of Faith + Barkskin.
  - Temp-HP grant (slice 75): False Life.
  - Item-buff via `ItemInstance.temporaryBuff` (slices 76 / 90): Magic Weapon, Elemental Weapon.
  - `getEffectiveSpeed` retrofit (slice 77): movement-mode conditions (fly, spider-climb) now affect the engine's move planner.
  - Push primitive (slice 78): Gust of Wind, Earthbind.
  - Recurring-rider (slice 79): Heroism temp-HP per turn.
  - Falling-protection buff (slice 81): Feather Fall.
  - Caster-chosen options at cast time (slices 82–87): Chromatic Orb, Enlarge/Reduce, Calm Emotions, Command, Enhance Ability, Bestow Curse.
  - Target-side source-filtered on-hit rider (slice 88): Hex, Bestow Curse extra-damage variant.
  - Spirit Shroud variants (slice 89): cold / necrotic / radiant.
  - Dedicated reaction planner (slice 91): Absorb Elements.
  - Recurring-save primitive (slices 92 / 93): Bestow Curse inactive-turn, Hold Person, Hold Monster, Hideous Laughter, Confusion.
  - Trap mechanic (slice 94): Glyph of Warding (Explosive Runes), Cordon of Arrows.
  - Resistance-buff condition (slice 95): Protection from Energy 5-variant buff.
  - Directional attack disadvantage (slice 96) + generic attacker-side advantage wiring (slice 97): Bestow Curse attack variant; Blinded / Poisoned / Frightened / Prone / Restrained / Invisible now actually affect the d20.
  - Heal-blocking primitive + ApplyCondition dispatch (slice 98): Spirit Shroud heal-block.
  - AddDamageToAttacker TriggerAction (slice 100): Fire Shield.
  - Concentration cleanup for rider-applied conditions (slice 110): Holy Aura's blinded riders, Spirit Shroud's heal-block now lift cleanly across the board when the parent concentration drops.
  - On-fatal-damage intercept primitive (slice 111) + rider-aware variant (slice 114): Death Ward fires on any primary or rider damage that would drop the warded creature, clamping HP at 1 and consuming the ward.
  - Nonmagical-attack resistance qualifier (slice 112): Stoneskin ships in SRD form; same primitive unblocks the common "resistance to B/P/S from nonmagical attacks" monster trait.
  - Rider damage through the mitigation pipeline (slice 113): Sneak Attack, smites, Spirit Shroud rider, Fire Shield retaliation, Graze, trap base damage all now consult `mitigateDamage`. The dispatcher's `runningState` advances between fired triggers so per-rider intercepts see post-prior-rider state.
  - Predicate-gated `AddModifier` (slice 115) + `bearer.wearingArmor` fact (slice 116) + Dueling damage path (slice 117) + Two-Weapon Fighting marker (slice 119) + Protection reaction planner (slice 120) + Great Weapon Fighting reroll (slice 121): all six 2024-PHB Fighting Styles now apply RAW-correctly. Slice 117 also activated the dormant `target: 'damage'` modifier sum (Frenzy's +2 damage lights up incidentally).
  - Numeric-comparison predicates (slice 122): new `gt` / `gte` kinds + `bearer.tempHp` fact populated by the trigger dispatcher. Canonical user is Armor of Agathys (warlock L1), shipped with a temp-HP grant + a retaliation rider gated on `bearer.tempHp gt 0`. Dice parser relaxed to accept `0d6+5`-style flat-damage expressions.

Each slice ships its primitive plus a canonical content user, a unit test, a content test, and a gaps-doc walk from schema-only to wired. See [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) for the per-spell catalog plus the future-slice queue of primitives still on the menu.

### What "perfect" cannot mean

5.5e explicitly delegates some rulings to the DM: improvised actions, narrative consequences, table houserules, ambiguous spell interactions that even Sage Advice has issued multiple clarifications on. A rules engine cannot adjudicate these. The `CustomEffect` code-handler escape hatch is the explicit spot for table-specific rulings. After all phases the engine covers ~95% of printed mechanics by surface area; the rest is documented as DM-discretion territory.

## Install

The engine is no longer distributed through a package registry. Pin to a git ref or a local path while iterating:

```jsonc
// in your consumer's package.json
"dependencies": {
  "ttrpg-engine-dnd": "github:greghcarr/ttrpg-engine-dnd"
  // or, when developing alongside the engine:
  // "ttrpg-engine-dnd": "file:../ttrpg-engine-dnd"
}
```

The package's build outputs are still produced (ESM, CJS, and `.d.ts` under `dist/`); peer dependencies (`zod`, `immer`, `ulid`) install transitively through the git/file dependency. See [VERSIONING.md](VERSIONING.md) for the alpha-to-1.0 roadmap and the alpha->beta promotion gate.

## Usage (preview)

```ts
import {
  createEngine,
  loadContentPack,
  seededRNG,
} from 'ttrpg-engine-dnd';
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

The package ships two categories of material under two licenses. See [NOTICE](NOTICE) for the full attribution and [docs/content-attribution.md](docs/content-attribution.md) for an item-by-item audit of the starter content pack.

**Engine code (MIT)**: all TypeScript source under `src/` (excluding `src/content/packs/`) is original work expressing public-domain game mechanics. The reducers, planners, schemas, derivations, and effect primitives are this package's own implementation; they incorporate no copyrightable expression from Wizards of the Coast publications.

**Starter content pack (CC BY 4.0)**: `src/content/packs/starter-pack.json` contains material derived from the Dungeons & Dragons System Reference Document 5.2, copyright Wizards of the Coast LLC, used under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode). The mechanical encodings (JSON structure, effect-primitive vocabulary, level-table shapes) are this package's own work; the derived material consists of names, structural rules, and numeric values present in SRD 5.2. Most-but-not-all of the pack is confidently SRD-covered; see the audit doc for items (notably Bastions and Epic Boons) where SRD inclusion was not independently verified by the authors.

**Trademarks**: "Dungeons & Dragons", "D&D", and related marks are trademarks of Wizards of the Coast LLC. This project is not affiliated with or endorsed by Wizards of the Coast. The package name `ttrpg-engine-dnd` uses generic descriptive terms.

If you build your own content pack to load into this engine, your pack's license is your choice and is independent of this package.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The architecture is locked (see [CLAUDE.md](CLAUDE.md)); contributions that fit within it are very welcome. Open an issue before a large change.

## License

Engine code: [MIT](LICENSE). Copyright (c) 2026 Greg Carr.

Starter content pack: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) (derived from D&D SRD 5.2). See [NOTICE](NOTICE) for the required attribution.
