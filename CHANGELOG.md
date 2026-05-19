# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The bump policy and pre-release roadmap are documented in [VERSIONING.md](VERSIONING.md).

## Unreleased

**Docs: README map of top-level dirs (slice 250)**

Closes the friction surfaced by the slice 247 fresh-agent test: a cold agent landing on the repo sees `dndbnb/`, `supabase/`, `web/`, `references/`, plus the agent-pointer files at the root, and has no signpost in `README.md` for what each one is. The `dndbnb/` consumer app and its `supabase/` backend are invisible from the front-door doc until the agent opens them. Pure documentation; no engine, schema, or content surface touched.

What changed:

- **README.md gains a "What lives in this repo" section** between Quick start and Documentation. Nine-row table covering `src/`, `tests/`, `docs/`, `examples/`, `references/srd-markdown/`, `web/`, `dndbnb/`, `supabase/`, and the agent-manual cluster (CLAUDE.md / AGENTS.md / .cursorrules). Each row says what the path is and, for co-located consumers, why it lives in the engine repo at all.
- Generated dirs (`dist/`, `dist-dndbnb/`, `dist-web/`, `coverage/`, `node_modules/`) and root config files skipped: either inferable or noise.
- README went 16,495 → 17,900 bytes. Comfortably under the single-Read ceiling.

Pre-commit short audit (doc slice):

- **Names**: section header is "What lives in this repo", matches the existing Documentation section's voice.
- **DRY**: no overlap with the Documentation table below; that one answers "which doc for which task," this one answers "what is each top-level path."
- **Placement**: between Quick start and Documentation because a reader has just run `npm test` and the next natural question is "what are these dirs?" before "which doc next?"
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1643 tests across 244 files) green; README still fits in a single Read.

**Docs + infra: starter-pack-gaps split into per-category catalogs (slice 249)**

Closes the deferral slice 248 explicitly flagged: `docs/starter-pack-gaps.md` was 410 KB / over the Claude Code Read tool's 256 KB hard ceiling, breaking step 4 of the fresh-agent quickstart. The doc is the canonical priority queue for next slices, so a fresh agent couldn't actually load it cold. This slice splits it into a slim top-level priority queue (57 KB, fits in a single Read) plus 12 per-category catalogs (each fits independently).

What changed:

- **docs/starter-pack-gaps.md**: 410 KB → 57 KB. Now contains only the actionable surface: header + "How to pick a slice" + "Relationship to other docs" + slim "Coverage at a glance" table (cells stripped from paragraph-length to 1-2 lines, with links into the per-category catalogs for detail) + the inline-tiny categories (Subclasses pointer, Species, Backgrounds, Feats, Conditions) + the full "Future engine slices" table + the full "Deferred primitives backlog" table + "How this list is maintained". The two priority-queue tables stay inline because they ARE step 3 and step 4 of the fresh-agent quickstart.
- **12 per-category catalogs created** under `docs/`:
  - `gaps-spells.md` (25 KB) — per-spell wired vs schema-only catalog at L0-L9.
  - `gaps-class-features.md` (32 KB) — per-class stub-features inventory + the Subclasses per-batch progression notes that were inline in the old gaps doc.
  - `gaps-items-batches-1.1-1.10.md` (36 KB) + `gaps-items-batches-1.11-1.20.md` (38 KB) — per-item RAW-shape catalog split at the batch 1.11 boundary.
  - `gaps-monsters-batches-5.9-5.11.md` (31 KB), `gaps-monsters-batches-5.6-5.8.md` (26 KB), `gaps-monsters-batches-5.1-5.5.md` (38 KB), `gaps-monsters-batches-4.8-4.14.md` (37 KB), `gaps-monsters-batches-4.1-4.7.md` (28 KB), `gaps-monsters-batches-1.md` (17 KB), `gaps-monsters-deferred-mechanics.md` (56 KB) — Monsters section was 228 KB (a third of the original doc); split by batch cohort + the per-RAW-trait deferral catalog. The five batch cohorts cluster by chronological era (5.x most recent, 4.x mid, 1.x earliest) with internal halving where a single cohort was over the ceiling.
- **CLAUDE.md "Doc size discipline"** section list extended: the index-type docs that must each fit in a single Read now explicitly include the `docs/gaps-*.md` per-category catalogs alongside the other size-checked docs.
- **Cross-references**: stale links among the new gaps files (a couple of "see gaps-monsters-batches-4.md" references that pointed at an intermediate filename) cleaned up. `grep -rn` confirms zero residuals.

Why the priority-queue tables stayed inline: the fresh-agent quickstart in [CLAUDE.md](CLAUDE.md) lists "Read the priority queue at docs/starter-pack-gaps.md" as step 4, with steps 3 and 4 being "jump to Future engine slices" and "also check Deferred primitives backlog" inside that doc. Splitting those tables out to a separate file would have added a hop. Instead the slim doc shed the detailed per-category catalogs (which only a contributor working on a specific category drills into) and trimmed the "Coverage at a glance" cells to single-line summaries.

Pre-commit Uncle Bob audit:
- **Names**: per-category file names follow a `gaps-<category>[-batch-range].md` pattern. Items split at the batch-1.11 boundary (rod / staff / wand cohort, distinct shape change from the earlier wondrous-item batches). Monsters split by batch cohort number (5.x / 4.x / 1.x) reflecting authorship era, with internal halving where the cohort overshot the ceiling.
- **DRY**: each per-category header carries a slice-249 provenance note and pointers to sibling files. The pointer lists are unique per file; the boilerplate header (slice provenance + main-doc link) is the only repeated pattern, intentionally so (gives the file context regardless of arrival path).
- **SRP**: the slim main doc owns the priority queue. Each per-category catalog owns one category's wired-vs-stub inventory. The "How to pick a slice" quickstart owns navigation. No file does two of these jobs.
- **Magic numbers**: file sizes are documented in the CHANGELOG entry, not in the headers, to avoid drift. The single-Read ceiling stays the canonical limit in CLAUDE.md.
- **at-threading**: N/A (no events).
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1643 tests across 244 files) passes green; every file from the split verifiably fits in a single Read (checked by attempting Read without offset/limit on each — the previously over-ceiling docs all return content now); `grep` against intermediate filenames confirms zero stale references.
- **Tests**: no test code changes. Doc reorganization only.

