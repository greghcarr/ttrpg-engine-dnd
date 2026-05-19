# Changelog archive: slices 186-195 (post-alpha.5, content-audit sweep)

Originally in the `## Unreleased` section of [../../CHANGELOG.md](../../CHANGELOG.md). Moved here in slice 248 to keep the live CHANGELOG under the single-Read ceiling.

This window covers slices 186-195, the SRD 5.2.1 content-audit sweep — drift fixes against the markdown clone across spell metadata (concentration / duration / AoE size / damage dice / class lists / Enhance Ability alignment / attack kinds / components / castingTime / range / school) plus magic item rarity + attunement + Epic Boon prerequisites.

Order: most-recent first. For more recent slices, see [archive-slices-196-200.md](archive-slices-196-200.md). For older, see [archive-slices-177-185.md](archive-slices-177-185.md).

---

**Engine: SRD 5.2.1 drift audit harness (slice 195)**

Adds [tests/audit/srd-drift.test.ts](../../tests/audit/srd-drift.test.ts), a checked-in vitest suite that parses the SRD 5.2.1 markdown clone at `references/srd-markdown/` and asserts every pack spell, monster, and magic item matches SRD on script-detectable fields. Slices 177-194 used the same logic ad-hoc to ship ~310 drift fixes; the harness now catches regressions automatically.

The suite is organized as three nested describes (spells, monsters, magic items) with 15 `it()` blocks covering:

- Spells: school, level, class list, V/S/M component presence, concentration flag, ritual flag, halfOnSuccess for damage-save spells, attackKind presence for attack-mechanic spells, damage dice for attack/save mechanics.
- Monsters: AC, HP (average), CR, ability scores.
- Magic items: rarity, attunement requirement.

If `references/srd-markdown/spells.md` is absent (fresh worktree without the symlink from the primary), the suite skips itself with a clear note rather than failing. Verified harness detection by injecting a synthetic regression (fire-bolt school evocation to conjuration) and confirming the spell-school audit failed with the expected message.

CLAUDE.md's SRD-source-of-truth section now points at the harness.

Tests: 1466 pass (1451 existing + 15 new audits), tsc --noEmit clean.

**Content audit: spell AoE targeting backfill (slice 194)**

Audited every pack spell against SRD body for AoE shape + size phrasing. Found 33 spells whose SRD bodies describe an area but where the pack's `targeting` field was unset. Added the field for 28 of them; skipped wall-of-ice (its "10-foot-square" describes object construct sections, not damage AoE) and disintegrate (cube describes target-corpse cleanup, not damage area).

Fields added:
- sphere (10): aura-of-life 30, conjure-minor-elementals 15, conjure-woodland-beings 10, mass-cure-wounds 30, globe-of-invulnerability 10, antimagic-field 10, holy-aura 30, meteor-swarm 40, acid-splash 5, purify-food-and-drink 5, flaming-sphere 5, pass-without-trace 30
- cube (12): fabricate 10, hallucinatory-terrain 150, creation 5, guards-and-wards 50, heroes-feast 10, move-earth 40, programmed-illusion 30, druidcraft 5, minor-illusion 5, alarm 20, create-or-destroy-water 30, silent-image 15, phantasmal-force 10
- cylinder (2): conjure-celestial 40, reverse-gravity 100
- cone (1): dragons-breath 15

