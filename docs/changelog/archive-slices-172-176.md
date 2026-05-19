# Changelog archive: slices 172-176 (post-alpha.5, class-feature audits)

Originally in the `## Unreleased` section of [../../CHANGELOG.md](../../CHANGELOG.md). Moved here in slice 248 to keep the live CHANGELOG under the single-Read ceiling.

This window covers the 5 slice-numbered audit entries 172-176: class feature level placements, class-feature 2014-flavor sweep, class resource pool value drift, Monk Ki + Sorcerer Sorcery Points linear scaling, Fighter Indomitable + Druid Wild Shape uses.

Order: most-recent first. For more recent slices, see [archive-slices-177-185.md](archive-slices-177-185.md). For older content batches (1.x), see [archive-content-batches-1.md](archive-content-batches-1.md). For the slices 48-171 bulk-narrative rollup, see [archive-rollup-narrative-A.md](archive-rollup-narrative-A.md) and [archive-rollup-narrative-B.md](archive-rollup-narrative-B.md).

---

**Content audit: Fighter Indomitable + Druid Wild Shape uses (slice 176)**

SRD 5.2.1 value-drift sweep continued.

- Fighter Indomitable: pack had `indomitable-3` (third long-rest use) at L20. SRD 5.2.1 says "three times before a Long Rest starting at level 17"; pack was off by three levels. Moved `indomitable-3` from L20 to L17 (now sharing the L17 row with `action-surge-2`). L20 now has only `extra-attack-3`.
- Druid Wild Shape uses: pack progression 2/3/4/5/6 at L2/L5/L9/L13/L17 didn't match the SRD 5.2.1 Druid Features table (2 at L2-L5, 3 at L6-L16, 4 at L17-L20). Net edits: dropped L5 `wild-shape-uses-3` (L2's 2 still applies through L5), moved the L6 step from L9 to L6 (RAW), dropped L9 / L13 entries (no Wild Shape bump at those levels), changed L17 from max=6 to max=4 (RAW cap).

Snapshot: features wired-class-features refreshed.
Tests: 1452 pass, tsc --noEmit clean.

**Content audit: Monk Ki + Sorcerer Sorcery Points linear scaling (slice 175)**

SRD 5.2.1 follow-up to slice 174. Both Monk Focus Points (Ki) and Sorcerer Sorcery Points scale linearly with class level per the Monk Features and Sorcerer Features tables (Ki = Monk level at L2+; Sorcery Points = Sorcerer level at L2+). The pack modeled both with hardcoded multi-tier grants at L2/L5/L10/L15/L20 (Monk) and L2/L5/L10/L15/L17/L20 (Sorcerer), which produced correct totals only at the granted levels and stale-low totals in between (e.g., L3 Monk had 2 Ki instead of 3).

- Monk: kept the L2 `monks-focus` grant but changed `max: 2` to `max: { kind: "level", classId: "monk" }`. Dropped the L5 `ki-uses-5`, L10 `ki-uses-10`, L15 `ki-uses-15`, and L20 `ki-uses-20` redundant entries.
- Sorcerer: kept the L2 `font-of-magic` grant but changed `max: 2` to `max: { kind: "level", classId: "sorcerer" }`. Dropped L5 `sorcery-points-5`, L10 `sorcery-points-10`, L15 `sorcery-points-15`, L17 `sorcery-points-17`, and L20 `sorcery-points-20` redundant entries.

Made possible by the slice 174 GrantResource Formula fix.

Snapshot: features wired-class-features refreshed (nine entries dropped).

Tests: 1452 pass, tsc --noEmit clean.

**Engine + content audit: class resource pool value drift (slice 174)**

SRD 5.2.1 value-drift sweep for class resource pools. The audit caught four real bugs in pool sizes that the pack hardcoded with 2014 PHB values (or with values that simply diverged from RAW).

Engine fix in [src/effects/builder.ts](../../src/effects/builder.ts): the `GrantResource` builder case previously only handled numeric `max` values and silently dropped Formula values. Two existing features in the pack (Wizard Arcane Recovery, Paladin Lay on Hands) were affected; they'd been defined with Formula `max` shapes since slice ~50 but the resource grant never reached the accumulator. Builder now evaluates the Formula via `ctx.formulaContext` (same path as `AddModifier`'s Formula branch). No new schema; just lifts the existing silent-drop.

Content fixes in [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json):

