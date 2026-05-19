# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The bump policy and pre-release roadmap are documented in [VERSIONING.md](VERSIONING.md).

## Unreleased

**Engine+content: Dodge benefits disabled by Incapacitated / Speed 0 (slice 272)**

Closes the second of the slice-267 outstanding bugs. RAW (2024 PHB Dodge action): "You lose these benefits if you have the Incapacitated condition or if your Speed is 0." Pre-272 the `dodged` condition imposed both benefits (disadvantage on attackers + advantage on DEX saves) unconditionally. The gaps row sketched two paths; this slice ships path (a) — per-effect `condition` predicate — because it reuses the slice-103 + slice-258 plumbing already in place without new schema surface. Path (b) (a condition-level `disabledWhile?` field) is deferred unless a second canonical user emerges.

**Plumbing**:

- New `bearer.hasIncapacitated` and `bearer.speedZero` boolean facts populated at the two consumer sites: [src/engine/plan/attack.ts](src/engine/plan/attack.ts) (for the `ImposeDisadvantageOnAttackers` arm) and [src/derive/save.ts](src/derive/save.ts) (for the `SetAdvantage on:save.DEX` arm). The existing `findActorBlockingCondition` helper (slice 199) covers Incapacitated + the four conditions that RAW-include Incapacitated (Stunned, Paralyzed, Petrified, Unconscious) plus HP <= 0; `getEffectiveSpeed` (slice 77) computes the bearer's effective walking speed across the full effect stack.
- `computeSavingThrow` adds the new facts to the same facts map already carrying `event.isSpellSave`. No API change.

**Content wired (1 condition)**:

- **`dodged`**: both effect entries gain a `condition: { kind: 'all', terms: [{ kind: 'eq', path: 'bearer.hasIncapacitated', value: false }, { kind: 'eq', path: 'bearer.speedZero', value: false }] }` predicate. Description rewritten to cite the RAW disable clause and the slice-267 LoS row that stays deferred.

**Pattern-check sweep** (per slice 261 / 268 norms): the "RAW lose these benefits if X" shape is uniquely Dodge among 2024 conditions. Rage, Concentration, and Hide all *end* on their respective triggers rather than disabling effects while keeping the condition active. No sibling bugs surfaced. The slice-103 `ImposeDisadvantageOnAttackers.condition` plumbing already honored predicates; the only missing piece was the bearer-state facts at the call sites — populated here for both consumer paths.

Pre-commit Uncle Bob audit:

- **Names**: `bearer.hasIncapacitated` reads as a boolean question; `bearer.speedZero` is concise. Both live in the existing `bearer.*` namespace alongside `bearer.tempHp` (slice 122) and `bearer.wieldingShield` (slice 230). The old Elusive-era `bearerHasIncapacitated` fact (no dot, slice 199) is left untouched because pulling Elusive into the new namespace would be a separate concern.
- **DRY**: same two facts populated at two call sites (attack planner + save derive). Considered factoring into a helper but the call sites differ (attack consumes the target via its planner state; save consumes `input.character` via its derive input) and the construction is 3 lines each. Inline keeps each consumer self-contained.
- **SRP**: facts live next to existing predicate facts in the same maps. No new helper. The condition's predicate composition uses existing `all` + `eq` shapes; no new predicate kinds.
- **Magic numbers**: none added.
- **at-threading**: N/A (derive-only fact population).
- **Plan/commit split preserved**: derive-only change. No RNG, no event emission.
- **Pattern-check applied**: searched for RAW "lose these benefits if..." shape across the 2024 PHB conditions; Dodge is the unique instance. The cleaner path-(b) abstraction (condition-level `disabledWhile?`) is deferred because there's no second user to justify the schema extension.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1695 tests across 247 files, was 1692) green. 3 integration cases: baseline (both arms work), Incapacitated disables both, Grappled (speed 0) disables both. Grappled rather than Restrained for the speed-zero case because Restrained adds its own advantage-on-attackers + DEX-save disadvantage that would muddy the observable.
- **Tests**: 3 cases in new [tests/unit/engine/dodge-self-disable.test.ts](tests/unit/engine/dodge-self-disable.test.ts).

Pack snapshot drift: `dodged.effects[0]` and `effects[1]` each gain a `condition` field. Coverage matrix counts unchanged.

**Engine+content: Blurred attacker-sense bypass closes the slice-267 outstanding bug (slice 271)**

Closes the third of the slice-267 outstanding bugs: the `blurred-active` condition imposed disadvantage on attackers unconditionally, but Blur RAW says "An attacker is immune to this effect if it doesn't rely on sight, as with Blindsight, or can see through illusions, as with Truesight." The bypass shape is mirror of slice 127's Mirror Image vision-gate (already shipped for that one spell's dedicated deflection branch).

**Plumbing**:

- New `attacker.bypassesSightIllusion` boolean fact populated in [src/engine/plan/attack.ts](src/engine/plan/attack.ts)'s `attackerFacts` map. True when the attacker has blindsight, tremorsense, or truesight, OR carries the Blinded condition. Mirrors the slice-127 Mirror Image bypass logic verbatim. Darkvision is sight-based and intentionally excluded.

**Content wired (1 condition)**:

- **`blurred-active`**: the existing `ImposeDisadvantageOnAttackers` entry gains `condition: { kind: 'eq', path: 'attacker.bypassesSightIllusion', value: false }`. Description rewritten to drop the "blindsight / truesight / blindness isn't modeled" caveat.

**Pattern-check sweep** (per slice 261 / 268 norms): walked all 8 `ImposeDisadvantageOnAttackers` wires in the pack against RAW. Blur was the only same-shape bug:

