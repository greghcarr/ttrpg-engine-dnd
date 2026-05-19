# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The bump policy and pre-release roadmap are documented in [VERSIONING.md](VERSIONING.md).

## Unreleased

**Content: degradation-roll sweep for the remaining wands + Staff of Healing (slice 257)**

Closes the slice-256 follow-up: wires the three remaining RAW canonical users of the slice-256 `destructionRoll` primitive. Pure JSON, no engine surface touched.

Content wired (3 magic items, identical shape):

- **Wand of Fireballs**: `destructionRoll: { trigger: 'lastChargeExpended', die: 20, destroyOn: [1] }`. RAW: "If you expend the wand's last charge, roll 1d20. On a 1, the wand crumbles into ashes."
- **Wand of Lightning Bolts**: same shape, same RAW text.
- **Staff of Healing**: same shape. RAW: "If you expend the last charge, roll 1d20. On a 1, the staff vanishes in a flash of light, lost forever."

Pre-commit short audit (content sweep):

- **RAW citations**: each entry's `destructionRoll` cites the SRD 5.2.1 `magic-items.md` H4 entry verbatim. All four canonical users (3 wands + Staff of Healing) share the identical shape; SRD wording differs only in the destruction narrative (crumbles vs. vanishes), which is irrelevant to the mechanical encoding.
- **DRY**: the three new wires share an identical inline `destructionRoll` object. Not abstracted because three siblings is below the threshold and an extracted helper would be one-call-site-shallow with no future call sites (Wind Fan's `eachUse` variant has a different `trigger` discriminator and won't share this exact shape).
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1657 tests across 244 files) green; coverage matrix snapshot unchanged (all three items were already in `wiredIds` from slices 243 + 255 via their `onUse` entries; `destructionRoll` doesn't affect the wiredIds filter). The slice-256 planner tests for the destruction-roll path remain the audit gate for behavior; this slice just adds three more items to the canonical-user side.

**Engine: per-item degradation roll primitive + Wand of Magic Missiles canonical user (slice 256)**

Closes the deferred-primitives row that slice 243 explicitly gated on "defer until a second item lands." With 3 wands + Staff of Healing all RAW-specifying the same shape ("expend the last charge, roll 1d20; on a 1 the wand crumbles / the staff vanishes"), the gate is met.

Architecture: planner consumes the d20, bakes the result on the emitted event, and apply() retires the instance. Same plan/commit-split discipline as every other RNG-consuming planner in the engine.

**Plumbing**:

- New `ItemDestroyed` event in [src/schemas/events/inventory.ts](src/schemas/events/inventory.ts): `{ characterId, instanceId, definitionId, reason: 'degradation-roll', rollDie, rollResult }`. The roll outcome is baked at plan time so apply() stays RNG-free and replay reproduces the same destruction outcome. Wired into [src/schemas/events/index.ts](src/schemas/events/index.ts) (import + union + array) and [src/engine/apply.ts](src/engine/apply.ts) (dispatch case).
- New `applyItemDestroyed` reducer in [src/engine/reducers/inventory.ts](src/engine/reducers/inventory.ts): mirrors `applyItemConsumed`'s retirement path (remove instance from character's inventory + delete from `state.itemInstances`).
- New `destructionRoll?: { trigger: 'lastChargeExpended', die, destroyOn }` field on MagicItemSchema in [src/schemas/content/item.ts](src/schemas/content/item.ts). The `trigger` discriminator leaves room for a future `'eachUse'` variant (Wind Fan's 20% per-use tear) without breaking the shape; for now only `'lastChargeExpended'` is supported.
- planUseItem extension in [src/engine/plan/use-item.ts](src/engine/plan/use-item.ts): tracks `lastChargeExpended` inside the existing charge gate (remaining === totalChargesCost), then after the action effects and ItemUsed journal marker, rolls `def.destructionRoll.die` and emits `ItemDestroyed` if the result is in `destroyOn`. Event order in the stream: ItemChargeConsumed → action effects (SpellCastDeclared, etc.) → ItemUsed → ItemDestroyed.
- `formatEvent` case for ItemDestroyed in [tests/transcript.ts](tests/transcript.ts): renders as "{item} crumbles to ashes (degradation roll: {result} on d{die}). **{owner}** loses the item."

**Content wired (1 magic item)**:

- **Wand of Magic Missiles**: `destructionRoll: { trigger: 'lastChargeExpended', die: 20, destroyOn: [1] }`. RAW: "If you expend the wand's last charge, roll 1d20. On a 1, the wand crumbles into ashes and is destroyed."

**Future SRD users this unblocks** (now content-only follow-ups, identical shape):

- Wand of Fireballs (`destroyOn: [1]`).
- Wand of Lightning Bolts (`destroyOn: [1]`).
- Staff of Healing (`destroyOn: [1]`; RAW: "the staff vanishes in a flash of light, lost forever").

**Deferred (different trigger shape)**:

- Wind Fan's "20% per-use chance the air-elemental gust knocks the fan from the user's hand and the fan tears" — uses `trigger: 'eachUse'`, fires every use independent of charges. Not modeled this slice (no canonical user other than Wind Fan, and Wind Fan is itself currently `effects: []`). When a second `eachUse` user lands, extend the trigger union.

Pre-commit Uncle Bob audit:

- **Names**: `destructionRoll` field name carries the RAW intent (the roll exists to determine destruction); `trigger: 'lastChargeExpended'` reads as English ("trigger fires when last charge is expended"). `ItemDestroyed.reason: 'degradation-roll'` keeps the door open for future destruction causes (e.g., `'sundered'` for a weapon-sundering effect) without overloading a single event.
- **DRY**: `applyItemDestroyed` is a near-twin of `applyItemConsumed` (both retire an instance + remove from inventory). Considered a shared `retireInstance(state, characterId, instanceId)` helper — declined for now because each reducer's preconditions diverge (ItemConsumed's instance has a `definitionId` from the event payload; ItemDestroyed's same, but the future trigger variants might have different invariants). Single-call-site twins of 4 lines each is below the abstraction threshold.
- **SRP**: schema field, event, reducer, planner extension, transcript case each own one concern. The planner extension lives inside the existing planUseItem rather than as a separate planner because the destruction check is intrinsic to the use action (it conditions on the same `lastChargeExpended` boolean the charge gate computes).
- **Magic numbers**: `die: 20` and `destroyOn: [1]` on Wand of Magic Missiles are RAW (SRD 5.2.1 `magic-items.md`). No engine-side magic numbers introduced; the formula `result ∈ destroyOn` is the rule itself.
- **`at`-threading**: single `at = intent.at ?? nowIso()` resolved at the top of planUseItem (unchanged from slice 241); the `ItemDestroyed.at` re-uses that same timestamp so the destruction lands at the same wall-time as the use that triggered it.
- **Plan/commit split preserved**: `rollDie(die, rng)` is consumed in the planner; `rollResult` baked on the emitted ItemDestroyed; the reducer is pure (no RNG). Replay reproduces byte-identical state.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1657 tests across 244 files, was 1649) green. 6 new planner unit cases (d20=1 destroys, d20≠1 persists, non-last-charge no roll, no-destructionRoll no roll, upcast-to-final-charge triggers roll, committed destruction retires from state). 2 new reducer unit cases (happy path + character-not-found throws). All 8 prior `wand-of-magic-missiles` tests still pass — the new fields don't disturb the existing planner paths.
- **Tests**: planner tests use a `fixedRng(value)` inline helper to control the d20 outcome deterministically (rng.next() in [0, 0.05) → rollDie(20) = 1; in [0.05, 1) → 2-20). Reducer tests construct state via `applyAll(CharacterCreated + ItemAcquired)` matching the established pattern. transcript snapshots not yet regenerated for any golden scenario that exercises ItemDestroyed (none of the existing goldens do); future goldens that destroy an item will surface the new transcript line at snapshot time.

