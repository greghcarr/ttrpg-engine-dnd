# Parallel authoring with git worktrees

When engine-slice work and content authoring (monsters, magic items, future bulk content) can both make useful progress, run them in parallel via two git worktrees, two VS Code windows, and two Claude Code chats. The two sessions share git history but hold independent working files on different branches.

The engine session stays on `main` in the primary worktree. The content session lives in a sibling worktree directory on its own short-lived branch. At coordination points the content branch merges back to `main`.

## Setup

From the primary worktree's terminal:

```bash
git worktree add ../ttrpg-engine-dnd-content -b content/authoring-batch-1
code ../ttrpg-engine-dnd-content
```

In the new VS Code window's terminal:

```bash
npm install
npx vitest run
```

`npm install` is required because `node_modules` is gitignored and per-worktree. Confirm the suite is green (193 files, ~1378 tests as of slice 124) before starting Claude in the new window.

For subsequent batches, after merging batch N back to `main`, branch off again from inside the worktree: `git checkout main && git pull && git checkout -b content/authoring-batch-2`. Or reuse the same branch name if you removed the worktree at cleanup.

## File-footprint discipline

This is what keeps the two sessions from clobbering each other. The forbidden lists are enforced by convention, not tooling, so both sessions read them at the start of each slice.

### Engine session (primary worktree, `main`)

Allowed:
- All of `src/engine/`, `src/derive/`, `src/schemas/`, `src/effects/`, `src/handlers/`, `src/migrations/`, `src/rng/`, `src/internal/`, `src/index.ts`
- `src/content/packs/starter-pack.json` — spells, conditions, classes, subclasses, species, backgrounds, feats arrays
- All `tests/`
- All shared docs (`CHANGELOG.md`, `docs/starter-pack-gaps.md`, `docs/api-overview.md`, `README.md`, `CLAUDE.md`)

### Content session (sibling worktree, `content/authoring-batch-N`)

Allowed:
- `src/content/packs/starter-pack.json` — `monsters` and `items` arrays only, append-only, no modification of existing entries
- `docs/starter-pack-gaps.md` — Monsters and Items sections plus their rows in the "Coverage at a glance" table
- `CHANGELOG.md` — a clearly-labeled content subhead under `## Unreleased`

Forbidden:
- All of `src/engine/`, `src/derive/`, `src/schemas/`, `tests/`. If a content entry needs a schema field that doesn't exist, document the deferral in the gaps doc and skip the entry; do not extend the schema.
- `README.md` — the engine session owns it; coverage-count edits there happen at merge time.
- `CLAUDE.md` and the auto-memory directory.
- `tests/coverage/__snapshots__/features.test.ts.snap` — for pure monster/item additions this snapshot shouldn't move. If it does, stop and surface the diff; do not refresh with `-u` until coordinated with the engine session.

## Starter prompt for the content session

Paste this into the new Claude Code chat in the content worktree's VS Code window:

```
We're running a parallel content-authoring session for ttrpg-engine-dnd in a separate git worktree. The engine session is on `main` in another VS Code window. This session is on branch `content/authoring-batch-1` in worktree `../ttrpg-engine-dnd-content` and is restricted to pure content additions (monsters and magic items). No engine code, no schema changes, no planner edits.

Confirm setup before starting: run `git status` (should show clean working tree), `git branch --show-current` (should print `content/authoring-batch-1`), and `pwd` (should end in `ttrpg-engine-dnd-content`).

Allowed edits:
- `src/content/packs/starter-pack.json` — appending entries to the `monsters` and `items` arrays only. Do not modify the spells, conditions, classes, subclasses, species, backgrounds, or feats arrays. Do not modify existing entries.
- `docs/starter-pack-gaps.md` — the Monsters and Items sections plus their rows in the "Coverage at a glance" table only.
- `CHANGELOG.md` — add a clearly-labeled subhead (e.g. `**Content authoring batch 1: N monsters / M items**`) under `## Unreleased`. Don't touch engine-slice entries.

Forbidden:
- All of `src/engine/`, `src/derive/`, `src/schemas/`, `tests/`. If a content entry needs a schema field that doesn't exist, document the deferral in the gaps doc and skip the entry; do not extend the schema.
- `README.md` — the engine session owns it; coverage-count edits there happen at merge time.
- `CLAUDE.md` and any auto-memory files.
- `tests/coverage/__snapshots__/features.test.ts.snap` — for pure monster/item additions this snapshot shouldn't move. If it does, stop and surface the diff rather than refreshing with `-u`.