The `targeting` field is documentation-only at the engine layer today (no planner reads it; pack convention is to also encode shape into the planner's logic), so this is data-completeness rather than runtime drift. Improves downstream consumer accuracy.

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: spell material text bulk normalization (slice 193)**

Audited every pack spell's M-component text against the SRD body's parenthesized material description. 126 mismatches found and fixed in one pass. Most are SRD 5.2.1 simplifications of 2014 PHB phrasings (the 2024 PHB systematically pared back material flavor text); a smaller subset are RAW reworks where the SRD changed the material entirely.

Representative changes:
- fireball: "a tiny ball of bat guano and sulfur" to "a ball of bat guano and sulfur".
- hold-person, hold-monster: dropped "small" qualifier per SRD.
- bless: "a sprinkling of holy water" to "a Holy Symbol worth 5+ GP" (RAW change, not normalization).
- banishment: "an item distasteful to the target" to "a pentacle".
- flame-strike: added missing article ("pinch of sulfur" to "a pinch of sulfur").
- stoneskin, awaken, greater-restoration, hallow: now carry the "which the spell consumes" RAW suffix.
- private-sanctum / resilient-sphere / creation / dream / insect-plague / telepathic-bond: substantially simplified materials per SRD.

Material text is documentation-only (the engine doesn't validate / cost it), but RAW accuracy matters for downstream consumers who render the spell description.

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: magic item attunement conditions (slice 192)**

Audited every pack magic item's `attunementCondition` against the SRD 5.2.1 type-line restriction. Four real drifts (others were pack-convention normalization: pack uses bare class nouns like "Spellcaster" / "Paladin" / "Dwarf" where SRD uses "a Spellcaster" / "a Paladin"; that's a normalization choice, not drift):

- staff-of-charming: condition "Spellcaster" to "Bard, Cleric, Druid, Sorcerer, Warlock, or Wizard". SRD restricts to a specific class list, not a generic spellcaster.
- dwarven-thrower: condition "Dwarf" to "Dwarf or a creature attuned to a Belt of Dwarvenkind". SRD 5.2.1 adds the alternative attunement path.
- wand-of-wonder: removed condition. SRD requires plain attunement, no class restriction; pack had added a "Spellcaster" gate that doesn't exist in RAW.
- wand-of-binding: same as wand-of-wonder.

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: spell range text (slice 191)**

Strict full-text range audit against the SRD Range line, with allowance for the pack's "Self (15-foot cone)" / "Self (X-foot radius)" descriptive variants that wrap SRD's bare "Self". One real drift:

- blindness-deafness: pack "30 feet" to "120 feet" per SRD 5.2.1.

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: spell duration text (slice 190)**

Strict full-text duration audit against the SRD's Duration line. Four drifts beyond slice 178 / 188:

- guidance: pack "1 minute" to "Concentration, up to 1 minute". Pack already had concentration: true; just the duration string was 2014-flavored.
- conjure-animals: pack "Concentration, up to 1 hour" to "Concentration, up to 10 minutes". Same shape as the slice-178 conjure-elemental / conjure-fey duration nerf in SRD 5.2.1.
- glyph-of-warding: pack "Until dispelled" to "Until dispelled or triggered". SRD adds the trigger clause to the duration string.
- sending: pack "1 round" to "Instantaneous". SRD 5.2.1: Instantaneous.

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: spell halfOnSuccess (slice 189)**

Audited every save-and-damage spell's `halfOnSuccess` flag against the SRD body's "half as much damage on a successful save" phrasing. One drift:

- weird: `halfOnSuccess: false` to `true`. SRD: "On a successful save, a target takes half as much damage only." Pack had it false from a misread of the spell's frightened-stage mechanic.

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: more spell concentration / duration drift (slice 188)**

Audited every pack spell's `concentration` flag against the SRD body's Duration line. Three additional drifts found beyond what slice 178 caught:

- Barkskin: pack `concentration: true` + duration "Concentration, up to 1 hour" to `concentration: false` + duration "1 hour". SRD 5.2.1 reframed Barkskin as non-concentration; pack carried the 2014 PHB concentration.
- Enthrall: pack `concentration: false` + duration "1 minute" to `concentration: true` + duration "Concentration, up to 1 minute". SRD 5.2.1: "Concentration, up to 1 minute"; pack had dropped the concentration.
- Magic Weapon: pack `concentration: true` + duration "Concentration, up to 1 hour" to `concentration: false` + duration "1 hour". SRD 5.2.1 dropped concentration.

This catches stragglers from the slice-178 sweep that the heuristic missed (slice 178 looked at spells whose pack duration string mentioned "Concentration" without cross-checking the SRD's Duration line; these three had duration / concentration combinations that slice 178's checks didn't trigger on).

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: Epic Boon prerequisites (slice 187)**

Audited feat prerequisites against SRD 5.2.1 type-line. All six SRD-derived Epic Boons (Combat Prowess, Dimensional Travel, Irresistible Offense, Spell Recall, the Night Spirit, Truesight) had empty `prerequisites` arrays but SRD 5.2.1 lists them all as requiring Level 19+. Spell Recall additionally requires the Spellcasting Feature.

Added the missing prerequisites:

- boon-of-combat-prowess: `["Level 19+"]`
- boon-of-dimensional-travel: `["Level 19+"]`
- boon-of-irresistible-offense: `["Level 19+"]`
- boon-of-spell-recall: `["Level 19+", "Spellcasting Feature"]`
- boon-of-the-night-spirit: `["Level 19+"]`
- boon-of-truesight: `["Level 19+"]`

The audit also flagged that all 9 Epic Boons in the pack are still schema-only (empty `effects` arrays). The slice-152 audit classified them as wired, but they actually need engine work to model their multi-mechanic bodies (ASI choice between abilities + situational benefits). Noted for future content authoring; not in this slice's scope.

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: spell AoE sizes (slice 186)**

Audited spell `targeting.shape` + `targeting.size` against SRD body text. Two real drifts (others were script artifacts where cylinder height vs radius are both present in the body):

- sleep: targeting size 20 to 5. SRD 5.2.1 Sleep is a 5-foot-radius Sphere; pack carried the 2014 PHB 20-foot-radius. Note: the spell's hp-pool-knockout mechanical-effect shape is still 2014-flavored (SRD 5.2.1 reframed Sleep as a WIS-save Incapacitate progression). That mechanic rewrite is a future slice; this one only corrects the targeting size.
- sleet-storm: cylinder size 40 to 20. SRD 5.2.1: 20-foot-radius, 40-foot-high Cylinder. Pack had stored the height (40) where the size field should hold the radius (matches pack convention for other cylinder spells: ice-storm 20 radius, flame-strike 10 radius, moonbeam 5 radius, magic-circle 10 radius, call-lightning 60 radius).

Audit also noted: pack uses `cube` for SRD's "Square" shape and `sphere` for SRD's "Emanation" shape because the engine schema only has cone / cube / line / sphere / cylinder. These are conscious modeling decisions, not drift.

Tests: 1451 pass, tsc --noEmit clean.