**Open follow-ups**:

- **Content sweep** (small, 3 items): wire Wand of Fireballs, Wand of Lightning Bolts, Staff of Healing with identical `destructionRoll: { trigger: 'lastChargeExpended', die: 20, destroyOn: [1] }`. Pure JSON edit + snapshot update.
- **Wind Fan `eachUse` trigger** (small, 1 item): extend the trigger union to include `'eachUse'`. The probabilistic-tear shape (20% per use) maps cleanly: `destructionRoll: { trigger: 'eachUse', die: 20, destroyOn: [1, 2, 3, 4] }` (4/20 = 20%) or `{ die: 5, destroyOn: [1] }`. Defer until Wind Fan itself gets onUse wires (currently `effects: []`).

**Content: Wand of Fireballs + Wand of Lightning Bolts + Staff of Healing Cure Wounds arm (slice 255)**

Closes the three remaining variable-cost canonical users surfaced by slice 253. Pure JSON wires against the variable-`chargesCost` primitive shipped in slice 253; no engine surface touched.

Content wired:

- **Wand of Fireballs** (rare, requires attunement by a Spellcaster; 7 charges, 1d6+1 dawn recharge) → `onUse: [{ kind: 'CastSpell', spellId: 'fireball', slotLevel: 3, chargesCost: 1, chargesCostMax: 3, castingClassId: 'wizard' }]`. RAW: spend 1-3 charges to cast Fireball at L3-L5.
- **Wand of Lightning Bolts** (rare, requires attunement by a Spellcaster; 7 charges, 1d6+1 dawn recharge) → identical shape with `spellId: 'lightning-bolt'`. RAW: spend 1-3 charges to cast Lightning Bolt at L3-L5.
- **Staff of Healing** Cure Wounds arm appended to existing `onUse` array (joining slice 243's Lesser Restoration + Mass Cure Wounds): `{ kind: 'CastSpell', actionId: 'cure-wounds', spellId: 'cure-wounds', slotLevel: 1, chargesCost: 1, chargesCostMax: 4, castingClassId: 'cleric' }`. RAW: 1-4 charges → L1-L4 Cure Wounds. All three Staff of Healing arms now wire.

RAW correction: slice 253's CHANGELOG narrative misstated the wands' charge ranges as 1-7 → L3-L9. The SRD 5.2.1 `magic-items.md` explicitly caps charges-per-use at 3 ("you can expend no more than 3 charges to cast _Fireball_"); the correct range is 1-3 → L3-L5. Slice 253's entry updated to match RAW.

RAW deviations carried forward from slice 253:

- The wands' fixed item-DC ("save DC 15") is not enforced; the engine computes the save DC from the consumer's stats via `castingClassId: 'wizard'`. Same shape as slice 241's scroll-of-fireball parity convention.
- The "expend the last charge, roll 1d20; on a 1 the wand crumbles" degradation roll stays deferred (per-item degradation primitive doesn't exist yet).
- Attunement gate not enforced (same shape as slice 240-243).

Coverage matrix:

- `wand-of-fireballs` and `wand-of-lightning-bolts` join `wiredIds` (slice 254 extended the matrix to count `onUse` wires). `staff-of-healing` was already in `wiredIds` (it had Lesser Restoration + Mass Cure Wounds wired since slice 243); adding the third arm doesn't change membership.

Pre-commit short audit (content sweep):

- **RAW citations**: each wire's parameters cite the SRD 5.2.1 magic-items entry verbatim (wand-of-fireballs / wand-of-lightning-bolts / staff-of-healing). The base slot level on each wand is 3 (the floor of the spell's RAW level); `chargesCostMax: 3` matches the SRD "no more than 3 charges" cap exactly.
- **DRY**: the two wands share an identical shape with only `spellId` differing; not abstracted because two siblings is below the threshold and an abstracted helper would be one-call-site-deep with no future call sites.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1649 tests across 244 files) green; coverage snapshot diff is exactly the 2 newly-wired wands joining `wiredIds` (Staff of Healing already present); the slice 253 RAW correction in the CHANGELOG entry text is a non-code edit; no test code change needed (slice 253's planner tests already cover the shape).

**Tests: feature-coverage matrix counts `onUse` wires as wired (slice 254)**

Closes the open follow-up from slice 253: the `magic-item wire and charge state is stable` snapshot at [tests/coverage/features.test.ts](tests/coverage/features.test.ts) classified items as "wired" based on the `effects` array only. Items wired via the `onUse` action shape (slices 240-243 + 253) were invisible to the audit; six magic items (Wings of Flying, Boots of Speed, Boots of Levitation, Hat of Disguise, Staff of Healing, Wand of Magic Missiles) showed as unwired even though their RAW mechanics are fully wired through the planUseItem path.

What changed:

- **Filter extension**: the `wiredIds` filter now matches items where `(effects ?? []).length > 0 || (onUse ?? []).length > 0`. Pure-stub items (`effects: []`, `onUse: []`, no charges) still don't appear in either list, preserving the slice-240 audit posture ("content sessions can append wondrous items freely without tripping the snapshot").
- **Snapshot updated**: 6 additions to `wiredIds` (the items above). `withChargesIds` is unchanged. Three items (Wings of Flying, Staff of Healing, Wand of Magic Missiles) now appear in *both* lists, which is correct: they have both charges and onUse mechanics.

Pre-commit short audit (tests-only slice):

- **Names**: filter predicate now reads `effects > 0 || onUse > 0`. The disjunction is the rule: "wired = any shipped mechanical wiring." No new identifiers introduced.
- **DRY**: single filter expression, single source of truth for the wired classification. Inline disjunction is more readable than extracting an `isWired(item)` helper for one call site.
- **SRP**: snapshot still owns one job (audit which magic items have shipped mechanics). The two lists (`wiredIds`, `withChargesIds`) stay orthogonal; an item with both attributes appears in both, by design.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1649 tests across 244 files) green; snapshot diff is exactly the 6 onUse-wired items joining `wiredIds` (no spurious additions, no removals); `withChargesIds` byte-identical pre / post.