- `escape-the-horde` (slice 206): gated on `event.isOpportunityAttack` — correct.
- `dodged` (Dodge action): two separately-tracked deferred rows (LoS gate + Incap/Speed-0 disabler) blocked on consumer-supplied scene state and bearer-state predicate facts respectively.
- `boots-of-speed-active` (slice 269): gated on `event.isOpportunityAttack` — correct.
- `foresight-active` (Foresight spell): unconditional — RAW-correct (precognitive sense, not a sight-illusion).
- `protection-from-evil-and-good-active` (slice 103): gated on `attackerCreatureType` — correct.
- `magic-circle-active` (slice 103): gated on `attackerCreatureType` — correct.
- `holy-aura-active` (slice 103): unconditional — RAW-correct (universal).

**Pattern-check secondary finding** (different shape, new tracking row): the `invisible` condition's wire is broken on a different axis. It carries `SetAdvantage on:'attack' mode:'advantage'` (bearer's own attack advantage) but is missing both:
1. The disadvantage-on-attackers arm entirely.
2. The bypass clause on the existing advantage arm ("if a creature can somehow see you, you don't gain this benefit against that creature").

Tracked as a new deferred row in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md). Closing (b) for Invisible is a one-line content edit (parallel to this slice); closing (a) needs a target-side perception fact symmetric to this slice's attacker-side fact (the engine doesn't track per-target see-invisibility today).

Pre-commit Uncle Bob audit:

- **Names**: `attacker.bypassesSightIllusion` is intention-revealing about both the bypass condition and the use case (sight-illusion effects, not all sight-related). The path namespace (`attacker.*`) matches the existing `attacker` family (`attackerCreatureType` already in the same map).
- **DRY**: bypass logic mirrors slice 127 byte-for-byte (`hasSense('blindsight') || hasSense('tremorsense') || hasSense('truesight') || appliedConditions.includes('blinded')`). Extracted as a local boolean named `attackerBypassesSightIllusion` for readability; not factored to a shared helper because slice 127's Mirror Image branch reads its own logic inline (the inline form lets each call site document its bypass clauses against its own RAW source).
- **SRP**: the fact-population sits next to the existing `attackerCreatureType` and `event.isOpportunityAttack` facts (one map, one purpose: predicate gates for `ImposeDisadvantageOnAttackers`). The condition entry gates via the existing slice-103 predicate plumbing; no engine API change.
- **Magic numbers**: none added. The four sense / condition checks are RAW vocabulary.
- **at-threading**: N/A (no events emitted by the new code path).
- **Plan/commit split preserved**: derive-only fact-population; no RNG, no event emission.
- **Pattern-check applied**: 8 wires audited, 1 closed (Blur), 0 false-positives (RAW-correct universal wires kept as-is), 1 new tracking row (Invisible — different shape).
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1692 tests across 246 files, was 1689) green. 3 new integration cases: baseline sight-only attacker rolls with disadvantage (2 d20); truesight attacker bypasses (1 d20, used='none'); no-condition baseline doesn't impose disadvantage (1 d20). The Blinded-attacker case is observationally muddied by Blinded's own attacker-side disadvantage (slice 97) and isn't pinned at the integration level; the slice-127 Mirror Image tests pin the same Blinded-bypass code path in a different scenario.
- **Tests**: 3 cases in new [tests/unit/engine/blur-attacker-sense-bypass.test.ts](tests/unit/engine/blur-attacker-sense-bypass.test.ts).

Pack snapshot drift: 1 entry on `blurred-active.effects[0]` gains a `condition` field. Coverage matrix counts unchanged.

**Docs+infra: front-door docs split back under single-Read ceiling (slice 270)**

Two same-shape splits to restore single-Read fitness on the two front-door docs that drifted over the ceiling during the recent slice cluster:

1. **CHANGELOG.md**: slices 252-260 archived to [docs/changelog/archive-slices-252-260.md](docs/changelog/archive-slices-252-260.md) (mirrors the slice 248 / slice 252 archive convention). Slices 261-269 stay live as the recent pattern-check chain + bug-fix slice.
2. **docs/starter-pack-gaps.md**: the shipped engine-slice rows (~30 rows, all `~~struck through~~` ✓ shipped) split out to [docs/gaps-engine-slices-shipped.md](docs/gaps-engine-slices-shipped.md). The "Future engine slices" table in the live gaps doc now lists only the unshipped rows plus a pointer to the shipped archive.

Surface symptom: pre-split, both files errored out on the Read tool with "exceeds maximum allowed tokens." A fresh agent landing on the repo couldn't open either front-door doc in one call, breaking the slice-template discovery path. Both are now back under the ceiling and read in one call.

What changed:

- **CHANGELOG.md**: 65 KB → ~36 KB. Live Unreleased section keeps slices 261-269 (9 slices); archived range 252-260 (9 slices) follows the slice-252 archive format including the `../../` path prefix sweep on root-relative links.
- **New file [docs/changelog/archive-slices-252-260.md](docs/changelog/archive-slices-252-260.md)** (~35 KB): header + slice-by-slice entries copied verbatim with the path-prefix sweep applied. Order: most-recent first.
- **CHANGELOG archive pointer block**: gains the new archive's row at the top of the index; description prose updated to reflect "slices 48-260" coverage and slice 270 as the most recent archive operation.
- **docs/starter-pack-gaps.md**: 64 KB → ~33 KB. The "Future engine slices" table now contains only unshipped rows; a pointer line and a sentence of context route readers to the shipped-engine-slices archive when they want the historical view.
- **New file [docs/gaps-engine-slices-shipped.md](docs/gaps-engine-slices-shipped.md)** (~32 KB): carries the shipped rows verbatim (relative links unchanged because the new file is a sibling under `docs/`, same depth as the original).