Open follow-ups (none critical):

- The slim top-level doc is 57 KB — comfortable but not generous. If "Future engine slices" or "Deferred primitives backlog" grows past another ~10 KB, those tables will need to move out. The Subclasses inline section was already moved this slice to make room.
- `gaps-monsters-deferred-mechanics.md` at 56 KB is the largest per-category file; future per-mechanic additions might push it over. Splitting by mechanic family (per-action vs per-trait vs per-aura) is a natural next cut if needed.

**Docs + infra: single-Read ceiling fits across front-door docs (slice 248)**

Closes the friction surfaced by the slice 247 fresh-agent test: the agent's first Read on `README.md` errored out because the file was over the Claude Code Read tool's ~25,000-token limit (68 KB / ~28 K tokens at the time). `CHANGELOG.md` was even worse (462 KB / ~130 K tokens). Same issue would have hit any future agent landing cold. Pure documentation reorganization; no engine, schema, or content surface touched.

What changed:

- **README.md**: 68 KB → 16 KB. Long "Status" / "Coverage at a glance" / "Known gaps" / "Test infrastructure gaps" sections moved to new [docs/status.md](docs/status.md) (25 KB). "Roadmap" Phase A-F catalog + post-alpha.5 narrative moved to new [docs/roadmap.md](docs/roadmap.md) (31 KB). README keeps brief 3-paragraph summaries pointing to each.
- **CHANGELOG.md**: 462 KB → 35 KB. The `## Unreleased` section grew to 2,392 lines (slices 48-247 in reverse chrono order); slices 48-240 archived to focused sub-files under [docs/changelog/](docs/changelog/), each fitting in a single Read. Recent slices 241-247 stay in the live CHANGELOG. Pre-rename released versions (alpha.0 through alpha.5) moved to [docs/changelog/released-versions.md](docs/changelog/released-versions.md).
- **11 archive files created** under [docs/changelog/](docs/changelog/): per-slice-range archives (`archive-slices-235-240.md`, `217-234`, `201-216`, `196-200`, `186-195`, `177-185`, `172-176`), per-content-cohort archives (`archive-content-batches-1.md`, `archive-monsters-batch-4.md`, `archive-items-batch-4.md`), and two narrative-rollup halves (`archive-rollup-narrative-A.md` for slices 48-171 first half, `archive-rollup-narrative-B.md` for slices 48-150 second half + `### Fixed` / `### Changed` tails). Plus `released-versions.md`. Each archive carries a header explaining its slice range, the original source, and pointers to sibling archives.
- **CLAUDE.md gained a new "Doc size discipline (the single-Read ceiling)" subsection** under "Working norms" documenting the ceiling (~25 K tokens / ~60 KB for our prose density), how to check, the splitting playbook (clean boundary → focused sub-doc → leave a pointer → update cross-refs → verify the new sub-doc also fits → CHANGELOG note), and a list of the index-type docs the constraint applies to. The existing "Doc updates per slice" list also updated to reflect the new doc structure (status.md and roadmap.md replace the README rows that moved out).
- **Cross-references updated** across every archive's "see also" line, the CHANGELOG.md pointer block, and the README references to the now-extracted sections. `grep -rn` confirms zero residual references to the intermediate filenames that existed during the split.

Why the ceiling matters: the slice 247 onboarding rollout (AGENTS.md, .cursorrules, the fresh-agent quickstart in CLAUDE.md) all assumed an agent could read the front-door docs in one tool call. Hitting an error on `README.md` undermines that whole design, so a clean agent loses confidence in the documentation surface immediately. Splitting trades whole-file readability for first-Read reliability; archive content stays accessible via offset/limit Reads or direct sub-file access.

Pre-commit Uncle Bob audit:
- **Names**: archive filenames follow a single convention (`archive-<scope>.md` where scope is either `slices-NNN-MMM`, `<category>-batch-N`, `rollup-narrative-X`, `content-batches-N`). Each scope intention-revealing without needing to open the file. `docs/status.md` and `docs/roadmap.md` use the simplest possible names for their content surface.
- **DRY**: each archive's header carries a short rationale, the slice range, and pointers to sibling archives. The rationale prose is similar across files but each is genuinely customized to its window's content (the slice 196-200 archive describes its specific content batches; the rollup archives describe their narrative-rollup nature). The "see also" pointer lists are unique per file.
- **SRP**: each archive holds one cohort (slice range, batch family, or rollup half). The live CHANGELOG holds only recent unreleased entries; released versions live separately; sub-cohorts of archives live in their own files. README is a landing page only; status and roadmap each own their own surface.
- **Magic numbers**: the ceiling itself is documented as "~25 K tokens" / "~60 KB" rather than an exact figure, since the bytes-to-tokens ratio drifts with content density. CLAUDE.md spells out the verification path (try `Read` without offset/limit; if it errors, split). Concrete byte counts of current files are in the live CHANGELOG entry, not in CLAUDE.md, to avoid drift over time.
- **at-threading**: N/A (no events).
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1643 tests across 244 files) passes green; `grep -rn` against the now-deleted intermediate filenames returns nothing; every front-door doc and every archive verifiably fits in a single Read (verified by attempting Read without offset/limit on each).
- **Tests**: no test code changes. The repo's discovery surface is documentation, not code; the test gate is that engine code keeps compiling and passing through the doc reorganization (it does).