**Engine: variable `chargesCost` on `CastSpell` UseAction + Wand of Magic Missiles canonical user (slice 253)**

Closes the deferred-primitives row pointing at this primitive: Wand of Magic Missiles / Wand of Fireballs / Wand of Lightning Bolts / Staff of Healing's Cure Wounds arm all RAW-specify a variable per-use charge cost (1-3, 1-7, or 1-4 charges) that scales the cast slot level by the same amount. Slice 243 generalized fixed per-action `chargesCost`; this slice adds the variable shape on top.

**Plumbing**:

- New `chargesCostMax?: number` field on the `CastSpell` UseAction variant in [src/schemas/content/item.ts](src/schemas/content/item.ts). When set, the action is variable-cost: `chargesCost` becomes the *minimum* and `chargesCostMax` the maximum. Variable cost is only allowed on `CastSpell` (the only variant whose effect intensity has a per-charge scaling axis, slot level).
- New `chargesCost?: number` field on `UseItemIntent` in [src/engine/plan/use-item.ts](src/engine/plan/use-item.ts). The consumer's dial; required for variable-cost actions, optional for fixed-cost actions (but if passed, must equal the action's fixed cost).
- New `resolveActionCharge(action, intent, itemDefId)` helper that folds the dial into per-action resolution: returns `{ action, chargesCost, slotLevel? }`. For variable CastSpell, computes `slotLevel = action.slotLevel + (intent.chargesCost - action.chargesCost)`. Throws on (a) variable action with no dial, (b) dial out of range, (c) dial-on-fixed-action mismatch.
- planUseItem's charge gate and emission loop now read from the dial-folded `resolvedActions` array so the charge total and effective slot use the right values.

