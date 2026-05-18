# Contributing to dnd-srd-engine

Thanks for your interest. This engine is built to be the foundation that other D&D 5.5e tools rely on, so contributions are held to a higher bar than typical app code.

## Quality bar

**Incorrect code is worse than no code.** A subtly-wrong rule implementation that *looks* correct will mislead downstream tools and tables for months. If you cannot make a change correct, leave it deferred with a tracked row in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) and document the RAW deviation in the slice's CHANGELOG entry.

## Before you start

1. Read [README.md](README.md) for the user-facing pitch and roadmap.
2. Read [CLAUDE.md](CLAUDE.md). This is the working manual: quality bar, branch structure, commit conventions, SRD canon, slice cadence, Uncle Bob pre-commit audit, architecture (locked).
3. Read [DEVELOPMENT.md](DEVELOPMENT.md) for the branch flow, dev commands, and house rules.
4. Confirm `references/srd-markdown/` is populated in your worktree. SRD lookups happen there, not on the web. If you cloned without `--recurse-submodules`, run `git submodule update --init --recursive` to populate it. See [DEVELOPMENT.md](DEVELOPMENT.md#first-time-setup).

## Working with an AI agent (Claude Code or similar)

The repo is set up so that any AI coding agent pointed at it picks up the working manual ([CLAUDE.md](CLAUDE.md)) automatically. If you are an agent reading this file, follow the "Fresh-agent quickstart" in [CLAUDE.md](CLAUDE.md) first. Two rules are load-bearing and apply to every commit regardless of who or what made the change:

- **Commit, don't push.** `git commit` is local-only. Never `git push`, amend, force-push, or rewrite history without explicit instruction from a human collaborator.
- **Slice work goes to `dev`, never to `main`.** See [DEVELOPMENT.md](DEVELOPMENT.md#branches) for the branch flow.

## Scope: what this engine does and does not do

**Does**: model every printed mechanic in the 2024 PHB, DMG, and Monster Manual. Provide a schema-only library that consumers extend with their own content packs. Run an event-sourced state machine with deterministic replay.

**Does not**: ship any D&D content. Adjudicate situations the rules text delegates to the DM (improvised actions, table houserules, ambiguous spell interactions). Replace a human DM.

If a contribution would put copyrighted Wizards of the Coast text or stat blocks into this repo, it does not belong here. Content goes in separate, consumer-owned content packs.

## Architecture is locked

The decisions in [CLAUDE.md](CLAUDE.md) under "Architecture (locked)" are not up for debate as part of a contribution:

- Event-sourced with `apply(state, event) -> state` pure.
- Plan/commit split: RNG only inside planners, resolution events carry baked rolls, replay is deterministic.
- Effect-primitive vocabulary plus code-handler escape hatch.
- Branded IDs with ULIDs. Normalized state. Immer internally, immutable externally. Zod schemas.
- `PendingChoice` protocol for deferred decisions.

If you think one of these needs to change, open an issue first and discuss before coding.

## How to add a slice or feature

Most contributions touch the same set of layers:

1. **Event schemas** in [src/schemas/events/](src/schemas/events/). Intent / resolution / notification events as appropriate. Resolution events carry baked RNG.
2. **Reducers** in [src/engine/reducers/](src/engine/reducers/), one file per event category. Wire into [src/engine/apply.ts](src/engine/apply.ts) (both the import and the switch case).
3. **Planners** in [src/engine/plan/](src/engine/plan/). RNG-consuming logic lives here, never in reducers.
4. **Public API** in [src/engine/index.ts](src/engine/index.ts) and re-exports in [src/index.ts](src/index.ts).
5. **Tests**: see Testing standard below.

## Testing standard

Held to the standard documented in [CLAUDE.md](CLAUDE.md). Summary:

**Required**:

- Reducer unit tests in [tests/unit/reducers/](tests/unit/reducers/) for every new event type. Happy path, every rulebook edge case, invalid-input rejection.
- At least one golden scenario in [tests/golden/](tests/golden/) per new gameplay flow. Asserts replay equivalence.
- Each golden scenario must emit a human-readable transcript via `formatTranscript()` from [tests/transcript.ts](tests/transcript.ts) and assert it against a snapshot in [tests/golden/transcripts/](tests/golden/transcripts/). PRs show the transcript diff. Update intentionally with `npx vitest run -u`.
- **Naming convention.** Slice-aligned golden tests are named `s<N>-<short-name>.test.ts` (for example `s4-checks.test.ts`, `s8-action-economy.test.ts`) and their transcript snapshots share the same prefix (`s4-checks.transcript.md`). Architectural-invariant tests (`replay-equivalence.test.ts`, `rng-capture.test.ts`) and the multi-slice narrative (`showcase.test.ts`) stay un-prefixed. A directory listing then reveals slice progression at a glance.
- For RNG-consuming planners: a `ThrowOnCallRNG` test confirming `apply()` never calls the RNG.
- Derivation tests: table-driven against rulebook tables (proficiency bonus, ability modifier, etc.), branch-tested for derived values that compose.
- New event type: extend [tests/transcript.ts](tests/transcript.ts) `formatEvent` with a case so the rendering stays readable.

**Not required** (and discouraged unless they catch a real bug):

- Coverage chasing past 80% on core directories.
- Public API contract snapshot tests.
- Schema round-trip tests (Zod already guarantees this).

If you cannot name a bug a test would prevent, do not write it.

CI gates: typecheck, 80% line coverage on `src/engine/`, `src/derive/`, `src/effects/`, replay equivalence on every golden scenario, RNG capture proof.

## Code style

- TypeScript strict mode. Enforced in [tsconfig.json](tsconfig.json).
- No magic numbers or strings. Extract to named module-scope constants.
- No defensive error handling for impossible cases. Use `invariant()` for genuine boundary checks.
- Small functions. Reducers should read as a sequence of named operations.
- No em dashes or en dashes in code, comments, docs, or error messages. Use commas, parentheses, colons, or separate sentences.
- File references in markdown as `[label](path)`, not backticks.

## Commit and PR style

- One coherent change per commit. One slice per commit. Big features land as a series of slices.
- Slice commits land on `dev`, never directly on `main`. See [DEVELOPMENT.md](DEVELOPMENT.md#branches).
- Commit messages: imperative mood, summary line under 72 chars, paragraph body explaining the *why*.
- Engine slices include a **pre-commit Uncle Bob audit** in the commit body (names, DRY, SRP, magic numbers, at-threading, mechanical outcomes asserted, tests). See [CLAUDE.md](CLAUDE.md#pre-commit-uncle-bob-audit) for the checklist.
- PRs should include: what changed, why, what tests cover it, anything reviewers should look at closely.

## Reporting bugs

Open an issue with:

- A minimal reproduction: ideally a failing test or a short script that triggers the bug.
- Expected vs actual behavior.
- The rulebook citation if the bug is about rules correctness (PHB page, errata).

## Reporting rules-correctness bugs

These are different from code bugs. The engine aims for 95%+ correctness against the printed 2024 rules. If you believe a mechanic is implemented incorrectly:

1. Cite the rulebook (PHB chapter / page) or official errata / Sage Advice.
2. Show a test case that demonstrates the discrepancy.
3. If the rules are genuinely ambiguous, that is a candidate for the `CustomEffect` escape hatch, not for the core engine.

## License

By contributing, you agree your contributions are licensed under the MIT License (see [LICENSE](LICENSE)).
