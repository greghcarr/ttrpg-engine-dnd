# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The bump policy and pre-release roadmap are documented in [VERSIONING.md](VERSIONING.md).

## Unreleased

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
- **Pattern-check applied**: sweep extended to non-item content (3 conditions found, 1 fixed, 1 dual-bug deferred with tracking, 1 verified RAW-correct).
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

**Docs: closure annotations on past CHANGELOG `Open follow-ups` blocks (slice 260)**

Closes the third of the three audit-gap findings: past CHANGELOG entries kept their `Open follow-ups` text frozen, so when a subsequent slice closed one of those follow-ups, the original entry didn't reflect it. A reader landing on slice 253's entry saw an open follow-up that had actually been closed two slices later (slice 254); slice 256's content-sweep follow-up was closed by slice 257 with no back-link in slice 256.

What changed:

- **Slice 253 (live CHANGELOG)**: `~~strikethrough~~` + "Closed by slice 254" annotation on the "feature-coverage matrix doesn't count `onUse` wires" follow-up. The variable-cost-on-Toggle-and-ApplyCondition row kept open with an explicit "Still open (no canonical user yet)" tag.
- **Slice 256 (live CHANGELOG)**: `~~strikethrough~~` + "Closed by slice 257" annotation on the "Content sweep wiring Wand of Fireballs / Lightning Bolts / Staff of Healing" follow-up. The Wind Fan `eachUse` trigger row kept open with "Still open" tag (Wind Fan's `effects: []` still defers it).
- **Slice 248 (archived in [docs/changelog/archive-slices-241-250.md](docs/changelog/archive-slices-241-250.md))**: `~~strikethrough~~` + "Closed by slice 249" annotation on the "`docs/starter-pack-gaps.md` is 410 KB and already over the ceiling" follow-up. The CONTRIBUTING.md / DEVELOPMENT.md size row + the archive-files-are-append-mostly row kept open with explicit "Still open" tags.
- **Convention going forward**: every existing-but-closed follow-up gets a `~~strikethrough~~` + `**Closed by slice N.**` tag. Every still-open one gets an explicit `**Still open.**` tag. New `Open follow-ups` blocks in future slices ship with the same shape from day one (already done for slices 258 + 259, going forward this becomes the norm).

What's unchanged:

- Inline prose mentions of deferred items inside RAW-deviation sections (e.g. slice 253's "the degradation roll stays deferred" line, which described accurate state at slice 253 time before slice 256 closed it). These are historical narrative rather than tracked follow-ups; leaving them avoids retconning each entry's contemporaneous context.

Pre-commit short audit (docs slice):

- **Names**: closure annotations use the `~~...~~ **Closed by slice N.**` shape (struck text + bold annotation). Still-open items use `**Still open.**`. The annotation lives at the end of the item rather than the start so the original text still reads as it did historically.
- **DRY**: same annotation pattern applied across two CHANGELOG files (live + the slice-252 archive). The pattern is the doc-hygiene convention; the per-item content is unique.
- **SRP**: pure doc-hygiene change. No code, no schemas, no test surface touched.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1664 tests across 244 files) green. `grep -E "Open follow-ups" CHANGELOG.md docs/changelog/archive-*.md` returns the same blocks pre / post; only the per-item lines changed.

**Tests: `inventory` + `attunedInstanceIds` on `buildFighter` / `buildOgre` fixtures (slice 259)**

Closes the second of the three audit-gap findings: the test fixtures populated `state.itemInstances` (via `ItemAcquired` events) but didn't expose a way to seed the character's `inventory` array. Tests using `planUseItem` / `planConsumeItem` / inventory reducers had to spread + reassign manually (`const hero = { ...buildFighter(), inventory: [item.id] }`). Slice 256's `ItemDestroyed` reducer test hit this footgun.

What changed:

- `BuildFighterOptions` gains two optional fields: `inventory?: string[]` (item instance ids to seed the character's `inventory` array) and `attunedInstanceIds?: string[]` (ids to seed `equipped.attuned`, since slice-132 magic-item projection skips attunement-required items not in that list).
- Same shape added to `BuildOgreOptions` so creature-side tests have parity.
- Defaults preserve prior behavior (empty arrays match what every existing caller passed implicitly).
- The slice-256 `ItemDestroyed` reducer test refactored from `{ ...buildFighter(), inventory: [wand.id] }` to `buildFighter({ inventory: [wand.id] })` as the demonstration + regression check.

Pre-commit short audit (DX slice):

- **Names**: `inventory` matches the `Character.inventory` field name (no surprise translation). `attunedInstanceIds` is more verbose than `attuned` to avoid confusion with the per-instance `ItemInstance.attuned` boolean.
- **DRY**: same shape added to both fixtures; could have been factored into a shared helper but two siblings is below the abstraction threshold and the two fixtures are otherwise distinct (Fighter takes ability scores, Ogre takes multiattack config).
- **SRP**: pure additive change to fixture construction; no engine surface touched.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1664 tests across 244 files) green. The refactored slice-256 test exercises the new option end-to-end; all other tests unaffected (defaults match prior behavior).

**Engine: SetAdvantage.condition honored + event.isSpellSave + Mantle of Spell Resistance (slice 258)**

Closes the first of the three audit-gap findings surfaced after slice 257. The `SetAdvantage` effect kind declares a `condition?: Predicate` field in its schema but the effect-stack builder silently dropped it (line 692-694 pre-slice). 0 pack entries currently set the condition, so no behavior was broken in production — but the schema documented a capability the runtime didn't support, blocking multiple deferred-primitives rows (Mantle of Spell Resistance, Eyes of the Eagle, Boots of Speed's opportunity-attack gate).