Pattern-check meta-finding: both front-door docs drifted over the ceiling during the slice 253-269 window. Slice 248 originally enforced the ceiling but didn't add a mechanical check; slices since then grew the files past the limit silently. Adding a CI check (a script that fails when front-door docs exceed N bytes / tokens) would catch this earlier; tracked as a small future infra slice.

Pre-commit short audit (docs/infra slice):

- **Names**: archive file naming follows the existing `archive-slices-NNN-MMM.md` convention; the new `gaps-engine-slices-shipped.md` mirrors the slice-249 pattern (`gaps-{category}.md` siblings under `docs/`).
- **DRY**: archive headers reuse the slice-252 archive's structure (intro paragraph + bullet list of covered slices + most-recent-first note). Path-prefix sweep uses the slice-252 sed pattern verbatim.
- **SRP**: pure docs/infra slice. No code, schemas, or content surface touched. The split is mechanical reorganization; no content edits beyond the path-prefix sweep.
- **Magic numbers**: ceiling target stated as "comfortably under 60 KB" matching CLAUDE.md's documented threshold.
- **at-threading**: N/A.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1689 tests across 245 files) green; CHANGELOG.md fits in a single Read post-split; docs/starter-pack-gaps.md fits in a single Read post-split; both archive files fit individually; sibling-archive cross-references in `docs/changelog/` still resolve.
- **Tests**: no new tests. The doc-size check is manual at this point (verified by attempting `Read` on each front-door doc without offset/limit).

**Content: Boots of Speed Disadvantage-on-OA arm closed; stale gap row (slice 269)**

Closes the Boots of Speed RAW "Disadvantage on opportunity attacks against the wearer" arm that has been deferred since slice 242. The `boots-of-speed-active` condition now wires a second effect: `ImposeDisadvantageOnAttackers` gated on `{ kind: 'eq', path: 'event.isOpportunityAttack', value: true }`. No engine work — the predicate fact landed in slice 206 (for Hunter L7 Escape the Horde, the first canonical user of the same shape), making this a one-line content edit.

What changed:

- **[src/content/packs/starter-pack.json](src/content/packs/starter-pack.json)** boots-of-speed-active condition: added the `ImposeDisadvantageOnAttackers` entry; rewrote the description to drop the stale "needs an `event.isOpportunityAttack` predicate fact" caveat (slice 206 landed it).
- **[tests/unit/engine/boots-of-speed-oa-disadvantage.test.ts](tests/unit/engine/boots-of-speed-oa-disadvantage.test.ts)** (new, 3 cases): an OA against the boots-active wearer rolls with disadvantage (2 d20); a regular attack does not (1 d20, used='none'); an OA against a baseline target without the condition does not (1 d20).
- **[docs/starter-pack-gaps.md](docs/starter-pack-gaps.md)**: struck the deferred row; closure annotation cites the meta-finding below.

**Pattern-check meta-finding**: this row sat 27 slices past the primitive's landing (slice 206 → slice 269 for the second canonical user). Slice 206 wired one canonical user (Escape the Horde) and tested the fact's plumbing, but didn't sweep the deferred-primitives backlog for OTHER content already documented as waiting on the same fact. The pattern-check norm focuses on "did I make this mistake elsewhere?" — this slice surfaces a complementary axis: **when a new predicate fact lands, sweep the deferred-primitives backlog for content awaiting it**. Adding this to the slice-template checklist could be a future docs slice; for now, the lesson is captured in this entry plus the row's closure annotation.

Pre-commit short audit (content slice):

- **Names**: reuses the slice-206 `event.isOpportunityAttack` path verbatim; condition id and effect kind are existing vocabulary.
- **DRY**: the predicate shape `{ kind: 'eq', path: 'event.isOpportunityAttack', value: true }` matches Escape the Horde's wire (slice 206) byte-for-byte. Two users of the same primitive, factored at the schema layer.
- **SRP**: the boots condition now does two things (speed × 2 + OA disadvantage) but both arms are RAW from one item, atomic by design.
- **Magic numbers**: none added. The d20-count (2 vs 1) tested in the new file is the standard advantage/disadvantage shape.
- **at-threading**: N/A (content-only slice).
- **Mechanical outcomes asserted**: OA against active wearer → `used='disadvantage'`, d20.length=2; regular attack same wearer → `used='none'`, d20.length=1; OA against inactive baseline → `used='none'`, d20.length=1. Pins the predicate gates on both axes (boots-state and attack-shape).
- **Tests**: 3 new cases under boots-of-speed-oa-disadvantage.test.ts. The third (baseline-without-boots) ensures the entry is genuinely gated on the condition and isn't a global side effect.