Slice cadence (same as engine sessions):
1. Pick a batch by reading [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) Monsters / Items sections and the existing entries in [src/content/packs/starter-pack.json](src/content/packs/starter-pack.json).
2. Add the JSON entries matching the schemas:
   - Monsters: [src/schemas/content/monster.ts](src/schemas/content/monster.ts). Existing reference entries to copy: Goblin, Orc, Wolf, Skeleton, Ogre, Young Red Dragon.
   - Magic items: [src/schemas/content/item.ts](src/schemas/content/item.ts), `itemKind: 'magic'` + `rarity`. Existing reference entries: Bag of Holding, Wand of Magic Missiles, Cloak of Protection.
3. Update the gaps doc Monsters / Items sections and bump the relevant "Coverage at a glance" counts.
4. Add a CHANGELOG entry under `## Unreleased`.
5. `npx vitest run` — full suite green. The content-pack validator (`tests/unit/content/validator.test.ts` and `tests/property/content-pack-validator.test.ts`) will reject malformed entries.
6. `npx tsc --noEmit` — clean.
7. Pre-commit Uncle Bob self-review: clean code / externalities (no schema drift; `git diff --name-only` should only show files in the allowed list) / regressions (full vitest green) / tests (validator covers the new entries) / Uncle Bob check.
8. Commit locally with message format `content (batch 1.N): <what shipped>`. Never push.

Pack reference conventions:
- IDs are kebab-case (e.g. `bugbear`, `wand-of-fireballs`).
- Monster CR is a string (`"1/4"`, `"1/2"`, `"1"`, etc.). See the Goblin entry for canonical shape.
- Skip any entry whose mechanics need an engine primitive that isn't shipped yet (e.g. a monster ability that needs an unmodeled trigger system). Document the deferral in the gaps doc rather than half-wiring.

Coordination notes:
- The engine session is on `main` in another worktree. Both worktrees share the same `.git` directory but have independent working files and HEADs. `git log main` from this worktree shows the engine session's commits in real time.
- The user merges this branch back at coordination points. JSON conflicts on `starter-pack.json` are rare (monsters/items arrays don't overlap with engine-touched arrays). Doc conflicts on the gaps doc and CHANGELOG are possible; resolve by keeping both blocks.
- Each worktree maintains its own `node_modules`. If the engine session lands a dependency change in `package.json`, this worktree needs its own `npm install` to pick it up.

To start: read the gaps doc's Monsters and Items sections, then propose a starting batch (something coherent like "10 low-CR humanoids: bandit + bandit captain + cultist + cult fanatic + acolyte + commoner + guard + noble + scout + spy" or "5 uncommon wondrous items"). Wait for confirmation before authoring.
```

## Coordination during parallel work

- `git log main` from either worktree shows the other's commits in real time. Use this to confirm the engine session hasn't landed something that affects the content session's footprint (e.g., a schema change to monster entries).
- JSON conflicts on `starter-pack.json` are rare in practice because the two sessions target disjoint top-level arrays.
- Doc conflicts on `CHANGELOG.md` and `docs/starter-pack-gaps.md` are the most common friction. Resolve by keeping both blocks; both sessions add new content rather than modifying shared text.
- The `features.test.ts` snapshot moves when a condition is added (engine) or rarely when a magic item that defines a condition lands (content). Only one session should `-u` at a time; the other re-runs the suite after merge to absorb the new baseline.
- If the engine session changes `package.json` dependencies, the content worktree needs its own `npm install`.

## Cleanup when the content branch wraps

In the primary (engine / `main`) worktree's terminal:

```bash
git merge content/authoring-batch-1
git worktree remove ../ttrpg-engine-dnd-content
git branch -d content/authoring-batch-1
```

If the merge has conflicts, VS Code's merge editor handles them. `git worktree remove` refuses if the worktree has uncommitted changes; commit or stash inside the worktree first.

For multiple batches you can keep the worktree around and just create a new branch from inside it after each merge instead of removing and recreating.

## When NOT to use this pattern

- For a single small content addition (one or two monsters), the overhead of a worktree isn't worth it. Add directly to `main` in the engine session.
- When the engine session is between slices and idle, parallel work has no benefit. Run serially.
- When a content addition requires a schema extension. That's an engine slice in disguise; do it on `main`.