**Content wired (1 magic item)**:

- **Wand of Magic Missiles** (uncommon, no attunement; 7 charges, recharge 1d6+1 at dawn) → `onUse: [{ kind: 'CastSpell', spellId: 'magic-missile', slotLevel: 1, chargesCost: 1, chargesCostMax: 3, castingClassId: 'wizard' }]`. RAW: spend 1-3 charges to cast Magic Missile at L1-L3.

**Future SRD users this unblocks** (shipped as content wires in slice 255):

- Wand of Fireballs (1-3 charges → L3-L5 Fireball).
- Wand of Lightning Bolts (1-3 charges → L3-L5 Lightning Bolt).
- Staff of Healing's Cure Wounds arm (1-4 charges → L1-L4 Cure Wounds). Wired as an additional `onUse` action with `actionId: 'cure-wounds'`.

**RAW deviations documented on the wand**:

- The "expend the last charge, roll 1d20; on a 1 the wand crumbles into ashes" degradation roll stays deferred (per-item degradation primitive doesn't exist yet; same shape as Staff of Healing's vanish roll and Wind Fan's 20% per-use tear).

Pre-commit Uncle Bob audit:

- **Names**: `chargesCostMax` mirrors the existing `chargesCost` shape from slice 243. Considered `chargesCostUpperBound`; picked `chargesCostMax` because it pairs cleanly as min/max with `chargesCost` as the implicit minimum.
- **DRY**: the per-action resolution logic lives in a single helper (`resolveActionCharge`) called once per fired action. The three validation messages are bespoke per failure mode (variable-without-dial / dial-out-of-range / dial-on-fixed-mismatch); merging them into one generic "invalid chargesCost" error would lose the consumer-facing specificity that slice 243 introduced.
- **SRP**: `resolveActionCharge` does one thing, fold the dial into a resolved action. The planner's emission loop reads the resolved record without needing to know about the dial. The schema change is purely additive (new optional field on `CastSpell` only).
- **Magic numbers**: `chargesCost: 1, chargesCostMax: 3` on Wand of Magic Missiles is RAW (SRD 5.2.1 `magic-items.md`). The slot scaling formula `slotLevel + (intent.chargesCost - action.chargesCost)` is the RAW pattern across all four canonical users, not a magic number.
- **`at`-threading**: unchanged from slice 241, single `nowIso()` resolved once and threaded through planCastSpell's inner intent.
- **Mechanical outcomes asserted**: 6 new unit cases. Wand at min cost (chargesCost=1 → slot 1, charge=1). Wand upcast (chargesCost=3 → slot 3, charge=3). Variable without dial throws. Dial out of range (above 3, below 1) throws. Insufficient charges (2 remaining, needs 3) throws. Fixed-action with mismatching dial throws (Wings of Flying, slice 240). Matching fixed-cost dial still works.
- **Tests**: 23 cases total in [tests/unit/engine/plan-use-item.test.ts](tests/unit/engine/plan-use-item.test.ts) (was 17). No new event types so no `formatEvent` case needed. No new RNG-capture test needed: planCastSpell already has RNG-capture coverage and the new path is pure delegation with a different slot-level argument. Full suite 1649 tests across 244 files (was 1643), all green.

**Open follow-ups (none critical)**:

- The feature-coverage matrix at [tests/coverage/features.test.ts](tests/coverage/features.test.ts) classifies magic items as "wired" based on the `effects` array only; `onUse` wires (slices 240-243 + 253) are invisible to the matrix. The unwired-items list still shows `wand-of-magic-missiles` (and the other onUse-wired items: `wings-of-flying`, `boots-of-speed`, `boots-of-levitation`, `hat-of-disguise`, `staff-of-healing`) as if nothing happened. A snapshot fix that counts items with non-empty `onUse` would close this hole; not done here to keep the slice focused on the primitive.
- Variable cost on the `Toggle` and `ApplyCondition` UseAction variants stays deliberately unsupported. Neither has a per-charge scaling axis. If a future canonical user needs variable cost on those kinds, the same helper can be extended.

**Docs + infra: alpha.6 slice detail archived + archive-path correctness sweep (slice 252)**

Two same-shape cleanups:

1. **Alpha.6 slice detail archived.** Slice 251 promoted `## Unreleased` to `## 0.1.0-alpha.6` but left the slice 241-250 per-slice detail in the live CHANGELOG, putting the file at 52 KB (~8 KB headroom under the single-Read ceiling). This slice moves that detail to [docs/changelog/archive-slices-241-250.md](docs/changelog/archive-slices-241-250.md), following the slice-248 archive pattern. Live CHANGELOG drops to ~5 KB.
2. **Archive-link path correctness sweep.** The slice 248 split shipped 11 archive files with root-relative paths like `[src/engine/plan/use-item.ts](src/engine/plan/use-item.ts)`. These resolve fine in the Claude Code Read tool (paths are treated as text) but break on GitHub, where the path is interpreted relative to the archive file's location (`docs/changelog/src/engine/...` → 404). 207 broken links across 14 archive files (including the new `archive-slices-241-250.md` and `released-versions.md`) had `../../` prepended via a sed sweep. Sibling-archive refs and existing `../../` paths were left untouched.

What changed:

- New [docs/changelog/archive-slices-241-250.md](docs/changelog/archive-slices-241-250.md) (~50 KB, single-Read-fittable). Carries slices 241-250 verbatim from the live CHANGELOG. Header matches the existing `archive-slices-*.md` pattern.
- Live CHANGELOG.md: slice 241-250 detail removed from under `## 0.1.0-alpha.6`. The scope paragraph points at the new archive. The archive pointer block at the bottom gets a new top row.
- 207 root-relative paths across 14 archive files prepended with `../../`. Categories swept: `src/`, `tests/`, `docs/`, `.github/`, `examples/`, `references/` paths (191 links), plus root-level files (`CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `DEVELOPMENT.md`, `NOTICE`, `.gitignore`) (16 links). 8 sample paths resolve correctly from `docs/changelog/` after the sweep.

Pre-commit short audit (doc slice):

- **Names**: `archive-slices-241-250.md` follows the existing `archive-slices-NNN-MMM.md` convention.
- **DRY**: the slice 241-250 detail now lives in one place. The alpha.6 release headline-summary stays in live CHANGELOG.md as the front-door overview.
- **Why the link sweep belongs in this slice**: the new archive was about to ship with the same broken root-relative paths the existing archives carry (matching the slice 248 convention). Catching this surfaced that all 14 archive files had the same issue. Fixing only the new file would have widened the inconsistency; fixing all of them together is the same-shape work.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1643 tests across 244 files) green; live CHANGELOG.md fits in a single Read post-edit; `archive-slices-241-250.md` fits in a single Read; 8 spot-checked links resolve from `docs/changelog/` post-sweep; `grep -E '\]\(\.\./\.\./\.\./'` against `docs/changelog/` returns zero (no double-prefixing); the bare root-path grep across archives returns zero (no remaining broken refs).

## 0.1.0-alpha.6 - 2026-05-18

Cumulative post-alpha.5 release. 204 vocabulary-expansion slices (47-250) shipped since the alpha.5 line. Slice-by-slice detail for slices 241-250 lives in [docs/changelog/archive-slices-241-250.md](docs/changelog/archive-slices-241-250.md); older Unreleased entries (slices 48-240) were archived to per-cohort files under [docs/changelog/](docs/changelog/) in slice 248 (see the index below).

Headline changes since alpha.5:

- **Package and repo renamed** from `ttrpg-engine-dnd` to `dnd-srd-engine` (slice 247). The previous npm versions (alpha.0 through alpha.5) were unpublished on IP-cleanup grounds; no npm record exists under either name today. Consumers pin via git ref or local path.
- **SRD 5.2.1 pack-presence complete in every category**: 339/340 spells, 235/235 monsters, 275 magic items + 43 consumables, 9/9 species, 16/17 feats, 4/4 backgrounds (plus 17 PHB-2024 feats and 15 PHB-2024 backgrounds kept by policy). Mechanical wiring still grows: spell wiring ~42%, magic-item wiring ~15% (39 effective wires across magic items + consumables).
- **Effect-primitive vocabulary** expanded to 49 wired primitives plus the `Custom` escape hatch. Recent additions include `OverrideAbilityScore`, `GrantAdvantageVsBearersOfMyCondition`, `Regeneration`, `SpawnCreature`, plus the `ConsumeItem` planner and three `ConsumeAction` kinds (`Heal` / `ApplyCondition` / `CastSpell`) covering potions and spell scrolls.
- **SRD canon** now ships as a git submodule at `references/srd-markdown/` (slice 245). Web-source D&D content lookups explicitly forbidden in [CLAUDE.md](CLAUDE.md); enforced by the [SRD drift audit](tests/audit/srd-drift.test.ts) (slice 195) on script-detectable fields across spells, monsters, and magic items.
- **Fresh-agent discovery surface** polished: [AGENTS.md](AGENTS.md) + [.cursorrules](.cursorrules) cross-agent pointers (slice 247), single-Read ceiling enforced across front-door docs (slice 248), `starter-pack-gaps.md` split into per-category catalogs (slice 249), README top-level-dir map (slice 250).
- **Test count**: 1009 (at alpha.5) → 1643 across 244 files. New test layers: SRD drift audit (slice 195), feature-coverage matrix, public-API contract test, stateful combat-sequence property test (60-turn random fights, 6 invariants).

---

*Slice detail for slices 48-250 has been moved out of the live CHANGELOG to per-cohort archives under [docs/changelog/](docs/changelog/) (single-Read fitness; the alpha.6 release block of slices 241-250 was archived in slice 252; older slices were archived in slice 248). Each fits in a single Read tool call:*

- *[archive-slices-241-250.md](docs/changelog/archive-slices-241-250.md) — alpha.6 release block (slices 241-250)*
- *[archive-slices-235-240.md](docs/changelog/archive-slices-235-240.md)*
- *[archive-slices-217-234.md](docs/changelog/archive-slices-217-234.md)*
- *[archive-slices-201-216.md](docs/changelog/archive-slices-201-216.md)*
- *[archive-slices-196-200.md](docs/changelog/archive-slices-196-200.md) (also covers monster batches 5.x + subclass batches 1.x)*
- *[archive-slices-186-195.md](docs/changelog/archive-slices-186-195.md)*
- *[archive-slices-177-185.md](docs/changelog/archive-slices-177-185.md)*
- *[archive-monsters-batch-4.md](docs/changelog/archive-monsters-batch-4.md) — monsters batch 4.x*
- *[archive-items-batch-4.md](docs/changelog/archive-items-batch-4.md) — items batch 4.x*
- *[archive-slices-172-176.md](docs/changelog/archive-slices-172-176.md)*
- *[archive-content-batches-1.md](docs/changelog/archive-content-batches-1.md) — monsters batch 1.x + items batch 1.x*
- *[archive-rollup-narrative-A.md](docs/changelog/archive-rollup-narrative-A.md) — slices 48-171 rollup, first half*
- *[archive-rollup-narrative-B.md](docs/changelog/archive-rollup-narrative-B.md) — slices 48-150 rollup, second half + tail of Unreleased (### Fixed / ### Changed)*

*Released versions (alpha.0 through alpha.5) of the pre-rename package were moved to [docs/changelog/released-versions.md](docs/changelog/released-versions.md).*


## Released versions

Released versions (alpha.0 through alpha.5) of the pre-rename `ttrpg-engine-dnd` package live in [docs/changelog/released-versions.md](docs/changelog/released-versions.md). All were unpublished from npm in May 2026 on IP-cleanup grounds; the renamed `dnd-srd-engine` package has not yet cut a fresh release.