Pack snapshot drift: 1 new entry on `boots-of-speed-active.effects[]`. Coverage matrix counts unchanged (the slice doesn't add a new effect kind).

**Docs: filter-shape refinement codified into pattern-check norm (slice 268)**

Promotes the slice 267 meta-finding into [CLAUDE.md](CLAUDE.md). Slice 267 said "if this lesson recurs in a future sweep, codify it" — but the user redirected: the lesson is concrete and earned, no need to wait for a second instance.

What changed:

- **CLAUDE.md "Pattern-check on bugs" subsection** gains a new paragraph after the "Same shape, elsewhere?" trigger: **"Filter shape determines what a sweep can find."** Cites the slice-264 narrow-filter example and the three broader-than-RAW wires slice 267 surfaced (Dodge's LoS gate, Dodge's Incap/Speed-0 disabler, Blur's attacker-sense bypass). Frames the operational refinement: "what's the family of effects that can express this RAW intent?" then check all members.
- **Auto-memory entry [pattern-check-on-bugs.md](file:///Users/greghcarr/.claude/projects/-Users-greghcarr-Documents-Visual-Studio-Code-dnd-srd-engine/memory/pattern-check-on-bugs.md)** mirrors the addition so future sessions in this directory pick it up without re-reading CLAUDE.md.
- CLAUDE.md size: 33.7 KB → 34.6 KB. Comfortably under the single-Read ceiling.

Pre-commit short audit (docs slice):

- **Names**: "Filter shape determines what a sweep can find" — declarative, drops the slice-267 framing of "meta-finding" and replaces it with a working principle.
- **DRY**: the norm lives in CLAUDE.md (authoritative); the memory entry mirrors. Linked memory entries don't duplicate the prose; they restate concisely with a slice-268 origin pointer.
- **SRP**: pure docs slice. No engine / test surface touched.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1686 tests across 244 files) green; CLAUDE.md still fits in a single Read.

**Docs: track 3 outstanding broader-than-RAW bugs slice 264's sweep missed (slice 267)**

Honesty pass on the pattern-check chain (slices 262-266). The user asked "do we have outstanding bugs to fix from the chain?" — answering forced a wider sweep than slice 264's original Python script ran, surfacing three previously-untracked correctness gaps. None are new bugs; all existed before the chain started but weren't surfaced until now.

**3 new tracking rows in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md)**:

1. **Dodged — `ImposeDisadvantageOnAttackers` missing LoS gate.** RAW (SRD 5.2.1 Dodge): disadvantage on attackers "if you can see the attacker." Current wire is unconditional. Same shape as the deferred frightened LoS gate.
2. **Dodged — both arms missing Incapacitated / Speed-0 disabler.** RAW: "You lose these benefits if you have the Incapacitated condition or if your Speed is 0." Engine doesn't model bearer-state-based condition self-disable today. Two paths sketched in the gaps row (per-effect predicate vs. condition-level `disabledWhile?` field).
3. **Blurred-active — `ImposeDisadvantageOnAttackers` missing attacker-sense bypass.** RAW (Blur spell): disadvantage UNLESS attacker has blindsight / truesight / non-sight sense. Slice 127 wired this same bypass on Mirror Image's deflection path; Blur's `ImposeDisadvantageOnAttackers` path wasn't touched.

**Meta-finding**: slice 264's pattern-check sweep filtered specifically for `kind: 'check'` + `mode: 'disadvantage'` (narrow shape). It missed adjacent broader-than-RAW shapes (`ImposeDisadvantageOnAttackers` without LoS gates, `SetAdvantage on:save` without bearer-state disablers). Slice 264's CHANGELOG entry annotated retrospectively with the lesson; the audit's "Pattern-check applied" line now reads as accurate-at-the-time but acknowledges what a wider sweep would have caught.

Tentative lesson, not yet codified into [CLAUDE.md](CLAUDE.md)'s pattern-check norm: **a pattern-check's filter shape determines what it can surface**. A narrow filter (one kind, one mode) catches that kind / mode but misses adjacent shapes. When sweeping for broader-than-RAW gaps, widen the filter to `kind: 'SetAdvantage' | 'ImposeDisadvantageOnAttackers' | 'GrantAdvantageToAttackers'` across all modes, then cross-check each entry against RAW. If a third pattern-check sweep recurs with the same shape lesson, codify it.

What changed:

- 3 new rows in the Deferred primitives backlog of `docs/starter-pack-gaps.md`, each citing the bug, the RAW text, and the unblocker.
- Slice 264's CHANGELOG entry gets a one-line retrospective annotation noting the sweep's narrow filter.
- No code or test changes.

Pre-commit short audit (docs slice):

- **Names**: each new row's title states the condition + the missing gate ("Dodged — ImposeDisadvantageOnAttackers missing LoS gate"), readable from the gaps doc's TOC-style row listing.
- **DRY**: each row cites the canonical RAW source (SRD 5.2.1) and points at the related closed / open rows for pattern context. No content duplication.
- **SRP**: docs-only change; no engine or test surface touched. The retrospective annotation on slice 264 is one sentence at the END of the audit line — preserves historical narrative while adding closure-style honesty.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1686 tests across 244 files) green. No code paths changed; the tracking rows are documentation only.

**Engine: no-ability `RollTarget` wildcards for save / check (slice 266)**

Closes the simplification opportunity surfaced by slices 263 + 264: Mantle of Spell Resistance and poisoned both needed 6 per-ability `SetAdvantage` entries (one each for STR / DEX / CON / INT / WIS / CHA) because `RollTarget` required a specific ability on every save/check entry. This slice extends `RollTarget` to allow `{ kind: 'save' }` and `{ kind: 'check' }` without an ability, which serves as a wildcard matching every per-ability query.

**Plumbing**:

- **Schema** ([src/schemas/effects.ts](src/schemas/effects.ts)): `ability` is now optional on the `save` and `check` variants of `RollTarget`. `skill` stays mandatory (no analogous wildcard need yet).
- **`rollKey`** ([src/effects/builder.ts](src/effects/builder.ts)): no-ability case keys as `save:*` and `check:*`. The `*` sentinel can't collide with any ability score name.
- **`wildcardKeyFor`** (new helper): returns the wildcard key for a specific-ability target (or undefined for attack / damage / initiative / skill / wildcard-already queries).
- **`advantageFor(target, facts?)`**: merges unconditional entries at both the specific key and the wildcard, plus folds predicated entries from both. Existing unpredicated fast path preserved when wildcard is empty.
- **`advantageVsSource(target, sourceCharacterId)`**: same merge logic (specific + wildcard) for source-keyed advantage. No current canonical user uses wildcard-vs-source — pure plumbing parity per the slice 261 pattern-check norm.
- **`advantageVsBearersOfMyCondition(...)`**: same merge logic. Same parity rationale.