**Plumbing**:

- New `predicatedAdvantages: Map<string, Array<{ mode, predicate }>>` storage in [src/effects/builder.ts](src/effects/builder.ts), mirroring the slice-66 `conditionImmunities` shape. Kept distinct from the unconditional `advantages` map so the existing fast path pays no evaluation cost.
- `setAdvantage(target, mode, predicate?)` now accepts an optional predicate; routes to the predicated map when set, the existing unconditional map otherwise.
- `advantageFor(target, facts?)` accepts optional facts; merges unconditional state with predicated entries whose predicate evaluates true against the facts.
- `applyEffectToBuilder`'s `SetAdvantage` case now passes `effect.condition` (previously dropped).
- `computeSavingThrow` in [src/derive/save.ts](src/derive/save.ts) threads a facts map carrying `event.isSpellSave: input.sourceIsMagical === true` to `advantageFor`. The fact name uses "spell save" semantics; the value reflects "spell or magical source" (matching slice 131's Magic Resistance handling). The engine doesn't distinguish strict-spell from non-spell magical sources today; conservative extension grants advantage on a broader set of saves than strict RAW (more saves benefit, never fewer).

**Content wired (1 magic item)**:

- **Mantle of Spell Resistance** (rare wondrous, requires attunement): 6 `SetAdvantage` entries, one per ability score (STR / DEX / CON / INT / WIS / CHA), each with `condition: { kind: 'eq', path: 'event.isSpellSave', value: true }`. Matches the slice-105 Aura of Protection precedent (6 per-ability AddModifier entries for "saves with CHA mod added"). RAW: "Advantage on saving throws against spells."

**Other inert `condition` fields surfaced but deferred**:

- `GrantResistance.condition` (builder.ts:707), `ModifyActionEconomy.condition` (line 759), `GrantAdvantageToAttackers.condition` (line 809) all have the same audit-gap shape but no current canonical user. Tracked in [docs/starter-pack-gaps.md](docs/starter-pack-gaps.md) as a single deferred row pointing at slice 258 for the pattern. Each closes as a canonical user emerges (mirror of how SetAdvantage waited for Mantle).

Pre-commit Uncle Bob audit:

- **Names**: `predicatedAdvantages` mirrors the slice-66 / slice-91 pattern naming (predicated vs unconditional). `event.isSpellSave` matches the deferred-row wording in the gaps doc; the underlying value is `sourceIsMagical` but the fact name documents the consumer-facing semantic.
- **DRY**: storage split (predicated vs unconditional) chosen specifically to avoid paying predicate-evaluation cost on the existing unpredicated entries (55 SetAdvantage entries in the pack, 0 of which set `condition`). The slow path runs only when a predicated entry is actually present.
- **SRP**: setter routes by presence of predicate; reader merges by filtering predicates against facts. No mixed concerns. The fact-population lives in the save derive (the only consumer that currently passes facts); other `advantageFor` callers (ability-check, encounter / initiative) continue passing no facts — their canonical users are deferred rows that will plumb facts themselves when they ship.
- **Magic numbers**: none. Mantle's 6 entries match the 6 ability scores (RAW); not extracted to a helper because identical inline JSON is more grep-able than abstracted iteration.
- **`at`-threading**: N/A (no events emitted by this slice).
- **Plan/commit split preserved**: derive-only change. No RNG, no event emission.
- **Mechanical outcomes asserted**: tsc clean; full vitest suite (1664 tests across 244 files, was 1657) green. 3 new builder unit cases (predicated entry gated on facts, unpredicated fast path preserved, merged predicated+unpredicated behavior). 4 new save-derive cases (Mantle advantage on spell save, no advantage on non-spell save, advantage applies on all 6 abilities, un-attuned Mantle doesn't project). Coverage snapshot updated: `mantle-of-spell-resistance` joins `wiredIds` (no longer `effects: []`).

**Open follow-ups (none critical)**:

- ~~3 sibling inert `condition` fields tracked in the gaps doc. Each is a content-driven follow-up.~~ **Closed by slice 262** (pattern-check applied per slice 261 norm — all three threaded through the builder + builder tests added; no canonical users wired this slice).
- The `event.isSpellSave` fact ties to `sourceIsMagical` (which covers spell and non-spell magical sources). A future stricter "is this specifically a spell save vs a non-spell magical save" predicate would require distinguishing those at the save-call sites; today the engine uses the broader semantic everywhere.
- Other `advantageFor` callers (ability-check, encounter / initiative) accept the new optional `facts` parameter but don't populate it. Eyes of the Eagle (sight-only Perception), Bracers of Archery (weapon-type gates) etc. would populate facts at those sites when their canonical users ship.

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

- ~~**Content sweep** (small, 3 items): wire Wand of Fireballs, Wand of Lightning Bolts, Staff of Healing with identical `destructionRoll: { trigger: 'lastChargeExpended', die: 20, destroyOn: [1] }`. Pure JSON edit + snapshot update.~~ **Closed by slice 257.**
- **Wind Fan `eachUse` trigger** (small, 1 item): extend the trigger union to include `'eachUse'`. The probabilistic-tear shape (20% per use) maps cleanly: `destructionRoll: { trigger: 'eachUse', die: 20, destroyOn: [1, 2, 3, 4] }` (4/20 = 20%) or `{ die: 5, destroyOn: [1] }`. Defer until Wind Fan itself gets onUse wires (currently `effects: []`). **Still open.**

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

- ~~The feature-coverage matrix at [tests/coverage/features.test.ts](tests/coverage/features.test.ts) classifies magic items as "wired" based on the `effects` array only; `onUse` wires (slices 240-243 + 253) are invisible to the matrix. The unwired-items list still shows `wand-of-magic-missiles` (and the other onUse-wired items: `wings-of-flying`, `boots-of-speed`, `boots-of-levitation`, `hat-of-disguise`, `staff-of-healing`) as if nothing happened. A snapshot fix that counts items with non-empty `onUse` would close this hole; not done here to keep the slice focused on the primitive.~~ **Closed by slice 254.**
- Variable cost on the `Toggle` and `ApplyCondition` UseAction variants stays deliberately unsupported. Neither has a per-charge scaling axis. If a future canonical user needs variable cost on those kinds, the same helper can be extended. **Still open (no canonical user yet).**

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
