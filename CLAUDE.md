# ttrpg-engine-dnd, conventions

A standalone, event-sourced TypeScript domain engine for D&D 5.5e (2024 rules). Local directory at `Visual Studio Code/ttrpg-engine-dnd/`; GitHub repo at `github.com/greghcarr/ttrpg-engine-dnd`. Not currently distributed through a package registry; `private: true` is set in `package.json`. Earlier alpha releases on npm (alpha.0 through alpha.5) were unpublished in May 2026 on IP-cleanup grounds — see CHANGELOG. Ships schemas + engine only; no rulebook content. Consumers supply content packs.

## Goal

**Full mechanical coverage of˜ the 2024 PHB + DMG + MM.** The engine models every printed mechanic: every class, subclass, species, background, feat, spell, weapon, armor, magic item, condition, monster statblock. Rules that are genuinely DM-discretion (improvised actions, narrative rulings, houserules) drop to the `CustomEffect` code-handler escape hatch.

This is a long-running build. The roadmap lives in [README.md](README.md) as six phases (A: engine mechanics, B: state schemas, C: combat fill-in, D: adoption surface, E: 2024 content, F: optional core extraction). Phases A through E completed at slice 46 (alpha.5). Slice 47 (Phase F, optional `ttrpg-engine-core` extraction) is still unstarted. Work since alpha.5 (slices 48 onward, currently at slice 203 with two parallel content lanes recently merged in) has been "primitive + canonical user" vocabulary expansion: each slice adds a focused Effect kind, TriggerAction, or planner that unblocks a cohort of currently schema-only content. The per-primitive future-slice queue and per-spell wired/schema-only catalog live in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md).

## SRD source of truth

**The local markdown clone at `references/srd-markdown/` is the canonical source for SRD 5.2.1 rules text.** Never fetch 5e content from the web (Roll20 wiki, dndbeyond, third-party sites). The web sources are 2014-PHB-flavored or third-party variants and have introduced drift bugs in past slices.

The drift audit at [tests/audit/srd-drift.test.ts](tests/audit/srd-drift.test.ts) parses the markdown clone and asserts every pack spell, monster, and magic item matches SRD on the script-detectable fields (school, level, components, classes, concentration, ritual, casting time / range / duration, V/S/M presence, AC, HP, CR, ability scores, rarity, attunement, etc.). It skips itself when the clone is absent (e.g., a fresh worktree without the symlink). Slices 177-194 used this same logic ad-hoc and shipped ~310 drift fixes; the harness now catches regressions automatically.

When auditing content (monsters, spells, items, class features, magic items) against RAW, grep `references/srd-markdown/` and treat its text as authoritative. The PDF source at `references/SRD_CC_v5.2.1.pdf` is the original; the markdown is a faithful fork that was spot-checked against the PDF during the monster audit. Both are gitignored (per-worktree local files).

Layout:
- `references/srd-markdown/classes.md` — class + subclass features tables and body text
- `references/srd-markdown/spells.md` — every SRD 5.2.1 spell, `#### Spell Name` headers
- `references/srd-markdown/monsters.md`, `monsters-A-Z.md` — bestiary
- `references/srd-markdown/magic-items.md` — DMG items
- `references/srd-markdown/character-creation.md` — species, backgrounds, feats
- `references/srd-markdown/rules-glossary.md` — conditions, damage types, generic rules

If `references/srd-markdown/` is absent (fresh worktree, recent clone), surface that immediately and ask the user to symlink it from the primary worktree (`ln -s ../ttrpg-engine-dnd/references references`) rather than proceeding with web sources.

## Library-quality bar (internal working note)

Hold the engine to a library-quality standard: TypeScript strict mode, deterministic replay, plan/commit RNG capture, 80%+ coverage on engine/derive/effects, golden transcripts on every behavior change. Do not advertise this framing on public-facing surfaces (README, package.json, repo description). The work should speak through the code and tests; quality labels in marketing copy are noise. See [feedback memory](../../../.claude/projects/-Users-greghcarr-Documents-Visual-Studio-Code-dndbnb/memory/feedback_no_quality_self_label_public.md) for the reasoning.

## Known gaps (canonical list lives in README)

The engine architecture is locked. Original Phase A–E combat / state / adoption work all shipped at alpha.5. Remaining work falls into three categories:

1. **Engine vocabulary** — focused primitives that each unblock a cohort of currently schema-only content. ~15–25 still on the catalog at [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) under "Future engine slices."
2. **Content authoring** — most of what's left. The bulk of the MM bestiary (~365 statblocks), most subclasses (~38), the long tail of schema-only spells (~247), the DMG magic-item catalog. None requires engine work, just JSON. See [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) for the catalog.
3. **Phase F** (optional) — `ttrpg-engine-core` extraction. Unstarted. Only do this if multi-system support becomes a real goal.

When working in this repo, the slice cadence is "primitive + canonical user": one focused primitive plus the first one or two RAW spells / features that exercise it. See recent slices (88–122) for the pattern.

## System-agnostic core seam (forward-looking)

ttrpg-engine-dnd has a conceptual split between system-agnostic architecture and D&D-specific rules. Slice 47 (Phase F in the README roadmap) optionally extracts the agnostic layer into a `ttrpg-engine-core` package if multi-system support ever becomes a real goal. The seam is conceptual today, not enforced in code: several files that belong on the agnostic side already bake in D&D specifics. That's fine; Phase A was the right time to ship D&D shapes. The rule going forward is **stop the bleeding, don't fix the past.**

**Genuinely clean today (keep that way):**
- [src/ids.ts](src/ids.ts): branded strings, no D&D coupling.
- [src/engine/replay.ts](src/engine/replay.ts), [commit.ts](src/engine/commit.ts), [undo-redo.ts](src/engine/undo-redo.ts): operate on opaque events.
- [src/schemas/runtime/session.ts](src/schemas/runtime/session.ts): sessions + journal, no D&D concepts.
- [src/schemas/runtime/in-game-time.ts](src/schemas/runtime/in-game-time.ts): minute-counting only.