**Content rewrites** (1 magic item, 1 condition):

- **Mantle of Spell Resistance**: 6 per-ability `SetAdvantage on:{kind:'save',ability:X}` entries collapsed to 1 wildcard `SetAdvantage on:{kind:'save'}` entry, predicate unchanged. Same observable behavior (verified by the slice 258 Mantle tests still passing).
- **Poisoned**: 6 per-ability `SetAdvantage on:{kind:'check',ability:X}` entries collapsed to 1 wildcard. The attack-disadvantage entry stays as-is.

Net pack diff: **-11 effect entries** (12 collapsed to 1 + 7 collapsed to 2). No behavior change at any query site.

Pre-commit Uncle Bob audit:

- **Names**: `save:*` / `check:*` mirror the `*` glob convention; `wildcardKeyFor` is intention-revealing about its return semantics. The schema change exposes the wildcard via the type system (`ability?` rather than via a sentinel value), so future content authors get autocomplete support.
- **DRY**: the three readers (`advantageFor`, `advantageVsSource`, `advantageVsBearersOfMyCondition`) each have their own merge logic. Considered a shared `mergeAdvantageState` helper but the merge shapes diverge (advantageVsBearersOfMyCondition mutates a single result via the existing collect closure; the other two fold into a single AdvantageState). Inline merges keep each reader's intent visible.
- **SRP**: `wildcardKeyFor` does one thing (compute the wildcard key for a target). `rollKey` extended minimally — no-ability case picks the `*` sentinel; everything else unchanged.
- **Magic numbers**: `'*'` sentinel is documented as the wildcard convention in the `wildcardKeyFor` doc comment.
- **`at`-threading**: N/A (derive-only).
- **Plan/commit split preserved**: derive-only change.
- **Pattern-check applied**: extension done for all three advantage readers categorically (per slice 262 precedent — fix the audit-gap pattern across all instances, even when only one has a canonical user driving it).
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1686 tests across 244 files, was 1683) green. 3 new builder unit cases (wildcard save applies to every per-ability query, wildcard check merges with specific check entries, predicated wildcard merges with facts). No regressions: the 17 slice-258 Mantle tests + the 12 slice-264 poisoned tests + the 5 slice-265 skill-check inheritance tests all still pass — same observable behavior with the simplified wires.

**Open follow-ups (none critical)**:

- **`ModifierTarget` analog**: same pattern (per-ability `AddModifier` entries) appears in Aura of Protection (6 per-ability entries adding CHA mod to saves). A `{ kind: 'save' }` wildcard on `ModifierTarget` would collapse Aura of Protection 6→1 the same way. Not done here — RollTarget wildcards close the SetAdvantage cohort cleanly; ModifierTarget is its own cohort with its own canonical user (Aura of Protection) and deserves a focused slice.

**Engine: skill checks inherit underlying ability-check advantage (slice 265)**

Pattern-check follow-on from slice 264. After fixing poisoned to apply disadvantage on all 6 ability checks, a code-inspection of `computeAbilityCheck` surfaced that the inheritance is one-sided: **modifiers** correctly inherit from ability-check entries to skill checks (verified in the existing code — `modifierSum({ kind: 'check', ability })` is always added to the breakdown), but **advantage** does not. A poisoned character rolling Athletics had no disadvantage, even though RAW says a skill check IS an ability check + skill bonus + d20.

Real impact: 8 conditions in the pack have `SetAdvantage on:{kind:'check', ability:X}` entries that affect ability checks but NOT skill checks today (poisoned + frightened + bulls-strength-active / cats-grace-active / eagles-splendor-active / foxs-cunning-active / owls-wisdom-active / enlarged-active / reduced-active). All of these silently fail to apply to skill checks of their target ability. The fix is one site in the derive.

What changed:

- **`computeAbilityCheck` now queries `advantageFor` at both targets when a skill is specified**: the skill target (for skill-specific wires like Eyes of the Eagle's gated Perception advantage) AND the underlying ability's check target (for ability-check wires like poisoned's disadvantage or Bull's Strength's advantage). The two `AdvantageState` results merge with OR semantics, mirroring how `modifierSum` already adds both modifier sums.
- No schema changes. No `RollTarget` extension. Pure derive-level fix.

Pattern-check sweep (per slice 261 norm):

- **Saves**: no analogous inheritance needed (no "skill saves" in 5e).
- **Attacks / initiative**: no skill component, no inheritance needed.
- **`advantageVsSource` / `advantageVsBearersOfMyCondition`**: RAW canonical users (Bestow Curse, Precise Hunter) target `attack` only, not check/skill. No inheritance needed today; if a future user wants skill+source semantics, the same pattern applies.

Pre-commit Uncle Bob audit:

- **Names**: variables `skillAdv` + `checkAdv` + `adv` (the merged result) are intention-revealing. Merge is inline OR-of-fields rather than a helper because (a) one call site and (b) the field names need to read in context to confirm the merge is correct.
- **DRY**: the inline merge is 4 lines of identical-shape OR. Considered extracting a `mergeAdvantageState(a, b)` helper but it would be one-call-site-shallow and the inline form makes the merge semantic visible.
- **SRP**: derive owns the query semantics ("a skill check is an ability check + skill bonus"). The accumulator's `advantageFor` doesn't know about skill→ability inheritance — caller's responsibility, mirroring `modifierSum`.
- **Magic numbers**: none.
- **`at`-threading**: N/A (derive-only).
- **Plan/commit split preserved**: derive-only change.
- **Pattern-check applied**: confirmed no analogous inheritance needed for saves / attack / initiative / source-keyed advantage. Single-site fix.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1683 tests across 244 files, was 1678) green. 5 new ability-check unit cases (poisoned-on-Athletics, poisoned-on-Perception, Bull's-Strength-on-Athletics, Bull's-Strength-no-effect-on-Perception cross-ability, Eyes-of-the-Eagle regression). No regressions across the existing 1678 tests — including the slice 263 Eyes-of-the-Eagle tests (which use skill-only wires that don't trip the inheritance path).

**Content: poisoned condition disadvantage extended to all 6 ability checks (slice 264)**

Pattern-check continuation from slice 263. After fixing Eyes of the Eagle (broader-than-RAW SetAdvantage in items), the same shape sweep was extended to non-item content (class features / conditions / feats / species). The sweep surfaced **3 narrow-ability-check disadvantage entries** in conditions; cross-checked against SRD 5.2.1 narrowed it to:

1. **poisoned**: only STR + DEX disadvantage in pack. SRD 5.2.1: "Disadvantage on attack rolls and ability checks" (all 6 abilities). **Closed this slice**.
2. **frightened**: only STR disadvantage in pack. SRD 5.2.1: all 6 ability checks, BUT gated on "source of fear within line of sight." **Dual bug** — narrow on breadth AND broader on LoS axis. Tracked as deferred row; fixing only the breadth would worsen the LoS over-application. Needs `bearer.canSeeFearSource` predicate fact + consumer state (mirror of slice 263's Cloak of the Bat row).
3. **reduced-active** (Reduce spell): only STR disadvantage. SRD 5.2.1: "Disadvantage on Strength checks and Strength saving throws" (STR-only). RAW-correct, no fix needed.

What changed:

- **Poisoned condition in [src/content/packs/starter-pack.json](src/content/packs/starter-pack.json)** gains 4 missing `SetAdvantage on:check.{CON, INT, WIS, CHA} mode:disadvantage` entries alongside the existing STR + DEX. Now matches RAW: a poisoned character has disadvantage on every ability check.

Pre-commit short audit (content + correctness fix):

- **RAW citation**: SRD 5.2.1 `rules-glossary.md` Poisoned: "Disadvantage on attack rolls and ability checks." Confirmed against the local submodule.
- **DRY**: 4 new entries follow the same shape as the 2 existing STR / DEX entries. Could be replaced by a future `{ kind: 'check' }` (no ability) RollTarget variant for all-ability-check entries — same shape that would simplify Mantle of Spell Resistance's 6-entry verbosity. Tracked implicitly as a refactor opportunity but not done here (scope: this slice fixes correctness; a RollTarget-wildcard refactor would be its own slice).
- **Pattern-check applied**: sweep extended to non-item content (3 conditions found, 1 fixed, 1 dual-bug deferred with tracking, 1 verified RAW-correct). **Slice-267 retrospective note**: this sweep filtered specifically for "narrow disadvantage on per-ability check" and missed adjacent shapes — `dodged` and `blurred-active` have broader-than-RAW `ImposeDisadvantageOnAttackers` entries that the narrow filter didn't catch. Slice 267 tracked those as deferred rows. Meta-lesson: a pattern-check's filter shape determines what it can surface.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1678 tests across 244 files, was 1676) green. 2 new ability-check unit cases (poisoned has disadvantage on all 6 checks; unpoisoned has none). The previously-tested STR + DEX paths still pass via the loop; CON / INT / WIS / CHA are the newly-covered behaviors.

**Open follow-ups**:

- Frightened dual-bug (tracked).
- Potential `{ kind: 'check' }` no-ability RollTarget refactor (would simplify poisoned's 6 entries + Mantle of Spell Resistance's 6 entries; not done here).

**Engine: `sense?` on ability-check input + Eyes of the Eagle sight gate + ModifySpeed pattern-check finding (slice 263)**

First canonical user of slice 258's `SetAdvantage.condition` plumbing on ability checks (Mantle of Spell Resistance was the canonical user for saves). RAW: "Eyes of the Eagle — Advantage on WIS (Perception) checks that rely on sight." Prior wire was broader — advantage on every Perception check.

**Pattern-check** (per slice 261 norm): swept the pack for sibling SetAdvantage wires that are broader than RAW. Found three:

1. **Eyes of the Eagle** (advantage on Perception → should gate on `event.sense === 'sight'`) — **closed this slice**.
2. **Cloak of the Bat** (advantage on Stealth → should gate on dim light or darkness) — tracked as a deferred row; needs `bearer.lightLevel` predicate fact and scene/encounter state.
3. **Gloves of Swimming and Climbing** (advantage on Athletics → should gate on climb/swim sub-action) — tracked as a deferred row; needs sub-action discriminator on the ability-check input.

A fourth sibling (Sentinel Shield's advantage on Perception) was verified RAW-faithful (no sense gate per RAW).

Plumbing:

- New `sense?: 'sight' | 'hearing' | 'smell' | 'touch' | 'taste'` field on [`ComputeAbilityCheckInput`](src/derive/ability-check.ts). The consumer who knows the narrative context populates it; defaults to undefined ("consumer didn't specify").
- `computeAbilityCheck` populates the facts map with `event.sense: input.sense` and threads to `advantageFor(target, facts)` (slice 258's predicated path). Undefined sense → predicates requiring a specific sense evaluate false.

**Content wired (1 magic item)**:

- **Eyes of the Eagle** wire re-written: `SetAdvantage on:{kind:'skill', skill:'perception'} mode:'advantage'` with `condition: { kind: 'eq', path: 'event.sense', value: 'sight' }`. Previously the SetAdvantage applied unconditionally on every Perception check.

**Bonus pattern-check finding** (different category): while scoping Cloak of Arachnida's deferred row ("climb speed equal to walk speed"), a grep across `src/derive/` and `src/engine/` confirmed **0 consumers read non-walk ModifySpeed entries**. `getEffectiveSpeed` is walk-only; climb / fly / swim / burrow speeds contribute to the effect stack but go nowhere. Cloak of Arachnida's row updated with this finding so the next slice owner knows the real blocker is bigger than the deferred-row name suggested. Slippers of Spider Climbing's existing static-30 wire is RAW-discoverable annotation, not enforced behavior. Closing the climb-speed family requires either (a) extending `getEffectiveSpeed` to all modes + `op: 'matchWalkSpeed'`, or (b) shipping non-walk derives as their own slice first.

Pre-commit Uncle Bob audit:

- **Names**: `sense` matches the in-fiction vocabulary (sight / hearing / etc.). `event.sense` as a string fact is more extensible than the slice-227-row's projected `event.checkUsesSight` boolean: future predicates can gate on hearing / smell without adding more facts.
- **DRY**: the slice-258 predicated-SetAdvantage path is reused exactly. The only new code is the `sense?` field, the facts-map population, and the wire on Eyes of the Eagle.
- **SRP**: ability-check derive owns one new field (`sense`). The fact-population lives in the same place that already calls `advantageFor`. Consumer (UI, planner) decides what sense to specify; the engine just plumbs it.
- **Pattern-check applied**: 3 sibling broader-than-RAW SetAdvantage wires surfaced; 1 closed, 2 tracked with concrete deferred rows in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md). A 4th adjacent finding (non-walk ModifySpeed has no consumer) tracked on the existing Cloak of Arachnida row.
- **Magic numbers**: none.
- **`at`-threading**: N/A (derive-only).
- **Plan/commit split preserved**: derive-only change.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1676 tests across 244 files, was 1671) green. 5 new ability-check unit cases (Eyes advantage with sense=sight; no advantage with sense=hearing; no advantage when sense omitted; no advantage on non-Perception skills; no advantage without the item).

**Open follow-ups**:

- Cloak of the Bat Stealth gate (tracked in gaps doc).
- Gloves of Swimming and Climbing Athletics gate (tracked in gaps doc).
- Non-walk ModifySpeed derives missing (tracked on Cloak of Arachnida row).

**Engine: `condition` field honored on `GrantResistance` / `ModifyActionEconomy` / `GrantAdvantageToAttackers` (slice 262)**

First production application of the slice-261 pattern-check norm. Slice 258 fixed one effect kind (`SetAdvantage`) dropping its `condition` field and surfaced three siblings with the same shape; slice 258's open follow-up tracked them but deferred for lack of canonical users. The norm explicitly says "fix all instances of a pattern in one slice if scoped right" — this slice closes the audit gap categorically with pure plumbing + builder tests. 0 pack entries currently set `condition` on any of these kinds; future canonical users wire as one-line content edits.

**Plumbing** (all three mirror slice 258's two-storage pattern: keep the unconditional fast path, add a parallel predicated structure):

- **`GrantResistance`**: existing `resistances` map entries gain an optional `predicate` field (slice-112's `qualifier` shape extended). `addResistance(type, qualifier?, predicate?)`. `hasResistance(type, sourceIsMagical?, facts?)` filters entries by predicate before the qualifier check.
- **`ModifyActionEconomy`**: new `predicatedActionEconomy: Map<op, Array<{ count, predicate }>>` alongside the existing unconditional `actionEconomyMods: Map<op, number>`. `addActionEconomy(op, count, predicate?)` routes by presence. `actionEconomyTotal(op, facts?)` sums unconditional + filtered predicated.
- **`GrantAdvantageToAttackers`**: new `predicatedAdvantageToAttackers: Array<{ predicate }>` alongside the existing `advantageToAttackersFlag: boolean`. `markGrantsAdvantageToAttackers(predicate?)` routes by presence. `grantsAdvantageToAttackers(facts?)` returns flag OR any-predicate-match.
- `applyEffectToBuilder` now passes `effect.condition` for all three cases (previously dropped).

**No canonical users wired**. The slice-241/245/248/252 precedent permits primitive-only slices when the unblock has no near-term content driver. Future content slices wiring one of these kinds with a predicate will exercise the path end-to-end; today the builder unit tests pin the behavior.

Pre-commit Uncle Bob audit:

- **Names**: `predicatedActionEconomy` / `predicatedAdvantageToAttackers` mirror slice 258's `predicatedAdvantages`. The pattern is now a recognized convention — three predicated-storage maps in the builder, all named with the same prefix.
- **DRY**: the three changes share the same shape (unconditional fast path + predicated parallel structure), but each effect kind's storage is genuinely different (a per-type entries list for resistance; a per-op count map for action economy; a flag for the attackers debuff). Extracting a shared `predicatedStorage<T>` helper would be premature: 3 call sites, each with slightly different read semantics (qualifier check on resistance, count sum on action economy, any-match for attackers). The DRY-ness lives in the naming convention and the pattern.
- **SRP**: each setter / reader pair owns one effect kind's storage. Existing callers of the readers pass no facts and get the existing fast-path behavior; new predicated entries only apply when facts are supplied (mirroring slice 258's contract).
- **Magic numbers**: none introduced.
- **`at`-threading**: N/A (no events emitted).
- **Plan/commit split preserved**: derive-only change.
- **Pattern-check applied**: this slice IS the pattern-check on slice 258. Three sibling effect kinds had the same audit-gap shape; closed categorically rather than as canonical users emerge. The slice 261 norm called for exactly this approach.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1671 tests across 244 files, was 1664) green. 7 new builder unit cases (2 each for the three effect kinds: predicated entry gated on facts + unpredicated fast path preserved; plus 1 merged predicated+unpredicated test for ModifyActionEconomy). All 26 prior builder tests + 1664 prior suite tests unaffected.

**Open follow-ups**:

- None for this slice. The audit-gap pattern (inert `condition` on effect kinds) is now fully closed. Future canonical users wire as content edits.

**Docs: pattern-check-on-bugs working norm codified in CLAUDE.md (slice 261)**

Codifies the working norm that surfaced through slices 252, 254, and 258: when finding a bug, audit gap, or inconsistency in this codebase, check it against a pattern across the codebase before fixing only the surfaced instance. Each of those slices started as a single observation that turned out to be a pattern (slice 252: one broken link → 207 broken links across 14 archive files; slice 258: one effect kind dropping `condition` → four with the same shape; slice 254: one coverage-matrix filter missing `onUse`). Fixing only the surfaced instance leaves the latent bug elsewhere.

What changed:

- New **"Pattern-check on bugs"** subsection in [CLAUDE.md](CLAUDE.md), placed under "Working norms" between the Uncle Bob audit and "Doc updates per slice." Naming the norm makes it discoverable to fresh agents; positioning it next to the Uncle Bob audit ties it to the same "audit before commit" discipline.
- The subsection cites the three concrete examples (slices 252, 254, 258) so a reader sees the pattern shape rather than an abstract rule.
- The companion CHANGELOG closure-annotation convention (slice 260) gets a one-line note in the same subsection — when a later slice closes a tracked follow-up, the original entry gets struck through with a "Closed by slice N" tag.
- CLAUDE.md size: 31.7 KB → 33.7 KB. Comfortably under the 60 KB single-Read ceiling.

Pre-commit short audit (docs slice):

- **Names**: "Pattern-check on bugs" reads as imperative for the agent (the entity reading the doc); avoids "engineering" / "team" framing because Claude is the primary author of this codebase. The norm explicitly says so in its rationale.
- **DRY**: the norm appears once, in CLAUDE.md. The auto-memory entries at `~/.claude/projects/.../memory/pattern-check-on-bugs.md` and `changelog-closure-annotation-convention.md` mirror the same content for session persistence; the CLAUDE.md version is the authoritative source. Linked memory entries cite the CLAUDE.md section, not vice versa.
- **SRP**: pure docs slice. No code or test surface touched. The norm prescribes how to approach future bugs; it doesn't itself fix any.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1664 tests across 244 files) green; CLAUDE.md still fits in a single Read.


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

*Slice detail for slices 48-260 has been moved out of the live CHANGELOG to per-cohort archives under [docs/changelog/](docs/changelog/) (single-Read fitness; slices 252-260 were archived in slice 270; the alpha.6 release block of slices 241-250 was archived in slice 252; older slices were archived in slice 248). Each fits in a single Read tool call:*

- *[archive-slices-252-260.md](docs/changelog/archive-slices-252-260.md) (post-alpha.6 polish + audit-gap-fix trio + closure-annotation convention)*
- *[archive-slices-241-250.md](docs/changelog/archive-slices-241-250.md) (alpha.6 release block, slices 241-250)*
- *[archive-slices-235-240.md](docs/changelog/archive-slices-235-240.md)*
- *[archive-slices-217-234.md](docs/changelog/archive-slices-217-234.md)*
- *[archive-slices-201-216.md](docs/changelog/archive-slices-201-216.md)*
- *[archive-slices-196-200.md](docs/changelog/archive-slices-196-200.md) (also covers monster batches 5.x + subclass batches 1.x)*
- *[archive-slices-186-195.md](docs/changelog/archive-slices-186-195.md)*
- *[archive-slices-177-185.md](docs/changelog/archive-slices-177-185.md)*
- *[archive-monsters-batch-4.md](docs/changelog/archive-monsters-batch-4.md) (monsters batch 4.x)*
- *[archive-items-batch-4.md](docs/changelog/archive-items-batch-4.md) (items batch 4.x)*
- *[archive-slices-172-176.md](docs/changelog/archive-slices-172-176.md)*
- *[archive-content-batches-1.md](docs/changelog/archive-content-batches-1.md) (monsters batch 1.x + items batch 1.x)*
- *[archive-rollup-narrative-A.md](docs/changelog/archive-rollup-narrative-A.md) (slices 48-171 rollup, first half)*
- *[archive-rollup-narrative-B.md](docs/changelog/archive-rollup-narrative-B.md) (slices 48-150 rollup, second half + tail of Unreleased)*

*Released versions (alpha.0 through alpha.5) of the pre-rename package were moved to [docs/changelog/released-versions.md](docs/changelog/released-versions.md).*


## Released versions

Released versions (alpha.0 through alpha.5) of the pre-rename `ttrpg-engine-dnd` package live in [docs/changelog/released-versions.md](docs/changelog/released-versions.md). All were unpublished from npm in May 2026 on IP-cleanup grounds; the renamed `dnd-srd-engine` package has not yet cut a fresh release.
