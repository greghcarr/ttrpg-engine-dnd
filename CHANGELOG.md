# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The bump policy and pre-release roadmap are documented in [VERSIONING.md](VERSIONING.md).

## Unreleased

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

**Future SRD users this unblocks** (now content-only follow-ups):

- Wand of Fireballs (1-7 charges → L3-L9 Fireball).
- Wand of Lightning Bolts (1-7 charges → L3-L9 Lightning Bolt).
- Staff of Healing's Cure Wounds arm (1-4 charges → L1-L4 Cure Wounds). Wire as an additional `onUse` action with `actionId: 'cure-wounds'`.

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