**Partially coupled today (don't make worse; Slice 47 cleans up):**
- [src/schemas/runtime/currency.ts](src/schemas/runtime/currency.ts): cp/sp/ep/gp/pp hardcoded.
- [src/schemas/runtime/party.ts](src/schemas/runtime/party.ts): clean except the embedded `Currency`.
- [src/content/pack.ts](src/content/pack.ts): D&D content categories baked into the schema shape.
- [src/schemas/predicate.ts](src/schemas/predicate.ts), [formula.ts](src/schemas/formula.ts): machinery is agnostic, vocabulary is D&D.
- [src/engine/apply.ts](src/engine/apply.ts): hardcoded switch over D&D event types.

**Genuinely D&D-specific (no need to abstract):**
- All `src/schemas/content/*` schemas.
- `src/schemas/runtime/character.ts`, `encounter.ts`, `item-instance.ts`, `effect-instance.ts`, `pending-choice.ts`.
- D&D-mechanics event schemas (combat, spellcasting, rest, level-up, action-economy, concentration, attack, checks).
- All reducers, planners, and derivations.
- Effect primitive vocabulary in `src/schemas/effects.ts` (the *pattern* is agnostic; the *primitives* are D&D).

### Rule for new code

- Adding to a **genuinely clean** file: keep it clean. Don't bake in six ability scores, d20+AC, 13 damage types, spell slot architecture, etc. unless there's a concrete D&D reason that won't exist in other systems.
- Adding to a **partially coupled** file: don't deepen the coupling. If you're extending currency, party, the pack loader, predicate/formula DSLs, or the apply dispatcher, prefer shapes that fit a future generic split. Don't refactor preemptively, but don't make Slice 47 worse either.
- Adding to a **D&D-specific** file: build what 5.5e needs. No abstraction required.

The seam doesn't need to be perfect today, just clean enough that Slice 47 is a manageable refactor rather than a rewrite. Don't add to the debt; don't pay it down preemptively either.

## Architecture (locked)

- **Event-sourced.** State changes are events. `apply(state, event) -> state` is pure.
- **Plan/commit split.** `engine.plan(state, intent)` is the only place RNG is consumed; resolution events carry baked rolls. `apply()` never touches RNG. Replays read baked rolls.
- **Effect primitives.** Features are described via a fixed vocabulary of 45 primitives. Wild Shape, Polymorph, Wish and similar drop to code handlers (the `CustomEffect` escape hatch). Canonical list: `EFFECT_KINDS` in [src/schemas/effects.ts](src/schemas/effects.ts).
- **Branded IDs + ULIDs.** Per-kind branded string types (`CharacterId`, `SpellId`, `ItemDefinitionId` versus `ItemInstanceId`, etc.) backed by ULIDs.
- **Normalized state.** Entities live in `Record<Id, Entity>` maps under `CampaignState`, not nested arrays.
- **Immer internally, immutable externally.** `apply()` uses Immer for clean reducers; output is frozen.
- **Zod.** Single source of truth for schemas; types via `z.infer`. Parse at boundaries (loading content, deserializing campaigns). `apply()` trusts types.
- **Schema versioning.** Every persisted doc carries `schemaVersion`. Migration machinery lives in `src/migrations/` from day one.
- **PendingChoice protocol.** Deferred player decisions (ASI vs feat, subclass selection, spell selection, target selection) are first-class. `ChoiceRequired` events install a `PendingChoice` in state; `ChoiceResolved` records the selection; the effect-stack reads resolved choices and applies the selected option's effects to derivations.

## Source map (where things live)

- [src/schemas/events/](src/schemas/events/), event payload schemas (one file per category: attack, combat, action-economy, rest, etc.); aggregated in [src/schemas/events/index.ts](src/schemas/events/index.ts).
- [src/schemas/runtime/](src/schemas/runtime/), persisted-state shapes (campaign, character, encounter, item-instance, etc.).
- [src/schemas/content/](src/schemas/content/), content-pack shapes (classes, species, spells, items, etc.).
- [src/schemas/effects.ts](src/schemas/effects.ts), [predicate.ts](src/schemas/predicate.ts), [formula.ts](src/schemas/formula.ts), effect primitives + DSLs.
- [src/engine/apply.ts](src/engine/apply.ts), the master switch over event types; pure, RNG-free.
- [src/engine/reducers/](src/engine/reducers/), one file per event category; each exports `applyFoo(draft, event)`.
- [src/engine/plan/](src/engine/plan/), planners; the only place RNG is consumed. One file per intent.
- [src/engine/triggers/](src/engine/triggers/), trigger dispatch (Sneak Attack, opportunity attacks, etc.) called from planners post-event.
- [src/engine/replay.ts](src/engine/replay.ts), [commit.ts](src/engine/commit.ts), [undo-redo.ts](src/engine/undo-redo.ts), event-sourced infrastructure.
- [src/derive/](src/derive/), computed-over-state functions (AC, attack bonus, spell slots, ability checks, etc.).
- [src/effects/](src/effects/), `EffectAccumulator` builder and effect-stack composition.
- [src/content/packs/starter-pack.json](src/content/packs/starter-pack.json), the wired SRD content pack.
- [src/handlers/](src/handlers/), `CustomEffect` code handlers (escape hatch for Wild Shape, Wish, etc.).
- [src/index.ts](src/index.ts), the single public barrel.
- [tests/unit/](tests/unit/), reducer + derivation tests.
- [tests/golden/](tests/golden/), end-to-end scenarios + replay-equivalence + transcripts.
- [tests/audit/](tests/audit/), the 48-probe RAW compliance audit (intentionally monolithic).

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
6. **Transcript snapshots** ([tests/golden/transcripts/](tests/golden/transcripts/)). Every golden scenario emits a human-readable markdown transcript via `formatTranscript()` from [tests/transcript.ts](tests/transcript.ts) and asserts it against a checked-in file. When a slice changes engine behavior, the transcript diff shows up in the PR alongside the code change. Update transcripts intentionally with `npx vitest run -u`. Use intent-revealing character names in golden tests (`'Alyx'`, `'Goblin A'`) since they appear in the transcript.

### Coverage gates (enforced in [vitest.config.ts](vitest.config.ts))

Single floor of **80% lines + statements** on `src/engine/`, `src/derive/`, `src/effects/`. No global threshold. No per-file 100% targets. Coverage is a smoke alarm, not an accomplishment.

### Explicitly NOT required (cut as ceremony)

- Public API contract snapshot tests. Breaks on every legitimate new export; signal-to-noise is too low.
- Schema round-trip tests. Zod already guarantees parse stability for valid input.
- Effect-primitive coverage matrix as a separate file. Real features are exercised through golden scenarios and reducer tests.
- Property tests at fixed-iteration CI gates. Useful as one-off fuzz runs locally, not as a permanent gate.
- Coverage-filler tests written purely to hit thresholds.

### When adding new code

- New event type: reducer test + at least one golden scenario that uses it + transcript snapshot + a case in [tests/transcript.ts](tests/transcript.ts) `formatEvent`.
- New planner: planner test asserting the resolution chain shape + RNG-capture test if it consumes randomness + golden scenario with transcript.
- New derivation: table-driven tests for rulebook tables, branch tests for the rest.
- New effect primitive: exercised through a real-feature golden scenario, not a coverage-matrix entry.

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

## Parallel sessions

When engine-slice work and content authoring (monsters, magic items) can both make useful progress, run them in parallel via two git worktrees: engine on `main` in the primary worktree, content on a sibling branch in `../ttrpg-engine-dnd-content`. Both worktrees share `.git` history but hold independent working files. See [docs/parallel-authoring.md](docs/parallel-authoring.md) for setup commands, the file-footprint rules each session must respect, the starter prompt for the content-session Claude chat, and merge/cleanup steps.

## Slice workflow

Each slice typically touches the same set of layers. When working on a new slice:

1. **Event schemas** in [src/schemas/events/](src/schemas/events/). Include intent / resolution / notification events as appropriate. Resolution events carry baked RNG.
2. **Reducers** in [src/engine/reducers/](src/engine/reducers/), one file per event category. Wire into [src/engine/apply.ts](src/engine/apply.ts) (both the import and the switch case, both edits are easy to forget).
3. **Planners** in [src/engine/plan/](src/engine/plan/). RNG-consuming logic lives here, never in reducers.
4. **Public API** in [src/engine/index.ts](src/engine/index.ts) (the `Engine` interface and the `planNs` factory) and re-exports in [src/index.ts](src/index.ts).
5. **Tests**: reducer unit tests, planner tests with RNG-capture proof, at least one golden scenario per slice exercising replay-equivalence.

Common gotchas: forgetting to wire a new case into the apply.ts switch produces an "Unhandled event" runtime error. Forgetting the import causes a `ReferenceError` at apply time, not at typecheck time. The architectural invariant tests catch both but only if a golden scenario actually emits the new event.

For task-shape checklists (new planner vs new content type vs new derivation), see [docs/slice-template.md](docs/slice-template.md).

### Planner shape

Every planner in [src/engine/plan/](src/engine/plan/) follows the same skeleton. New planners should match it unless there's a documented reason not to.

```ts
export interface FooIntent {
  readonly type: 'Foo';
  readonly actorId: string;
  // …other intent fields…
  readonly at?: string; // optional timestamp override
}

export const planFoo = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG, // omit if the planner consumes no randomness
  intent: FooIntent,
): ReadonlyArray<Event> => {
  // 1. Resolve referenced entities; throw on unknown IDs.
  const actor = state.characters[intent.actorId];
  if (!actor) throw new Error(`Unknown actor ${intent.actorId}`);

  // 2. Validate preconditions (action economy, resource availability,
  //    blocking conditions, RAW restrictions). Throw with a
  //    user-readable message on violation.
  assertActorCanAct(actor, 'Foo');

  // 3. Resolve `at` once.
  const at = intent.at ?? nowIso();

  // 4. Consume RNG (rollDie, rollAdvantage, etc.). All RNG calls live
  //    in the planner; never in reducers or derivations.

  // 5. Build the event sequence. Emit intent / resolution / notification
  //    events in causal order. Set `causedByEventId` on dependent events.

  // 6. Dispatch triggers via `dispatchTriggers({state, content, rng, event, at})`
  //    after committing intermediate events with `applyAll` if downstream
  //    events depend on post-event state.

  return [/* events in order */];
};
```

Conventions:
- Intent type uses `readonly` fields and a literal `type` discriminator.
- Throw `Error` with a sentence the consumer could surface; never return error tuples.
- ID-form fields use plain `string` on the intent (consumer-facing); cast to branded IDs only when constructing events.
- `at` defaults to `nowIso()`; pass-through to every emitted event so a single planner call gets one timestamp.
- Wire the planner into [src/engine/plan/index.ts](src/engine/plan/index.ts) and (if part of the public API) into [src/engine/index.ts](src/engine/index.ts) and the convenience surface in [src/engine/conveniences.ts](src/engine/conveniences.ts).

Reference examples: [plan/sacred-weapon.ts](src/engine/plan/sacred-weapon.ts) (small, no RNG), [plan/attack.ts](src/engine/plan/attack.ts) (large, RNG + triggers + multi-event resolution chain).
