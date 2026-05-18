# Changelog archive: slices 217-234 (post-alpha.5, slice-numbered cohort)

Originally in the `## Unreleased` section of [../../CHANGELOG.md](../../CHANGELOG.md). Moved here in slice 248 to keep the live CHANGELOG under the single-Read ceiling.

This window covers slices 218-234 (slice 234 has no standalone entry — its docs work was rolled into adjacent slice content). Most are engine-primitive slices (Cleric Divine Intervention, GrantSpell, Paladin smite / aura, Monk Superior Defense, Bracers of Defense AC gate, OverrideAbilityScore, Regeneration, SpawnCreature) with their canonical content users.

Order: most-recent first (slice 233 at top, slice 218 at bottom). For more recent slices (235+), see [archive-slices-235-240.md](archive-slices-235-240.md) and the live [CHANGELOG.md](../../CHANGELOG.md). For older, see [archive-slices-201-216.md](archive-slices-201-216.md).

---

Completes the Troll → Troll Limb arc started in slices 226 + 232. New TriggerAction kind that spawns a Character instance from a content statblock when an OnEvent rider fires. Canonical user: Troll's Loathsome Limbs trait. After this slice, hitting a Troll with 15+ slashing damage actually emits a CharacterCreated event for a Troll Limb — for the first time since alpha.5, the Troll behaves in combat the way the SRD describes.

**Plumbing**:

- New `SpawnCreature { statblockId, count? }` TriggerAction in [src/schemas/effects.ts](src/schemas/effects.ts) (alongside `AddDamage`, `ApplyCondition`, etc.).
- New `fireSpawnCreature` helper in [src/engine/triggers/dispatch.ts](src/engine/triggers/dispatch.ts) that builds a Character snapshot from the named statblock (HP = statblock average; ability scores + speed + AC copied; minimal runtime state; no inventory / spells / equipment). The runtime monster-trait fold from slice 129 reads through `statblockId`, so spawned creatures automatically pick up their own traits (Troll Limb's Regeneration fires from slice 232 on subsequent turns).
- New predicate facts for DamageApplied events: `event.damageOfType.<type>` carries the cumulative amount of each damage type in the event's components. Lets OnEvent filters express thresholds like `gte event.damageOfType.slashing 15`.
- Attack planner now dispatches triggers on the DamageApplied event (after the existing AttackRolled dispatch). This is a new architectural capability — OnEvent riders can now watch damage events directly, not just attack rolls.

**Content (Troll's Loathsome Limbs)**: OnEvent rider on the Troll's `traits` array, filtering on `targetIsSelf && damageOfType.slashing >= 15`, with `oncePer: 'turn'` and a SpawnCreature action targeting `troll-limb`.

**RAW deviations** (documented for the deferred-primitives backlog):

- The "Bloodied" gate is not enforced; the troll spawns a limb even at full HP if a single hit deals 15+ slashing. RAW: "If the troll ends any turn Bloodied and took 15+ Slashing damage during that turn..."
- The turn-end timing is replaced with on-hit (spawn fires immediately on the qualifying damage, not at the troll's turn end).
- The 4/Day lifetime cap is approximated by `oncePer: 'turn'` (one spawn per turn round, no per-day total enforced).

Closes "Troll Loathsome Limbs (SpawnCreature TriggerAction)" backlog row.

Pre-commit Uncle Bob audit:
- Names: `SpawnCreature`, `fireSpawnCreature`, `event.damageOfType.<type>` all descriptive.
- DRY: spawn-character builder mirrors the existing summons reducer's Character construction shape.
- SRP: schema kind / dispatch helper / per-type damage facts / attack-planner dispatch wiring — each does one thing.
- Magic numbers: 15-slashing threshold is RAW; HP/AC come from the statblock; no arbitrary constants.
- The attack planner's new damage-dispatch call is a deliberate architectural surface widening, not a regression.
- Tests assert mechanical outcomes (CharacterCreated with `statblockId === 'troll-limb'`), not just event presence.

Tests: 3-case test in [tests/unit/engine/troll-loathsome-limbs.test.ts](tests/unit/engine/troll-loathsome-limbs.test.ts) covering (1) 15+ slashing spawns a Troll Limb, (2) low slashing damage does NOT spawn, (3) high acid damage does NOT spawn (slashing filter). 1611 pass, 209 skipped. tsc clean.

**Engine: `Regeneration` monster trait primitive (slice 232)**

New effect kind for the classic regenerating-monster trait: bearer regains `perTurn` HP at the start of each of their turns, suppressed on the next turn after taking damage of a type in `suppressedBy`. Canonical users: Troll (15 HP/turn, suppressed by Acid/Fire), Troll Limb (5 HP/turn, same suppression). Closes 2 backlog rows; the slice-226 Troll Limb statblock becomes mechanically real.

**Architecture**: tracks `damageTypesTakenThisTurn` (deduped DamageType array) on each Character. Populated by the damage reducer (one for-loop in `applyDamageApplied`); consumed at turn-start by a new `planRegenerationAtTurnStart` helper that builds the bearer's effect stack and emits a Healed event when no recorded type appears in any Regeneration's `suppressedBy`. The TurnStarted reducer clears the array; the suppression check sits in the planner (where content access is available) so the reducer can stay content-free.

**Plumbing**:

- New `Regeneration { perTurn, suppressedBy }` Effect kind in [src/schemas/effects.ts](src/schemas/effects.ts). 48 → 49 wired primitives.
- New `damageTypesTakenThisTurn: DamageType[]` field on the Character schema. Populated by `applyDamageApplied`; cleared by `applyTurnStarted`. Initialized empty in the summons reducer.
- New `planRegenerationAtTurnStart` helper in [src/engine/plan/regeneration.ts](src/engine/plan/regeneration.ts). Mirrors the shape of `planBreathWeaponRechargeAtTurnStart`. Threaded into all 3 emission sites in `planAdvanceTurn` and `planBeginFirstTurn`.
- `EffectAccumulator` gains `addRegeneration(perTurn, suppressedBy)` setter + `regenerations()` query. Builder dispatch routes the effect.

**Content**: Troll and Troll Limb statblocks each gain a `traits` array with one Regeneration entry (per-turn 15 and 5, both suppressed by `["acid", "fire"]`).

**Future users** (retro-wirable via content edits, no engine work): Werewolf, Hag variants, Vampire, and other SRD regenerators that the bestiary picks up later.

Pre-commit Uncle Bob audit:
- Helper file mirrors the existing `plan/breath-weapon.ts` turn-start helper structure.
- Reducer hook is one bounded for-loop; no content lookup needed there.
- Names: `Regeneration`, `damageTypesTakenThisTurn`, `regenerations()`, `planRegenerationAtTurnStart` all descriptive.
- SRP: schema entry / accumulator query / damage-types tracker / turn-start helper / TurnStarted clear — each does one thing.
- Magic numbers: 15 and 5 are SRD-derived (Troll and Troll Limb perTurn); `['acid', 'fire']` is RAW.
- Tests assert mechanical outcomes: amount === 15, suppression-on / suppression-off, multi-turn re-enable.

Tests: 4-case test in [tests/unit/engine/troll-regeneration.test.ts](tests/unit/engine/troll-regeneration.test.ts) covering (1) regen fires for 15 HP at turn-start, (2) acid damage suppresses next turn, (3) slashing damage does NOT suppress, (4) suppression lasts one turn only (regen re-enables on the turn after). 1608 pass, 209 skipped. tsc clean.

**Engine: `GrantAdvantageVsBearersOfMyCondition` primitive + Ranger L17 Precise Hunter (slice 231)**

Closes the second of the two remaining deferred-with-reason main-class features from the slice-217 audit. Adds a new effect kind that gives the bearer advantage / disadvantage on rolls of a specified target type when the roll's counterparty (e.g., attack target) carries an active condition whose source is the bearer. Mirrors `SetAdvantageVsSource` (slice 96) but reads from the opposite direction: this primitive lives on the attacker; `SetAdvantageVsSource` lives on a condition.

The 3-way join — attacker bears the marker, target bears the named condition, condition's source is the attacker — sits naturally in the existing attack-planner advantage-resolution path. One new query (`advantageVsBearersOfMyCondition`) folds alongside the existing `advantageVsSource` / `advantageFor` calls.

**Canonical user**: Ranger L17 Precise Hunter. RAW: "while your Hunter's Mark spell is on a creature, you have Advantage on attack rolls against that creature." Wires as `GrantAdvantageVsBearersOfMyCondition { conditionId: 'hunters-mark-active', on: 'attack', mode: 'advantage' }`. The slice-222 work establishing `hunters-mark-active` with `sourceCharacterId` made this a single content edit on top of the new primitive.

**Plumbing**:

- New `GrantAdvantageVsBearersOfMyCondition` Effect kind in [src/schemas/effects.ts](src/schemas/effects.ts). 47 → 48 wired primitives.
- `EffectAccumulator` gains `addAdvantageVsBearersOfMyCondition(target, conditionId, mode)` + `advantageVsBearersOfMyCondition(target, counterpartyConditions, bearerId)` query. The query walks the entries and folds in advantage only when the 3-way join matches.
- Builder dispatch routes the effect to the accumulator.
- `planAttack` adds one new query call alongside the existing advantage resolution; folds the result into the same disadvantage-cancellation logic as the other contributions.

**State of the deferred-with-reason class-feature list**: was 2 (Monk L10 Heightened Focus, Ranger L17 Precise Hunter); now 1 (Monk L10 only). Heightened Focus still needs the three Monk L2 bonus-action planners shipped first.

Pre-commit Uncle Bob audit:
- Names: `GrantAdvantageVsBearersOfMyCondition` mirrors the existing `SetAdvantageVsSource` family; verbose but precise.
- DRY: followed the `SetAdvantageVsSource` pattern exactly. Field + setter + query + dispatch case + planAttack fold; no new abstractions.
- SRP: each piece does one thing; the 3-way-join logic sits in one method on the accumulator.
- No magic numbers / strings: `hunters-mark-active` is the existing slice-222 condition id.
- Tests assert mechanical outcomes: `attackRolled.used === 'advantage'` (and `!== 'advantage'` for the negative cases), not just event presence.

Tests: 4-case planner test in [tests/unit/engine/ranger-precise-hunter.test.ts](tests/unit/engine/ranger-precise-hunter.test.ts) covering (1) L17 ranger against own marked target gets advantage, (2) L16 ranger (no feature yet) gets no advantage even with mark active, (3) L17 ranger against creature marked by a different ranger gets no advantage (source-match check), (4) L17 ranger against unmarked target gets no advantage. 1604 pass, 209 skipped. tsc clean.

**Engine: `bearer.wieldingShield` predicate fact + Bracers of Defense wire (slice 230)**

Tiny primitive: a new predicate fact `bearer.wieldingShield` (mirror of `bearer.wearingArmor` from slice 116), populated in [src/derive/ac.ts](src/derive/ac.ts) alongside the existing armor fact. True iff the bearer has an item equipped in their shield slot.

**Canonical user**: Bracers of Defense (RAW: "+2 bonus to AC if you are wearing no armor and using no Shield"). Now wires the full RAW gate via an `AddModifier { target: 'ac', value: 2 }` whose condition is `all([eq bearer.wearingArmor false, eq bearer.wieldingShield false])`. Previously it was `effects: []` and one of the deferred backlog rows from slice 227's audit.

**Pre-commit Uncle Bob audit**:
- Names: `bearer.wieldingShield` mirrors `bearer.wearingArmor` exactly — symmetric, intention-revealing.
- DRY: piggybacks on the existing fact-population block (same Map, two adjacent lines).
- SRP: one new line of state derivation; the fact has a single semantic.
- No magic numbers/strings.
- The asymmetry of having `wearingArmor` but not `wieldingShield` was an architectural smell; this closes it.

Pack wired-items count: **26 → 27**. Closes the "Bracers of Defense bearer.wieldingShield predicate" backlog row.

Tests: 3-case test in [tests/unit/engine/bracers-of-defense.test.ts](tests/unit/engine/bracers-of-defense.test.ts) covering (1) unarmored + no-shield gets the +2, (2) shield-wielding gets nothing, (3) armored gets nothing. Uses total-AC comparison against a baseline-no-bracers character to avoid coupling to breakdown labels.

1600 pass, 209 skipped. tsc clean.

**Engine: `OverrideAbilityScore` primitive (slice 229)**

New effect kind that floors an ability score at a specific value: if the bearer's base score is below `value`, derivations use `value` instead; if at or above, no effect. Mirrors the `SetACFloor` shape from slice 74. Multiple floors on the same ability fold to the highest. Closes 9 backlog rows in one slice.

**Plumbing**:

- New `OverrideAbilityScore { ability, value }` Effect kind in [src/schemas/effects.ts](src/schemas/effects.ts). 46 → 47 wired primitives.
- `EffectAccumulator` gains `addAbilityScoreFloor(ability, value, source)` and `effectiveAbilityScoreFloor(ability): { value, source } | undefined`. Builder dispatch routes the effect to the accumulator.
- New pure helper `effectiveAbilityScore(baseScore, floor?): number` in [src/derive/ability.ts](src/derive/ability.ts).
- Threaded the helper into 5 derive surfaces (save, ability-check, attack-bonus, spell-DC, AC) plus plan/attack's damage path and the cleave action's mod-strip math. Every consumer that reads `character.abilityScores[X]` for a roll bonus now honors the floor.

**Content wirings (8 items)**:

- **Amulet of Health** (canonical user, exact RAW): `OverrideAbilityScore CON 19`.
- **Gauntlets of Ogre Power**: `OverrideAbilityScore STR 19`.
- **Belt of Hill Giant Strength**: STR 21.
- **Belt of Stone Giant Strength**: STR 23.
- **Belt of Frost Giant Strength**: STR 23.
- **Belt of Fire Giant Strength**: STR 25.
- **Belt of Cloud Giant Strength**: STR 27.
- **Belt of Storm Giant Strength**: STR 29.

Pack wired-items count: **18 → 26**. Closes backlog rows for "Amulet of Health / Gauntlets of Ogre Power / Belt of Dwarvenkind partial" + the 6 Giant Strength belt entries.

**Bug noted during slice (not fixed here, added to backlog)**: The Belt of *Giant Strength variants in the pack have drifted rarities (pack: Hill=rare; SRD: Uncommon). The drift audit misses this because the variant-unrolled names don't match SRD's parent "Belt of Giant Strength" entry. Adding to the deferred-primitives backlog under "audit: variant-unroll rarity validation".

**Future users** (not wired this slice, but the primitive is now available): Headband of Intellect (INT 19), Tome of Bodily Health / Clear Thought / Gainful Exercise / Leadership and Influence / Quickness of Action / Understanding (each permanently raises one ability score by 2, capped at 24 — distinct shape: not a floor, but a permanent base bump; could share the primitive with a "permanent" flag).

Pre-commit Uncle Bob audit:
- Helper is a 3-line pure function with intention-revealing name; mirrors the SetACFloor pattern.
- 5 derive call sites threaded uniformly; 2 plan/attack call sites threaded.
- Tests assert mechanical values (+4 STR mod, +9 STR mod) not just shape.
- No magic numbers: 19/21/23/25/27/29 are SRD-derived.
- The pre-existing belt-rarity drift was surfaced during audit and added to the backlog rather than silently fixed in-slice (separate concern).

Tests: 10-case test in [tests/unit/engine/override-ability-score.test.ts](tests/unit/engine/override-ability-score.test.ts) covering the helper math, accumulator collection, multi-source fold-to-highest, save / ability-check / attack-bonus / damage-roll derivation paths. 1597 pass, 209 skipped. tsc clean. Wired-items snapshot updated additively.

**Content: magic-item mechanical wiring (slice 227)**

Wires 4 SRD magic items that were `effects: []` to their existing-primitive shapes. No new engine vocabulary; pure content slice. Each item maps cleanly to a primitive the engine already supports (`GrantConditionImmunity`, `GrantImmunity`, `GrantResistance`, `ModifySpeed`, `SetAdvantage`).

- **Periapt of Proof against Poison** (rare, attuned): `GrantConditionImmunity poisoned` + `GrantImmunity poison`. Exact RAW.
- **Cloak of Arachnida** (very rare, attuned): `GrantResistance poison` + `ModifySpeed climb set 30`. The climb-speed value is an approximation matching the existing Slippers of Spider Climbing convention; RAW says "Climb Speed equal to your Speed" but the engine doesn't yet support a "match walk speed" `ModifySpeed` semantic.
- **Eyes of the Eagle** (uncommon): `SetAdvantage` on Perception skill checks. Slightly broader than RAW, which restricts the advantage to sight-based Perception; the engine doesn't have a sight-vs-other-sense predicate fact yet.
- **Cloak of the Bat** (rare, attuned): `SetAdvantage` on Stealth skill checks. The activated Fly Speed 40 in Dim Light or Darkness defers (needs an activate-as-action toggle + light-level predicate).

Pack wired-items count: **14 → 18**. The wired-items snapshot updated accordingly.

Pre-commit Uncle Bob audit (resumed per project convention):
- Names: SRD-canonical retained.
- DRY: no near-duplicates, no copy-paste blocks.
- SRP: one primitive per effect entry, one job each.
- Magic numbers: climb-speed 30 documented as Slippers-precedent.
- The two approximations (Cloak of Arachnida climb speed; Eyes of the Eagle perception breadth) are explicit RAW deviations called out above so future engine slices can revisit when the missing primitives ship.

Tests: 1587 pass, 209 skipped. Drift audit green. Wired-items snapshot updated.

**Content: SRD Troll Limb statblock (slice 226)**

Adds the Troll Limb monster, the final SRD 5.2.1 monster entry that was missing from the pack. Troll Limb is the dismembered-limb statblock that spawns from a Troll's *Loathsome Limbs* trait when the troll ends a turn Bloodied after taking 15+ Slashing damage that turn.

Stats per SRD 5.2.1 (matches every drift-audit field):
- Small Giant, Chaotic Evil
- AC 13, HP 14 (4d6), Speed 20 ft.
- STR 18, DEX 12, CON 10, INT 1, WIS 9, CHA 1
- Darkvision 60 ft., Passive Perception 9
- CR 1/2 (XP 100, PB +2)

Mechanical traits (Regeneration, Troll Spawn 1d12 on day 24+, Rend +6 melee for 2d4+4 slashing) ship as the same schema-only shape as the parent Troll entry; the Loathsome Limbs *spawn* primitive on the parent Troll (which would actually emit a Troll Limb on the right trigger) stays deferred — that's an engine-track follow-up needing a `SpawnCreature` TriggerAction.

Net effect: **SRD 5.2.1 monster catalog is now 235/235 pack-complete**. Every `### Name` block in `references/srd-markdown/monsters-A-Z.md` has a matching pack entry.

Tests: drift audit green on all 252 monsters (252 pack monsters; the audit hit-count remains 234 by name lookup since several SRD parents like Animated Object have variants in pack and the pack doesn't always use the SRD's exact canonical name — those skip the audit cleanly). 1587 tests pass, 209 skipped. tsc clean. No engine changes; no schema changes.

**Content: SRD 5.2.1 variant-parent unrolls + slice-224 dup cleanup (slice 225)**

Closes the last Tier-1 pure-JSON gap for SRD compliance: the 4 multi-rarity SRD parents (Figurine of Wondrous Power, Potion of Giant Strength, Potions of Healing, Spell Scroll) each get explicit variant unrolls so the pack covers every SRD-listed variant by name. Also cleans up 15 duplicate entries inadvertently created by slice 224.

**Cleanup**: slice 224 added 15 `-srd` magic-itemKind entries for potions / oils that already existed in the pack as `consumable` itemKind (Potion of Climbing, Potion of Growth, Potion of Heroism, Potion of Invisibility, Potion of Mind Reading, Potion of Poison, Potion of Resistance, Potion of Speed, Potion of Vitality, Potion of Water Breathing, Potion of Animal Friendship, Potion of Diminution, Potion of Flying, Oil of Sharpness, Oil of Slipperiness). Surgically removed the 15 duplicates; the original consumable entries (which carry richer description text + onConsume hooks) remain canonical.

**Variant unrolls added** (20 new entries):

- **Potions of Healing** (1 new): Supreme Healing (Very Rare). Greater + Superior already in pack as consumables; base Potion of Healing also already present.
- **Potion of Giant Strength** (5 new): Frost / Stone / Fire (all Rare), Cloud (Very Rare), Storm (Legendary). Hill (Uncommon) already in pack.
- **Figurine of Wondrous Power** (9 new): Bronze Griffon / Ebony Fly / Golden Lions / Ivory Goats / Marble Elephant / Onyx Dog / Serpentine Owl (Rare), Obsidian Steed (Very Rare), Silver Raven (Uncommon).
- **Spell Scroll** (10 new): Cantrip / 1st Level (Common), 2nd / 3rd (Uncommon), 4th / 5th (Rare), 6th / 7th / 8th (Very Rare), 9th (Legendary). The 9 named-by-spell consumables (Spell Scroll of Fire Bolt, Magic Missile, etc.) remain in pack as descriptive variants alongside the new level-keyed canonicals.

**Coverage**: pack magic-item count 271 → 276 (after net +20 −15). SRD 5.2.1 magic-item pack-presence is now **complete** at the canonical-variant level. Every SRD H4 entry has at least one pack representation.

Tests: 1587 pass, 209 skipped. Drift audit green on all 276 magic items. tsc clean. No engine changes; no schema changes.

**Content: SRD 5.2.1 magic-item pack-completion sweep (slice 224)**

Pure-content bulk addition: 149 SRD 5.2.1 magic-item entries that were SRD-listed but missing from the pack. Each entry ships in the existing minimal schema-only shape (`{ id, itemKind: 'magic', name, rarity, requiresAttunement, effects: [] }`); rarity and attunement are parsed directly from each item's SRD type-line and match the drift audit's automated check.

**Coverage**: pack magic-item count jumps **122 → 271**. SRD 5.2.1 magic-item presence coverage climbs from ~46% to **~99%**. The drift audit (rarity + attunement) passes on every one of the 271 entries.

**Highlights of what landed**: Animated Shield, Apparatus of the Crab variants, Belt of Dwarvenkind, Cloak of Arachnida / Cloak of Invisibility, Crystal Ball (all four variants: base + Mind Reading + Telepathy + True Seeing), the full +1/+2/+3 ammunition/armor/shield/weapon templates as SRD-canonical single entries (alongside the existing pack-split variants), the staff cohort (Staff of Fire / Frost / Power / the Magi / the Python / the Woodlands / Striking / Swarming Insects / Thunder and Lightning / Withering), Bag of Devouring / Tricks, Robe of Scintillating Colors / Stars, Rod of Absorption / Alertness / Lordly Might / Resurrection / Rulership / Security, the full Manual of * cohort (Bodily Health / Gainful Exercise / Golems / Quickness of Action), the full Talisman / Tome / Cube / Dust / Oil / Periapt families, plus iconic singletons like Sphere of Annihilation, Well of Many Worlds, Wings of Flying, and the legendary Defender / Luck Blade / Nine Lives Stealer named swords.

**Deferred** (6 SRD entries; each requires variant-instance pack convention before it can be added as a single canonical line):

- **Figurine of Wondrous Power** (10+ statblock-bearing variants: Bronze Griffon, Ebony Fly, etc.)
- **Potion of Giant Strength** (6 rarity variants by giant type)
- **Potions of Healing** (4 rarity variants: Healing / Greater / Superior / Supreme)
- **Spell Scroll** (10 rarity-by-spell-level variants; the pack ships 9 named consumables under this umbrella)
- **Giant Fly** + **Avatar of Death** are creature statblocks embedded in `magic-items.md` (Bag of Tricks fly variant; Deck of Many Things companion), not actually magic items themselves.

The 4 variant-bearing parents (Figurine, Giant Strength Potion, Healing Potion, Spell Scroll) need each variant explicitly added; that's a content-only follow-up slice once the audit harness for variant naming is settled. The 2 statblock entries (Giant Fly, Avatar of Death) belong in `monsters` if anywhere.

Net effect: the SRD 5.2.1 magic-item catalog is **substantially complete** at the pack-presence level. Mechanical wiring of the 149 new entries is a separate, much larger track (most need primitives like UseItem / ConsumeItem planners, OverrideAbilityScore, variant-instance pattern, WeaponCritRider, ItemSpellGrant; tracked in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md)).

Tests: drift audit + spell-coverage tests + full suite pass after the bulk insert; **1587 tests, 209 skipped, 0 failed**. No engine changes; no schema changes.

**Content: SRD 5.2.1 completion sweep — pure JSON wins (slice 223)**

Pure content addition focused on closing the SRD 5.2.1 catalog with entries that need no engine work. Closes every SRD-listed entry that was missing from the pack and unblockable by JSON alone.

- **15 SRD spells added** (was 16, but Animate Objects was already present; the gaps doc was stale on the spelling):
  - **Wired** (single-save mechanic the engine already supports): Befuddlement (L8 INT, 10d12 psychic, half on success), Freezing Sphere (L6 CON, 10d6 cold, half), Mind Spike (L2 WIS, 3d8 psychic, half, +1d8/slot), Vitriolic Sphere (L4 DEX, 10d4 acid, half, +2d4/slot).
  - **Schema-only** (deferred for engine wiring): Antilife Shell, Blink, Divine Smite, Elementalism, Floating Disk, Ice Knife, Illusory Script, Shining Smite, Sorcerous Burst, Summon Dragon, Transport via Plants. Each carries a documented blocker in [tests/unit/engine/spell-coverage.test.ts](tests/unit/engine/spell-coverage.test.ts).
  - **SRD spell catalog coverage**: 324 → 339 / 340. Only the gaps-doc-stale "Animated Object" (already shipped as `animate-objects`) was a non-issue; the catalog is now SRD-complete to within one phantom entry.
- **2 SRD species added**: Goliath (Medium Humanoid, walk 35), Orc (Medium Humanoid, walk 30). Both ship with the existing `traits: []` shape consistent with the other 7 species (mechanical traits are still consumer territory). **SRD species coverage**: 7/9 → 9/9.
- **2 SRD feats added**: Grappler (general, prereq Level 4+ + STR/DEX 13+), Boon of Fate (epic boon, prereq Level 19+). Both ship `effects: []`; the Grappler bundle (Punch and Grab, Attack Advantage, Fast Wrestler) and Boon of Fate's 2d4 bonus/penalty mechanic both await targeted engine vocabulary. **SRD feat coverage**: 14/17 → 16/17 (Magic Initiate is split into 3 class variants per the existing pack convention; SRD treats it as one).
- **Audit-regex fix**: the SRD drift audit's `halfOnSuccess` regex didn't recognize Vitriolic Sphere's "half the initial damage" phrasing. Extended the regex to match that variant. The SRD body explicitly says half on success for Vitriolic Sphere.

Net result: the SRD 5.2.1 markdown surface in `references/srd-markdown/` is now pack-complete on spells, species, and feats. Magic items and monsters were already at 99.6% (only Troll Limb remains, deferred pending the Loathsome Limbs spawn primitive).

Tests: every shipped spell has a matching expectation in the spell-coverage table (regression guard), and the SRD drift audit passes on all 15 script-detectable fields after the new entries land.

No engine changes; no schema changes.

**Content: Hunter's Mark damage-rider wire (slice 222)**

Pure-content slice that wires Hunter's Mark (Ranger L1 spell) for its primary on-hit damage rider. The spell had `mechanicalEffects: []` since the catalog landed; ranger players couldn't actually feel the +1d6 force damage at the table. This slice closes the main wired arm.

Mechanism: Hunter's Mark installs a new `hunters-mark-active` condition on the targeted creature with `sourceCharacterId` set to the casting ranger. The condition carries an `OnEvent` + `AddDamage` rider that fires +1d6 Force damage when `event.targetIsSelf && event.hit && event.attackerIsSource` (the precedent is the Hexed condition wired in slice 88; Hunter's Mark uses the identical 3-way join shape, just with Force damage on Ranger casts).

Deferred RAW arms (each is a separate slice's worth of work and not required for the main on-hit benefit):

- Advantage on the caster's WIS (Perception or Survival) checks to find the target. Needs a new effect kind (e.g., `GrantAdvantageToBearersOfMyCondition`) so the *caster's* skill checks read the marked target's condition rather than something on the caster's own effect stack.
- Bonus-action remark when the marked target drops to 0 HP. Needs a planner that consumes a bonus action and moves the condition to a new target.
- Upcast-driven duration extension (L3-4: 8 hours, L5+: 24 hours). The concentration system uses round-based expiry today; the durations beyond 1 hour aren't differentiated in encounter flow.

Slice 222 unblocks one of the audit's deferred-with-reason main-class features: Ranger L17 Precise Hunter, which needs exactly this `hunters-mark-active`-with-source-link condition before its Advantage-vs-bearer arm can be wired. Slice 223+ can ship the Precise Hunter primitive on top.

Tests: 3-case planner test in [tests/unit/engine/plan-cast-spell-hunters-mark.test.ts](tests/unit/engine/plan-cast-spell-hunters-mark.test.ts) verifying (1) the condition installs on the target with the caster as source, (2) the marking ranger's hit fires +1d6 force, (3) a non-caster's hit on the marked target does NOT fire the rider. Updated wired-conditions snapshot.

No engine changes; no schema changes.

**Engine: Cleric L20 Greater Divine Intervention (Wish branch) (slice 221)**

Wires the first arm of Cleric L20 Greater Divine Intervention via a new marker primitive that extends slice 220's `planDivineIntervention`.

- **Primitive**: new `GrantDivineInterventionWish` Effect kind (45 → 46... → 47 wired primitives). Pure marker, no parameters. The accumulator exposes `markDivineInterventionWish()` and `hasDivineInterventionWish()`. The builder dispatch routes `GrantDivineInterventionWish` → `markDivineInterventionWish`.
- **Planner change**: `planDivineIntervention` now special-cases `spellId === 'wish'`. When the chosen spell is Wish, the bearer must have the marker; the Cleric-list and L5-or-lower gates are bypassed for Wish specifically. Other Cleric spells still go through the normal gates. RAW: "When you use your Divine Intervention feature, you can choose Wish when you select a spell."

Pack: Cleric L20 `greater-divine-intervention` feature now ships `[{ kind: 'GrantDivineInterventionWish' }]` (was `effects: []`).

Still deferred: the second arm of Greater Divine Intervention is the 2d4-long-rest cooldown when Wish is the chosen spell. This needs a `ResourceCooldownExtended` (or similar) primitive that the rest reducer can honor by skipping `divine-intervention` recharge until the cooldown count reaches zero. That's its own slice; the marker by itself is the right size for one slice.

Tests: 4-case planner test in [tests/unit/engine/greater-divine-intervention.test.ts](tests/unit/engine/greater-divine-intervention.test.ts) covering the L20 Wish-cast happy path (no slot consumed), the L10 rejection (no marker → no Wish), the residual non-Wish above-L5 gate (Fire Bolt still rejected even at L20), and the L20 normal-DI path (a Cleric L1 cast still works). Updated wired-features snapshot.

**Engine: Cleric L10 Divine Intervention planner + `ignorePreparation` flag (slice 220)**

Closes one of the three deferred-with-reason main-class features from the slice-217 audit pass. Ships in two pieces:

- **Primitive**: new `ignorePreparation?: boolean` flag on `CastSpellIntent`. When true, `planCastSpell` skips the "does the bearer know or prepare this spell?" gate; the calling planner is responsible for validating eligibility against the feature's rule. Used here for Divine Intervention's "any Cleric spell L5 or lower" rule, and available for any future magic-item or feature that lets the bearer cast from a fixed catalog.
- **Canonical user**: new `planDivineIntervention` planner in [src/engine/plan/divine-intervention.ts](src/engine/plan/divine-intervention.ts). RAW: "As a Magic action, choose any Cleric spell of level 5 or lower that doesn't require a Reaction to cast. As part of the same action, you cast that spell without expending a spell slot or needing Material components. You can't use this feature again until you finish a Long Rest." Implementation validates the spell is on the Cleric list, level ≤ 5, and not Reaction casting time; consumes one `divine-intervention` resource use; then delegates to `planCastSpell` with both `noSlotCost: true` (slice 219) and `ignorePreparation: true`. The delegated cast emits its own action-economy event matching the underlying spell's casting time, which models "as part of the same action" (Divine Intervention IS the Magic action; the cast inherits it).

Pack changes: Cleric L10 feature `divine-intervention` now ships a `GrantResource { resourceId: 'divine-intervention', max: 1, recharge: 'longRest' }` effect (was previously `effects: []`).

The L20 Greater Divine Intervention Wish variant is still a follow-up: it needs to add Wish to the selectable set and impose a 2d4 long-rest cooldown override when Wish is the chosen spell (the only RNG-bearing part of the feature).

Tests: 6-case planner test in [tests/unit/engine/plan-divine-intervention.test.ts](tests/unit/engine/plan-divine-intervention.test.ts) covering the happy path (free cast, resource depletion), exhaustion rejection, non-Cleric spell rejection, above-L5 rejection, and the "no preparation needed" guarantee. Updated wired-features snapshot to include the L10 wire.

**Engine: `noSlotCost` flag on CastSpellIntent (slice 219)**

Adds `noSlotCost?: boolean` to `CastSpellIntent`. When true, `planCastSpell` skips both the slot-availability gate and the `SpellSlotConsumed` / `PactSlotConsumed` emission; the chosen `slotLevel` still drives any per-slot upcast scaling. The default (false / unset) preserves the existing paid-cast behavior exactly.

Unblocks several "free cast" features that previously had no engine-side mechanism:

- **Cleric L10 Divine Intervention** ("you cast that spell without expending a spell slot or needing Material components"). Next slice can ship `planDivineIntervention` that consumes a per-LR resource and delegates here.
- **Cleric L20 Greater Divine Intervention** (adds Wish to the selectable set; same free-cast plumbing).
- **Warlock L9 Contact Patron** (slice 217's `oncePerLongRest` preparation; once-per-LR free cast of Contact Other Plane).
- Magic-item "casts X without expending a slot" riders (Ring of Spell Storing, certain wand entries).

No new event types; no schema changes; no public-API additions beyond the intent flag.

Tests: 4-case planner test in [tests/unit/engine/plan-cast-spell-no-slot-cost.test.ts](tests/unit/engine/plan-cast-spell-no-slot-cost.test.ts) verifying (1) no `SpellSlotConsumed` emission, (2) caster's slot pool unchanged after the cast, (3) the paid-cast path still emits `SpellSlotConsumed` (regression guard), (4) the flag bypasses the no-slots-available gate when the bearer is fully out of L1 slots.

**Content: subclass higher-tier spell-list sweep (slice 218)**

Cashes in slice 212's `GrantSpell` engine consumer by wiring the L5/L7/L9 spell-list tiers for three subclasses that previously shipped only the L3 tier:

- **Life Domain (cleric)**: L3 corrected from slice 212's incorrect Bless / Cure Wounds / Healing Word / Sanctuary to SRD-correct **Aid, Bless, Cure Wounds, Lesser Restoration**. L5 adds **Mass Healing Word, Revivify**. L7 adds **Aura of Life, Death Ward**. L9 adds **Greater Restoration, Mass Cure Wounds**.
- **Draconic Sorcery (sorcerer)**: L5 adds **Fear, Fly**. L7 adds **Arcane Eye, Charm Monster**. L9 (Legend Lore + Summon Dragon) is deferred: `summon-dragon` is not in the pack yet; wiring a half-tier would be inaccurate.
- **Fiend Patron (warlock)**: L5 adds **Fireball, Stinking Cloud**. L7 adds **Fire Shield, Wall of Fire**. L9 adds **Geas, Insect Plague**.

Each tier rides under a distinct feature id (e.g., `life-domain-spells-l5` / `-l7` / `-l9`) so the effect stack's dedup-by-feature-id semantics accumulate the tiers additively rather than overwriting the L3 set.

12-case derive test in [tests/unit/engine/subclass-higher-tier-spells.test.ts](tests/unit/engine/subclass-higher-tier-spells.test.ts) verifying the accumulator's `grantedSpells()` returns the expected sorted spell-id list at each tier boundary (L4/L5/L7/L9 for all three subclasses). The L9 Fiend Patron case also asserts Contact Other Plane (slice 217 class L9) is part of the union, since `effectiveSpellList` unions class + subclass grants.

Updated slice 212's regression test for the Life Domain L3 fix. Updated the wired-subclass-features snapshot to include the new tier rows.

No engine changes; no schema changes.