- Cleric Channel Divinity: 1/2/3 to 2/3/4 at L2/L6/L18. SRD 5.2.1 Cleric Features table shows the Channel Divinity column starting at 2 and stepping up at L6 and L18; pack was off-by-one throughout.
- Paladin Channel Divinity: added L11 grant (max = 3). SRD says "You gain an additional use when you reach Paladin level 11"; pack had only the L3 grant (max = 2) and never bumped.
- Fighter Second Wind: added L4 (max = 3) and L10 (max = 4) grants. SRD Fighter Features table shows the Second Wind column at 2 (L1-3), 3 (L4-9), and 4 (L10-20); pack only set L1's 2.
- Bardic Inspiration uses: hardcoded 3 (all four level rows) to formula `max(1, abilityMod CHA)`. SRD: "You can confer a Bardic Inspiration die a number of times equal to your Charisma modifier (minimum of once)." Applied to all four Bardic Inspiration grants (L1, L5, L10, L15). Made possible by the GrantResource Formula fix above.

Snapshot: features-test wired-class-features refreshed for the four new wired entries (Fighter L4 / L10 Second Wind bumps, Paladin L11 Channel Divinity bump). The Bardic Inspiration L1/L5/L10/L15 entries were already wired and stay in place.

Tests: 1452 pass, tsc --noEmit clean.

**Content audit: class feature 2014-flavor sweep (slice 173)**

SRD 5.2.1 follow-up to slice 172. Four more entries closed from the class-audit's pack-only-features table.

- Paladin L11: Radiant Strike renamed to Radiant Strikes (SRD spelling, plural). Pack id `radiant-strike` to `radiant-strikes`.
- Monk L18: Empty Body (2014 capstone) renamed to Superior Defense (SRD 5.2.1 L18). Pack id `empty-body` to `superior-defense`. Effects array remains empty (schema-only on both sides).
- Monk L7: Step of the Wind: Heightened Mobility dropped. 2014-flavored feature with no SRD 5.2.1 analog; SRD has Evasion as the L7 grant, which the pack already wires.
- Warlock L3: Pact Boon dropped. 2014 PHB feature; SRD 5.2.1 handles Pact Boon as an Eldritch Invocation option starting at L1 and reserves L3 for Warlock subclass selection (already modeled via the subclass machinery, not a feature entry).

Remaining pack-only-features entries (Cleric L2 Divine Spark as a separate feature; Sorcerer L20 Sorcery Points (20)) are schema / modeling differences, not drift; kept as-is. None of the renames or drops were referenced in tests, src, or docs outside the pack itself.

Tests: 1452 pass, tsc --noEmit clean. No snapshot refresh needed (all four edits touch only schema-only features absent from the wired-feature catalog).

**Content audit: class feature level placements (slice 172)**

SRD 5.2.1 audit follow-up to slice 153's class-feature drift list. Twelve placement fixes across six classes plus one rename, all from data-side edits to starter-pack.json class `levelGrants`. No engine code touched.

- Fighter: Tactical Mind L5 to L2, Tactical Shift L9 to L5, Tactical Master L11 to L9.
- Bard: Expertise L3 to L2 (now sits alongside Jack of All Trades), Superior Inspiration L20 to L18.
- Cleric: Channel Divinity L1 to L2 (now shares L2 with Divine Spark), Improved Blessed Strikes L17 to L14, renamed Improved Divine Intervention to Greater Divine Intervention at L20.
- Rogue: Reliable Talent L11 to L7 (now shares L7 with Evasion), Improved Cunning Strike L14 to L11, Devious Strikes L18 to L14.
- Ranger: Nature's Veil L9 to L14.
- Evoker (Wizard subclass): Sculpt Spells L3 to L6 (now lives in its own L6 `levelGrants` entry separate from Evocation Savant at L3).

Slice 153's audit also flagged Barbarian Improved Brutal Strike L13 to L17. That entry was incorrect: SRD 5.2.1 has Improved Brutal Strike at BOTH L13 (first additional Brutal Strike option) AND L17 (second additional option), as two separate features. The pack already places them at L13 and L17, so no edit was needed.

Tests: features-test wired-class-features snapshot refreshed (Bard L2 expertise, Cleric L2 channel-divinity replacing L1, plus the three Rogue moves) by `npx vitest run tests/coverage/features.test.ts -u`. All 1452 tests pass; tsc --noEmit clean.