Open follow-ups (deliberately deferred):

- **docs/starter-pack-gaps.md is 410 KB and already over the ceiling** (the Read tool returns "File content (409.8 KB) exceeds maximum allowed size (256 KB)" on a no-offset read). This is worse shape than the original CHANGELOG was. It's the canonical priority queue for next slices and is referenced in step 4 of the fresh-agent quickstart, so a fresh agent following the quickstart hits a hard error there too. **Punted to a dedicated slice** because the file's internal structure (per-spell catalog inside per-level inside per-category, with paragraph-length cells in the "Coverage at a glance" table) needs more thought than a mechanical line-range split: the right move is probably one slim top-level priority-queue doc plus per-category sub-docs, but each category has different shape (spells are catalog-heavy, items are wiring-heavy, monsters are mostly fine). Calling this out explicitly so the next slice owner doesn't miss it.
- **CONTRIBUTING.md** (7.8 KB) and **DEVELOPMENT.md** (5.7 KB) are both well under the ceiling today. The size-discipline note in CLAUDE.md covers them implicitly as "every index-type doc"; no per-file mention needed yet.
- The archive files themselves are append-mostly. As more slices land they'll be re-archived from the live CHANGELOG, but the existing archives are static once written.

**Rename: package and repo now `dnd-srd-engine` (slice 247)**

The package was previously named `ttrpg-engine-dnd`. With the legacy alpha.0-alpha.5 takedown going through on npm, the name became unrecoverable. Renamed to `dnd-srd-engine` — clearer about scope (SRD 5.2.1, not full PHB / DMG / MM) and npm-available.

What changed:

- `package.json` `name`, `repository.url`, `homepage`, `bugs.url` updated.
- `vite.config.ts` library name `DndSrdEngine` (was `TtrpgEngineDnd`) and bundle filename `dnd-srd-engine.${ext}` (was `ttrpg-engine-dnd.${ext}`).
- Repo-wide global find-and-replace across 56 source / config / doc / consumer-app files. Two patterns: `ttrpg-engine-dnd` → `dnd-srd-engine` (lowercase-hyphenated) and `TtrpgEngineDnd` → `DndSrdEngine` (PascalCase).
- `package-lock.json` regenerated via `npm install --package-lock-only` so the lockfile's own top-level `name` field matches.

What stays:

- The submodule URL `github.com/greghcarr/dnd-5e-srd-markdown` is unaffected (different repo, different purpose). The CC-BY-4.0 attribution inheritance is unchanged.
- Historical CHANGELOG entries' wording was updated to reference the new name for consistency. Git history preserves the actual rename slice (this one); past slices' textual references now align with current state rather than perpetuating the old name.
- The `dndbnb/` consumer app (also in this worktree) had its `ttrpg-engine-dnd` imports rewritten in the same sweep.

Coordinated manual steps (after this slice commits and lands on origin):

1. Rename the GitHub repo from `ttrpg-engine-dnd` to `dnd-srd-engine` (Settings → Repository name). GitHub auto-creates a redirect for the old URL.
2. Update the local git remote: `git remote set-url origin https://github.com/greghcarr/dnd-srd-engine.git`.
3. Rename the local working directory: `mv "Visual Studio Code/ttrpg-engine-dnd" "Visual Studio Code/dnd-srd-engine"`.
4. (Bonus, intentional) the auto-memory directory at `~/.claude/projects/-Users-greghcarr-Documents-Visual-Studio-Code-ttrpg-engine-dnd/` becomes orphaned — a Claude Code session opened in the new directory will create a fresh memory dir, which aligns with the planned fresh-agent test.

Pre-commit Uncle Bob audit:
- Names: `dnd-srd-engine` reflects the engine's actual scope (D&D, SRD 5.2.1). `DndSrdEngine` follows the same TitleCase pattern as the prior `TtrpgEngineDnd`. No surprise.
- DRY: a single global sed pass touched all 56 files at once instead of per-file edits, avoiding drift between references. Verified zero residuals via post-sweep grep.
- SRP: pure rename slice. No semantic engine / content changes; the diff is purely identifier substitution + lockfile regeneration.
- Magic numbers: N/A.
- at-threading: N/A.
- Mechanical outcomes asserted: tsc clean post-rename; full vitest suite (1643 tests) passes post-rename; package-lock.json's `name` field matches package.json's `name` field; no residual occurrences of the old name anywhere in the working tree (excluding the submodule, which is properly excluded from rename scope).
- Tests: no new test code. Existing test suite is the gate (any broken import path or type reference would surface here).

**Docs + infra: fresh-agent discovery polish (slice 246)**

Closes the gaps surfaced by the Uncle Bob audit of slices 244-245's onboarding refresh. No engine or content surface touched; this is a "make the fresh-agent test actually succeed" slice.

Six small fixes that compound:

1. **CLAUDE.md branch-from inconsistency.** Slice 244 said "branch off `main` or off `dev` (both fine)"; that's wrong because branching off `main` loses recent `dev` work. Corrected to "branch off `dev`" with the rationale inline.
2. **CLAUDE.md stale slice number.** The Goal section referenced "currently at slice 203"; we're far past that. Replaced the hardcoded number with a pointer to `git log --oneline | head -5` so the doc doesn't drift on every slice.
3. **README primitive-count drift.** The why-this-engine section said "About 25 declarative primitives"; the architecture section said "fixed vocabulary of 43"; the actual `EFFECT_KINDS` catalog is currently 49. Both prose mentions now read "around 50" with an authoritative pointer to [src/schemas/effects.ts](src/schemas/effects.ts), so future drift only requires the count detail row to update.
4. **CI submodule checkout.** [.github/workflows/ci.yml](.github/workflows/ci.yml) now passes `submodules: recursive` to `actions/checkout@v5`. Without this, the SRD drift audit at [tests/audit/srd-drift.test.ts](tests/audit/srd-drift.test.ts) self-skips on every CI run and SRD regressions silently land green. This was the most consequential gap from the slice-245 submodule rollout.
5. **AGENTS.md** at the repo root. Thin pointer to [CLAUDE.md](CLAUDE.md) so AI coding agents that don't auto-load `CLAUDE.md` (Codex CLI, Cursor, Continue, others) still find the working manual. Documents the cross-vendor agent-config conventions and explicitly tells an agent that can't read CLAUDE.md to refuse non-trivial changes.
6. **.cursorrules** at the repo root. Cursor-specific entry point. Summarizes the seven load-bearing rules from CLAUDE.md (quality bar, commit-don't-push, dev-branch, SRD canon, slice cadence, Uncle Bob audit, pre-commit checks) and points to the full working manual.
7. **docs/starter-pack-gaps.md** gains a "How to pick a slice" intro at the top. Previously opened with "Engine-internal accounting..." which was maintainer-voiced; now opens with a 5-step new-contributor flow that points back at [CLAUDE.md](CLAUDE.md) for the working norms, then explains the relationship between the "Future engine slices" and "Deferred primitives backlog" tables. The previous content-attribution.md cross-reference is preserved under a "Relationship to other docs" subhead.

Pre-commit Uncle Bob audit:
- Names: `AGENTS.md` matches the cross-vendor convention emerging from OpenAI Codex CLI and others; `.cursorrules` is Cursor's literal expected filename. Both are dot-or-uppercase to stand out at the repo root. No surprise naming.
- DRY: AGENTS.md and .cursorrules are thin pointers to CLAUDE.md, not duplicates. Each file's content tells the agent "this is a pointer; the canonical source is CLAUDE.md." `.cursorrules` does inline a 7-rule summary because Cursor's read of `.cursorrules` is gated and brief — readers might not click through. That's a deliberate redundancy with an explicit "these seven are a summary, not a replacement" note at the bottom. The drift risk is one file (`.cursorrules`); flagged for an annual / per-major-rev sync check.
- SRP: each new file has one job. AGENTS.md routes non-Claude agents. .cursorrules routes Cursor specifically. CI submodule flag enables the drift audit gate. CLAUDE.md and README edits each correct one specific staleness or inconsistency.
- Magic numbers: README primitive-count update uses "around 50" with a pointer to the authoritative `EFFECT_KINDS` rather than embedding an exact count that would drift. CLAUDE.md drops its slice-number reference for the same drift-resistance reason.
- at-threading: N/A (no events).
- Mechanical outcomes asserted: CI's `submodules: recursive` will be verified by the next PR's CI run picking up the submodule (the SRD drift audit should now report results instead of self-skipping). Fresh-agent test on a clean clone will exercise AGENTS.md / `.cursorrules` discoverability.
- Tests: no new test code. The existing SRD drift audit becomes an effective CI gate as a side effect of the checkout fix.

**Infra: SRD 5.2.1 markdown as git submodule (slice 245)**

Closes the blocker that prevented a fresh contributor from doing SRD-aligned content work. Previously `references/srd-markdown/` was gitignored and lived only on Greg's machine; a stranger cloning the repo had no documented path to obtain it. Now the directory lands as a git submodule pointing at [`github.com/greghcarr/dnd-5e-srd-markdown`](https://github.com/greghcarr/dnd-5e-srd-markdown) (CC-BY-4.0, derived from the Wizards-released SRD 5.2.1).

Contributors clone with `git clone --recurse-submodules` (or `git submodule update --init --recursive` post-clone) to populate the directory. The submodule is reference-only: the engine code under `src/` doesn't import from it at build or run time, no SRD-derived text is embedded in the published package, and the build / test pipeline still runs green without the submodule populated (the SRD drift audit skips itself when the directory is absent).

Plumbing:

- New `.gitmodules` at repo root registers `references/srd-markdown` → upstream URL. Submodule pinned at commit `1b4b99d` (master HEAD at the time of slice 245).
- [.gitignore](.gitignore) — the previous blanket `references/` ignore is replaced with a whitelist: `references/*` ignored, `!references/srd-markdown` un-ignored. Keeps the PDF source + Greg's local extraction artifacts out, lets the submodule pointer in.
- [NOTICE](NOTICE) gains section 3 documenting the submodule attribution + CC-BY-4.0 inheritance from the upstream repo's own LICENSE file. Trademarks section renumbered to 4.
- [CLAUDE.md](CLAUDE.md) "SRD is canon" section: the prior "ask the user to symlink it from the primary worktree" instruction (which only worked for Greg) is replaced with the submodule clone / update commands. The "SRD source of truth" detail section below it gets the same update.
- [DEVELOPMENT.md](DEVELOPMENT.md) gains a "First-time setup" section above "Commands" with the `--recurse-submodules` clone command and the post-clone init command.
- [README.md](README.md) Quick Start switches to `git clone --recurse-submodules` and explains what the flag pulls in.
- [CONTRIBUTING.md](CONTRIBUTING.md) "Before you start" step 4 updated with the submodule init command.

**Why a submodule rather than copying the markdown into the repo**: pure DRY. The upstream `dnd-5e-srd-markdown` repo is the canonical maintained copy; copying in would create a divergence trap (the engine repo would silently drift from upstream over time, and re-syncs would be heavy multi-MB-diff commits). Submodules let the engine pin to a known-good upstream commit while inheriting upstream improvements (typo fixes, formatting cleanups, new errata) explicitly when the maintainer chooses to bump.

**What this unblocks for fresh contributors**: any content slice that needs to cite RAW. Specifically: spell wirings (slices like 239), monster statblock authoring, magic item wirings (slices 240-243), class feature audits, condition definitions, the SRD drift audit's gate. Previously, all of this required Greg's worktree.

Pre-commit Uncle Bob audit:
- Names: `references/srd-markdown/` matches the upstream repo's natural directory name (`dnd-5e-srd-markdown` would also have worked but `srd-markdown` is shorter and contextually clear inside a `references/` parent). The submodule registration in `.gitmodules` uses the same `references/srd-markdown` path as the project tree (no surprise indirection).
- DRY: submodule chosen specifically to avoid the duplicate-content drift trap. The license attribution lives at the upstream repo's own LICENSE; NOTICE points there rather than embedding it (which would also drift).
- SRP: each file edited has one job. `.gitmodules` registers the submodule. `.gitignore` whitelists. NOTICE attributes. CLAUDE.md / DEVELOPMENT.md / CONTRIBUTING.md / README.md each update their own contributor-facing surface with the new clone command. None of the docs cross-define what another doc owns.
- Magic numbers: the pinned submodule commit `1b4b99d` is the only "magic number" — it's documented in the CHANGELOG and the submodule's own log lets a reviewer verify it matches the upstream `master` branch HEAD at slice time. Future submodule bumps will be explicit slice commits, not silent drift.
- at-threading: N/A (no events).
- Mechanical outcomes asserted: `git clone --recurse-submodules` on a fresh checkout populates `references/srd-markdown/` with the SRD markdown files (verifiable by `ls references/srd-markdown/*.md` after init). The build / test pipeline runs green both with and without the submodule populated (the drift audit's self-skip is the gate). The PDF source stays out of the repo (heavy, not the canonical surface).
- Tests: no new test code. The existing SRD drift audit at [tests/audit/srd-drift.test.ts](tests/audit/srd-drift.test.ts) now has a discoverable populate-path for fresh contributors; this slice doesn't change its behavior, just removes the friction that prevented it from running on someone else's machine.

**Docs + workflow: onboarding refresh + dev-branch convention (slice 244)**

Pure documentation and workflow change; no engine or content surface touched. Two motivations:

1. Establish a `main` + `dev` branch convention so slice work lands on `dev` and `main` stays at clean release checkpoints. Previously slice work was committed directly to `main`. The transition: `dev` was branched off `main` at slice 243 (commit `7b9a747`); going forward, slice commits land on `dev`. The user (Greg) merges `dev` into `main` on his cadence.
2. Make the working norms discoverable by any AI agent (or human contributor) opening the repo cold. Previously several load-bearing norms lived only in the project author's personal global config or in the AI agent's per-session memory; now they live in the repo's tracked docs.

Changes:

- [CLAUDE.md](CLAUDE.md) — new top-level sections: "Quality bar" (states the *incorrect code is worse than no code* standard), "Fresh-agent quickstart" (the order-of-operations for any new agent / contributor), "Working norms" (branch structure, commit-don't-push, SRD-as-canon, slice cadence, pre-commit Uncle Bob audit, doc updates per slice, pre-commit checks). The "Library-quality bar (internal working note)" section is reframed as "Engineering standards" with the public-vs-internal framing kept intact.
- [DEVELOPMENT.md](DEVELOPMENT.md) — Branches section expanded with the working flow (start on dev, commit early, pre-commit checks, never touch main without explicit instruction) plus branch-from rules (parallel worktrees target dev).
- [CONTRIBUTING.md](CONTRIBUTING.md) — new "Quality bar" section up top, new "Working with an AI agent" section pointing agents to CLAUDE.md's fresh-agent quickstart, and the existing "Commit and PR style" section gains the dev-branch + Uncle Bob audit conventions.
- [README.md](README.md) — "Contributing" section rewritten as a pointer to CLAUDE.md / CONTRIBUTING.md / DEVELOPMENT.md / starter-pack-gaps.md / slice-template.md; test count refreshed to 1643 / 244 files.

What the new norms surface that wasn't previously tracked in the repo:

- The "commit, don't push" rule, previously only in the project author's `~/.claude/CLAUDE.md` (Claude Code's user-level config). Now load-bearing in the project's CLAUDE.md so any agent or human picks it up automatically.
- The Uncle Bob pre-commit audit checklist (names, DRY, SRP, magic numbers, at-threading, mechanical outcomes asserted, tests). Previously only in the AI agent's per-session memory and applied informally; now mandatory and codified.
- The branch convention (slice work → `dev`; `main` is for stable releases). Previously the repo had a 2-line mention in DEVELOPMENT.md; now load-bearing.
- The SRD-is-canon rule, previously implicit; now explicit with the do-not-WebFetch reminder.
- The fresh-agent quickstart, a 5-step onboarding sequence for any new contributor.

Why this matters: previously, the conventions that kept code quality high were partly stored in environments outside the repo (the author's personal Claude config, an AI agent's session memory). A fresh AI agent or new human contributor would not see them and could ship correct-looking but rule-incorrect code. The repo's documentation now stands alone as the single source of working norms.

Pre-commit Uncle Bob audit:
- Names: section headers are intention-revealing ("Quality bar", "Fresh-agent quickstart", "Working norms"). Document-level naming follows the existing convention of CLAUDE.md / CONTRIBUTING.md / DEVELOPMENT.md.
- DRY: the same norms appear in multiple docs at different framings (CLAUDE.md detailed, CONTRIBUTING.md contributor-focused, DEVELOPMENT.md command-focused). This is deliberate — each doc has a distinct audience and the conventions are load-bearing enough to repeat the key pointers. Cross-references via markdown links keep them in sync.
- SRP: each doc has one job. CLAUDE.md is the agent / author working manual. CONTRIBUTING.md is the contributor-facing onboarding. DEVELOPMENT.md is the command + branch reference. README.md stays public-facing.
- No magic numbers introduced. No engine code touched.
- Tests: no test changes. tsc and full vitest suite remain green (verified pre-commit).
- Mechanical outcomes: the working norms are now discoverable by a fresh agent on the first read; the branch convention is committed to dev; the Uncle Bob audit shape is documented in three places (CLAUDE.md as primary, CONTRIBUTING.md as link, slice-template.md unchanged but unchanged-and-still-correct on the audit step).

**Engine: action-selector + per-action chargesCost + Staff of Healing (slice 243)**

Generalizes slice 240's UseItem from "fire all onUse actions, charge 1 per use" to "fire one of N onUse actions (consumer-selected), charge that action's chargesCost." Two new fields on each `UseAction` variant: `actionId` (consumer-facing selector) and `chargesCost` (defaults to 1). One new field on `UseItemIntent`: `actionId` (matches against the action's `actionId`; required for multi-action items, optional for single-action items).

Canonical user: Staff of Healing, a rare staff with 10 charges that offers three spell arms at different fixed costs. Slice 243 wires the two fixed-cost arms; the variable-cost Cure Wounds arm (1-4 charges → slot 1-4) defers to slice 244.

**Plumbing**:

- `actionId?: string` and `chargesCost?: number` on all three UseAction variants (ApplyCondition / CastSpell / Toggle) in [src/schemas/content/item.ts](src/schemas/content/item.ts).
- `actionId?: string` on `UseItemIntent` in [src/engine/plan/use-item.ts](src/engine/plan/use-item.ts).
- New `selectFiredActions(onUse, actionId, itemDefId)` helper resolves which action(s) to fire. Single-action items keep slice-240 back-compat (no actionId required). Multi-action items REQUIRE actionId on the intent or throw with a helpful "available: X, Y, Z" message.
- Charge gate generalized: instead of charging 1 per use of the item, the planner sums `chargesCost` (defaulting to 1) across fired actions and emits a single `ItemChargeConsumed` for the total. Insufficient-charges error reports both "has N remaining, needs M".

**Content wired (1 magic item, 2 spell arms)**:

- **Staff of Healing** (rare staff, 10 charges, dawn recharge 1d6+4)
  - `lesser-restoration` action: CastSpell `lesser-restoration` L2, **chargesCost: 2**, castingClassId: cleric
  - `mass-cure-wounds` action: CastSpell `mass-cure-wounds` L5, **chargesCost: 5**, castingClassId: cleric

Both target spells are wired in the engine (slice 47 / 76 era), so the cast actually fires the heal chain — the most mechanically-active UseItem canonical user yet.

**Deferred**:

- **Staff of Healing's Cure Wounds arm** — variable 1-4 charges → slot 1-4. Needs the variable-chargesCost shape (slice 244).
- **Wand of Magic Missiles** — variable 1-3 charges → slot 1-3 (3-5 darts). Same variable-cost shape.
- **Wand of Fireballs / Wand of Lightning Bolts** — variable 1-7 charges → slot 3-7. Same shape.
- **Staff of Healing's "if you expend the last charge, roll 1d20; on a 1 the staff vanishes"** — per-item degradation roll primitive. Defer until a second item needs it (Wind Fan's 20% per-use tear shape is similar).
- **Staff of Healing's "using your spellcasting ability modifier"** — engine uses castingClassId='cleric' as parity convention; the wielder's actual class isn't consulted. Same shape as slice 237 scroll wirings.

Pre-commit Uncle Bob audit:
- Names: `actionId` (consumer-facing selector) and `chargesCost` (per-action cost) match the existing pack-side vocabulary. Considered `key` or `id` for the selector; picked `actionId` to disambiguate from `instanceId` and to be self-describing in JSON.
- DRY: the `actionId` + `chargesCost` field pair is duplicated across all three UseAction variants (ApplyCondition / CastSpell / Toggle). Considered extracting a `UseActionBase` shared shape; declined because Zod's `z.discriminatedUnion` doesn't compose cleanly with shared optional fields (the consumer of `UseAction` types would lose the discriminated-narrowing). Three duplicated optional fields × three variants is below the abstraction threshold.
- SRP: `selectFiredActions` does one thing — resolve which actions to fire. Charge computation lives in the main planner. The "actionId required" gate is a single helpful throw with the available IDs listed. The planner body itself didn't gain new responsibilities; the action loop just iterates a smaller `firedActions` array instead of `def.onUse`.
- Magic numbers: chargesCost values (2 for Lesser Restoration, 5 for Mass Cure Wounds) are RAW-derived from the Staff of Healing SRD table. No new engine-side magic numbers introduced.
- `at`-threading: still single `nowIso()` resolution; unchanged from slice 240.
- Error messages: include the offending value AND the available alternatives (`"has no action with id 'X'; available: A, B"`, `"has 4 charges remaining, needs 5"`). Future tightening: emit the action's `actionId` in the ItemChargeConsumed `forEffect` field so the journal records which arm fired (currently records `use:<itemId>` without per-action granularity — flagged as a TODO if a transcript ever needs it).
- Back-compat: slice 240's single-action items (Wings of Flying, Boots of Speed, Hat of Disguise, Boots of Levitation) all work without changes (no actionId on the intent, no chargesCost on the action → chargesCost defaults to 1, exactly as before).
- Mechanical outcomes asserted: 6 new unit cases. Mass Cure Wounds happy path (5 charges spent, wired spell cast emits SpellCastDeclared). Lesser Restoration happy path (2 charges spent, instance persists). Multi-action without actionId throws with available-ids message. Unknown actionId throws. Insufficient charges (4 remaining, needs 5) throws. Single-action back-compat verified via Wings of Flying. Total 17 cases in [tests/unit/engine/plan-use-item.test.ts](tests/unit/engine/plan-use-item.test.ts).

**Engine: `Toggle` UseAction variant + Boots of Speed canonical user (slice 242)**

Extends slice 240's `UseAction` union with `Toggle { conditionId }`. The planner inspects the target's current applied conditions: if the conditionId is already present, emit `ConditionRemoved` (click-off); otherwise emit `ConditionApplied` (click-on). Distinct semantic from `ApplyCondition`, which always applies (the reducer dedupes by id but the per-use intent stays "always activate") — `Toggle` is the explicit two-state semantic for click-on / click-off magic items. Unblocks Boots of Speed and lays the foundation for any future click-toggle item.

**Plumbing**:

- New `Toggle` variant on `UseActionSchema` in [src/schemas/content/item.ts](src/schemas/content/item.ts): `{ kind: 'Toggle', conditionId: string }`.
- New Toggle branch in [src/engine/plan/use-item.ts](src/engine/plan/use-item.ts) — reads the target's `appliedConditions`, dispatches to `ConditionApplied` or `ConditionRemoved` based on presence. Source is stamped on the apply path so future source-filtering (if a future Toggle variant needs to ignore conditions sourced elsewhere) is a clean follow-up.
- New content-side condition `boots-of-speed-active` in [src/content/packs/starter-pack.json](src/content/packs/starter-pack.json) carrying `ModifySpeed { mode: 'walk', op: 'multiply', value: 2 }`.

**Content wired (1 magic item)**:

- **Boots of Speed** (rare, attunement; no charges) → `onUse: [{ kind: 'Toggle', conditionId: 'boots-of-speed-active' }]`. Click → speed doubled; click again → speed back to normal. The boots persist after each use; instance never retires.

**RAW deviations documented on the condition**:

- The RAW "Disadvantage on opportunity attacks against the wearer" arm stays narrative — needs an `event.isOpportunityAttack` predicate fact that the engine doesn't yet carry on AttackRolled (only the slice-123 `event.attackKind` melee / ranged distinction landed). Same shape as Mantle of Spell Resistance's deferred per-source SetAdvantage predicate (`event.isSpellSave`).
- The RAW cumulative-10-minute-per-long-rest budget stays consumer-managed (the engine's auto-expiry is round-based + source-keyed, not minute-budgeted). Documented in the condition description.
- Action-economy cost not modeled (RAW: bonus action; engine doesn't model bonus-action consumption at item-use level — same shape as slice 240 / 241).
- Attunement gate not enforced (same shape as slice 240 / 241).

**Future SRD users this unblocks**:

- Any click-toggle item — once a canonical user comes online, it's a 1-line content wire `[{ kind: 'Toggle', conditionId }]` plus the content-side condition.
- Cap of Water Breathing's "action to activate / 1-hour duration" shape is close but not the same — that's a duration-bound apply, not a toggle.
- Driftglobe's continuous-light-radius toggle once the engine carries a light primitive.

**Deferred (still need new UseAction variants or other primitives)**:

- **Wand of Magic Missiles** — still needs per-action `chargesCost` override on UseAction for the variable-cost (1-3 charges = slot 1-3) shape. Slice 240's planner still consumes exactly 1 charge per use.
- **Helm of Telepathy** — Detect Thoughts at-will + Suggestion 1/dawn split needs per-action chargesCost differentiation; same shape.
- **Pipes of Haunting** — item-fixed-DC save variant still deferred.
- **Boots of Speed's "Disadvantage on opportunity attacks against wearer"** — needs `event.isOpportunityAttack` fact on AttackRolled (or `bearer.opportunityAttackDisadvantage` flag in the effect stack).
- **Boots of Speed's cumulative 10-minute budget** — needs a minute-tracking shape distinct from rounds and charges.

Pre-commit Uncle Bob audit:
- Names: `Toggle` is the standard term for two-state action semantics; chosen over `ToggleCondition` because the action set's discriminator implies the resource is a condition (parallel to slice 240's `ApplyCondition` and slice 241's `CastSpell`).
- DRY: the Toggle branch's "emit ConditionApplied" path is identical to the slice-240 ApplyCondition branch (same field set, same source stamping). Considered extracting a shared helper; declined because the two branches' semantic intent diverges (ApplyCondition always applies; Toggle's apply is the conditional half). Single-call-site duplication of 8 lines is below the threshold for abstraction.
- SRP: planner does one thing per action kind; Toggle's apply / remove split is the action's natural shape, not a hidden side effect. The condition's effects (ModifySpeed) live in the condition, not the action.
- Magic numbers: no new magic numbers. The `ModifySpeed value: 2` on `boots-of-speed-active` is RAW (walking speed × 2). The cumulative 10-minute budget would be a magic number once that primitive lands; documented as a deferred row in the gaps doc.
- `at`-threading: single `nowIso()` resolved once, used for both ConditionApplied and ConditionRemoved emit paths. No double-resolution.
- Mechanical outcomes asserted: first click applies, second click removes, third click re-applies (full cycle); boots persist across uses (no charges path means no charge decrement); source stamp on the applied condition tracks the user.
- Tests: 3 new unit cases in [tests/unit/engine/plan-use-item.test.ts](tests/unit/engine/plan-use-item.test.ts). Total 11 cases in the file. No new RNG dependency (Toggle is a deterministic state inspection); the existing `rng` parameter is unused on the Toggle path but threaded for parity with the CastSpell path.

**Engine: `CastSpell` UseAction variant + at-will spell-grant items (slice 241)**

Extends slice 240's `UseAction` union with `CastSpell { spellId, slotLevel, castingClassId? }`. The planner branch delegates to `planCastSpell` with slice-219's `noSlotCost: true` + slice-220's `ignorePreparation: true` — the item supplies the slot, the item itself bypasses the prepared-spells gate. Mirror of slice 237's ConsumeAction CastSpell shape for the magic-item side. Unblocks the at-will spell-grant items cohort.

**Plumbing**:

- New `CastSpell` variant on `UseActionSchema` in [src/schemas/content/item.ts](src/schemas/content/item.ts) with the same `{ spellId, slotLevel, castingClassId? }` shape as the slice-237 ConsumeAction variant.
- New `castTargetIds?: ReadonlyArray<string>` field on `UseItemIntent`. Used by CastSpell variants to supply the spell's targets; defaults to `[characterId]` for self-buff spell-grant items (the typical RAW shape — Boots of Levitation casts Levitate on the wearer, Hat of Disguise casts Disguise Self on the wearer).
- `planUseItem` signature gains `rng: RNG` (required by `planCastSpell`). Engine surface threads `rng` through at the same call site as `planConsumeItem`.

**Content wired (2 magic items)**:

- **Hat of Disguise** (uncommon, attunement; at-will, no charges) → `CastSpell disguise-self 1 wizard`
- **Boots of Levitation** (rare, attunement; at-will, no charges) → `CastSpell levitate 2 wizard`

Both target spells are schema-only in the engine today, so the cast records a `SpellCastDeclared` for journal / replay but no mechanical chain fires — same shape as slice-239's potion-of-animal-friendship / potion-of-mind-reading wires.

**RAW deviations**:

- `castingClassId: 'wizard'` is a parity convention with the slice-237 scroll wires; the engine computes spell DC / attack from the consumer's INT, not the RAW per-item DC (Hat of Disguise RAW is a fixed effect with no save; Boots of Levitation RAW casts Levitate with a fixed save DC tied to the wearer's stats in some interpretations).
- No attunement gate (both items require attunement per RAW; the planner doesn't check it — same shape as slice 240).
- No action-economy cost (both items are an action per RAW; the engine doesn't model that at item-use level — same shape as slice 240).
- Duration consumer-managed (Disguise Self lasts 1 hour, Levitate is concentration 10 minutes — neither rides on the engine's auto-expiry).
- Hat of Disguise's "no components needed" is implicit (the spell-grant path doesn't enforce material components anyway).

**Deferred (still need new UseAction variants or other primitives)**:

- **Wand of Magic Missiles** — needs per-action `chargesCost` override on UseAction (RAW casts Magic Missile at level X by spending X charges). Slice 240's planner consumes exactly 1 charge per use.
- **Wand of Fireballs / Lightning Bolts / Web** — same variable-charge shape.
- **Wand of Polymorph** — Polymorph has a dedicated planner; same deferral as slice-237's Spell Scroll of Wish / Misty Step.
- **Pipes of Haunting** — RAW is a bespoke save mechanic (DC 15, fixed), not a spell cast; needs an item-fixed-DC save variant on UseAction.
- **Boots of Speed** — needs the `Toggle` UseAction variant + cumulative-minute budget.
- **Cloak of the Bat** — needs `CastSpell` (for Polymorph-to-Bat — dedicated planner deferral) plus the slice-227 light-level predicate.
- **Helm of Telepathy / Decanter of Endless Water** — both are CastSpell-pattern but need the per-charge gate (Helm of Telepathy specifically uses charges per use) or a fixed-effect catalog (Decanter's three command words).

**Future SRD users this unblocks**: any future at-will spell-grant magic item maps to a 1-line content wire `[{ kind: 'CastSpell', spellId, slotLevel, castingClassId }]` once authored.

Pre-commit Uncle Bob audit:
- Names: `UseAction.CastSpell` mirrors `ConsumeAction.CastSpell` from slice 237. Same field set, same semantics. Future divergence (per-action `chargesCost` override) is the only reason the two unions aren't unified — see DRY note below.
- DRY: planUseItem's CastSpell branch is a near-copy of planConsumeItem's CastSpell branch (slice 237). Considered extracting a shared `applyCastSpellFromItem(state, content, rng, intent, action, targetIds, at)` helper — declined for now because the two callers diverge in `castTargetIds` defaults (planConsumeItem defaults to `[consumer]`, planUseItem defaults to `[user]` — currently the same since both are self-cast, but the action-economy framing differs: feeding-a-potion-to-an-ally is a recognized RAW shape; using-a-magic-item-on-an-ally is less standard). Re-evaluate if a third caller lands.
- SRP: planUseItem still does one thing per action kind; no new concerns introduced. The CastSpell branch delegates to `planCastSpell` which owns the actual spell-cast resolution.
- Magic numbers: castingClassId is hard-coded to `'wizard'` on both wired items. This is a parity convention with slice 237's scroll wires and is documented in the schema comment. Each item's slotLevel (1 for Disguise Self, 2 for Levitate) is RAW-derived (the lowest slot at which the spell becomes available).
- `at`-threading: single `at = intent.at ?? nowIso()` resolved once and passed to planCastSpell via the inner intent. No double-resolution.
- Mechanical outcomes asserted: SpellCastDeclared emits; no SpellSlotConsumed (noSlotCost honored); no ItemChargeConsumed (items have no charges); ItemUsed lands; Barbarian non-caster path works (ignorePreparation honored).
- Tests: 2 new unit cases (Boots of Levitation happy path with no-charges + no-slot-cost assertion; Hat of Disguise with Barbarian non-caster). Total 8 cases in [tests/unit/engine/plan-use-item.test.ts](tests/unit/engine/plan-use-item.test.ts). No new RNG-capture test needed (planCastSpell's RNG-capture path is already covered in cast-spell tests; the UseAction CastSpell branch is pure delegation).


---

*Older Unreleased entries (slices 48-240) were archived in slice 248 to keep this file under the single-Read ceiling. See the [docs/changelog/](docs/changelog/) directory; each archive fits in a single Read tool call:*

- *[archive-slices-235-240.md](docs/changelog/archive-slices-235-240.md) — most recent archived block*
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
