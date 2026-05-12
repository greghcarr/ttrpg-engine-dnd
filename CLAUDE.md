# dnd-engine, conventions

A standalone, event-sourced TypeScript domain engine for D&D 5.5e (2024 rules). Ships schemas + engine only; no rulebook content. Consumers supply content packs.

## Goal

**Full mechanical coverage of the 2024 PHB + DMG + MM.** The engine models every printed mechanic: every class, subclass, species, background, feat, spell, weapon, armor, magic item, condition, monster statblock. Rules that are genuinely DM-discretion (improvised actions, narrative rulings, houserules) drop to the `CustomEffect` code-handler escape hatch.

This is a long-running build. The roadmap lives in [README.md](README.md) as 26 slices in three phases (A: engine mechanics, B: state schemas, C: content). After foundation + Slices 1 to 5 we are about 42% to that goal. When picking the next slice, prefer the lowest-numbered unfinished slice unless the user asks otherwise; the order is dependency-driven.

## Architecture (locked)

- **Event-sourced.** State changes are events. `apply(state, event) -> state` is pure.
- **Plan/commit split.** `engine.plan(state, intent)` is the only place RNG is consumed; resolution events carry baked rolls. `apply()` never touches RNG. Replays read baked rolls.
- **Effect primitives.** Features are described via a fixed vocabulary of about 25 primitives. Wild Shape, Polymorph, Wish and similar drop to code handlers (the `CustomEffect` escape hatch).
- **Branded IDs + ULIDs.** Per-kind branded string types (`CharacterId`, `SpellId`, `ItemDefinitionId` versus `ItemInstanceId`, etc.) backed by ULIDs.
- **Normalized state.** Entities live in `Record<Id, Entity>` maps under `CampaignState`, not nested arrays.
- **Immer internally, immutable externally.** `apply()` uses Immer for clean reducers; output is frozen.
- **Zod.** Single source of truth for schemas; types via `z.infer`. Parse at boundaries (loading content, deserializing campaigns). `apply()` trusts types.
- **Schema versioning.** Every persisted doc carries `schemaVersion`. Migration machinery lives in `src/migrations/` from day one.
- **PendingChoice protocol.** Deferred player decisions (ASI vs feat, subclass selection, spell selection, target selection) are first-class. `ChoiceRequired` events install a `PendingChoice` in state; `ChoiceResolved` records the selection; the effect-stack reads resolved choices and applies the selected option's effects to derivations.

## Export discipline

`src/index.ts` is the only public barrel. Nothing under `src/internal/` is exported. Anything not re-exported from `src/index.ts` is internal and may change without notice.

## Testing standard

Tests are valued for what they catch, not for ceremony. The bar is high on the layers that protect architectural invariants and rulebook correctness; everything else gets cut.

### Required test layers (value-dense, keep these)

1. **Reducer unit tests** ([tests/unit/reducers/](tests/unit/reducers/)). One file per event type. Cover the happy path plus every rulebook edge case (damage at 0 HP, temp HP interactions, exhaustion stacking, etc.) and invalid-input rejection. The rulebook lives here as executable code.
2. **Derivation unit tests** ([tests/unit/derive/](tests/unit/derive/)). Table-driven where a rulebook table exists (ability mod, proficiency bonus, spell slot multiclass table). For other derivations, cover the meaningful branches, not every branch.
3. **Golden-file scenarios** ([tests/golden/](tests/golden/)). End-to-end event streams plus expected final state. Doubles as living documentation of how the API is meant to be used.
4. **Replay equivalence** (hard architectural invariant). For every golden scenario: `replay(events).state` deep-equals `campaign.state`. Catches non-determinism in `apply()` reducers.
5. **RNG capture proof** (hard architectural invariant). `apply()` is RNG-free; `ThrowOnCallRNG` test double on `applyAll()` for a planned event stream must not throw. Proves the plan/commit split holds.

### Coverage gates (enforced in [vitest.config.ts](vitest.config.ts))

Single floor of **80% lines + statements** on `src/engine/`, `src/derive/`, `src/effects/`. No global threshold. No per-file 100% targets. Coverage is a smoke alarm, not an accomplishment.

### Explicitly NOT required (cut as ceremony)

- Public API contract snapshot tests. Breaks on every legitimate new export; signal-to-noise is too low.
- Schema round-trip tests. Zod already guarantees parse stability for valid input.
- Effect-primitive coverage matrix as a separate file. Real features are exercised through golden scenarios and reducer tests.
- Property tests at fixed-iteration CI gates. Useful as one-off fuzz runs locally, not as a permanent gate.
- Coverage-filler tests written purely to hit thresholds.

### When adding new code

- New event type → reducer test + at least one golden scenario that uses it
- New planner → planner test asserting the resolution chain shape + RNG-capture test if it consumes randomness
- New derivation → table-driven tests for rulebook tables, branch tests for the rest
- New effect primitive → exercised through a real-feature golden scenario, not a coverage-matrix entry

If a test would only exist to satisfy a coverage threshold, do not write it. Add a test when you can name the bug it prevents.

## Code style

Defers to [~/.claude/CLAUDE.md](../../../.claude/CLAUDE.md) (global) for the full house style. Project-specific additions:

- TypeScript strict mode (enforced in [tsconfig.json](tsconfig.json) with `noUncheckedIndexedAccess`)
- No inline magic numbers/strings: extract to named module-scope constants. The 5.5e rules contain many of these (death-save thresholds, hit die averages, ability score range). Each gets a name.
- No defensive error handling for impossible cases. `invariant()` is for assertions at boundaries (event reducers verifying preconditions before mutating state), not for "this can never happen" checks inside pure helpers.
- Reducers must be small. If `applyFoo` grows past ~30 lines, extract intent-revealing helpers (`absorbTempHP`, `isMassiveDamage`, `resetDeathSaves`). The reducer reads as a sequence of named operations, not a procedure.
- Path alias `@/` = `src/`
- No em dashes or en dashes in any file (comments, docs, error messages). Use commas, parentheses, colons, or separate sentences.

## Versioning

- Format: `MAJOR.MINOR.PATCH[-pre-alpha|-alpha|-beta]`
- Bump on meaningful surface changes, not on every commit.
- `SCHEMA_VERSION` (in [src/version.ts](src/version.ts)) is independent of package version. Bump only when persisted shapes change, and ship a migration in the same PR.

## Slice workflow

Each slice typically touches the same set of layers. When working on a new slice:

1. **Event schemas** in [src/schemas/events/](src/schemas/events/). Include intent / resolution / notification events as appropriate. Resolution events carry baked RNG.
2. **Reducers** in [src/engine/reducers/](src/engine/reducers/), one file per event category. Wire into [src/engine/apply.ts](src/engine/apply.ts) (both the import and the switch case, both edits are easy to forget).
3. **Planners** in [src/engine/plan/](src/engine/plan/). RNG-consuming logic lives here, never in reducers.
4. **Public API** in [src/engine/index.ts](src/engine/index.ts) (the `Engine` interface and the `planNs` factory) and re-exports in [src/index.ts](src/index.ts).
5. **Tests**: reducer unit tests, planner tests with RNG-capture proof, at least one golden scenario per slice exercising replay-equivalence.

Common gotchas: forgetting to wire a new case into the apply.ts switch produces an "Unhandled event" runtime error. Forgetting the import causes a `ReferenceError` at apply time, not at typecheck time. The architectural invariant tests catch both but only if a golden scenario actually emits the new event.
