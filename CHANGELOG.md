# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The bump policy and pre-release roadmap are documented in [VERSIONING.md](VERSIONING.md).

## Unreleased

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
