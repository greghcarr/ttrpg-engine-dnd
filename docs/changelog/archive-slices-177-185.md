# Changelog archive: slices 177-185 (post-alpha.5, more content audits)

Originally in the `## Unreleased` section of [../../CHANGELOG.md](../../CHANGELOG.md). Moved here in slice 248 to keep the live CHANGELOG under the single-Read ceiling.

This window covers slices 177-185 — earlier content-audit slices closing out spell schools, halfOnSuccess flags, more duration drift, AoE sizes, damage dice + upcast scaling, weapon properties + mastery, magic item rarity drift, spell class lists, Enhance Ability alignment.

Order: most-recent first. For more recent slices, see [archive-slices-186-195.md](archive-slices-186-195.md). For older, see [archive-monsters-batch-4.md](archive-monsters-batch-4.md) / [archive-items-batch-4.md](archive-items-batch-4.md) and [archive-slices-172-176.md](archive-slices-172-176.md).

---

**Content audit: spell damage dice + upcast scaling (slice 185)**

Audited spell damage dice and upcast scaling against SRD body text across the full pack. Three drifts fixed:

- circle-of-death (L6): damage 8d6 to 8d8, upcast 1 extra die to 2 extra dice (per SRD: "8d8 Necrotic damage on a failed save... damage increases by 2d8 for each spell slot level above 6"). Both dimensions had drifted.
- weird (L9): damage 4d10 to 10d10 (pack value was wrong on the base die count by 6).
- wall-of-ice (L6): added `extraDicePerSlotLevel: 2` (SRD: "the damage the wall deals when it appears increases by 2d6 for each spell slot level above 6"). Pack had base 10d6 correct but missed the upcast.

The audit also surfaced apparent "missing extraDicePerSlotLevel" on conjure-minor-elementals / conjure-woodland-beings / conjure-elemental / conjure-animals / searing-smite / glyph-of-warding, but these use different mechanical shapes (summons / buffs / traps) where the upcast scaling lives in a different field on a different mechanical primitive. Not classed as drift; those entries are correct for their shape.

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: weapon properties + mastery (slice 184)**

Compared every pack weapon to the SRD 5.2.1 Simple Melee / Martial Melee / Simple Ranged / Martial Ranged weapon tables on damage, properties, and mastery. 35 of 39 pack weapons matched an SRD entry; two had drift:

- greatclub: added mastery `Push` (was missing).
- lance: added `two-handed` to properties (SRD 5.2.1 lists it as Heavy, Reach, Two-Handed (unless mounted); pack had Heavy, Reach).

Snapshot: features wired-weapon-masteries refreshed (greatclub joins the Push family).

Tests: 1451 pass, tsc --noEmit clean.

**Content audit: magic item rarity + attunement (slice 183)**

Compared every pack magic item against the SRD 5.2.1 type-line for rarity and attunement requirement. 99 of the 122 pack magic items matched an SRD entry; eight had drift, all fixed:

- eyes-of-the-eagle, glamoured-studded-leather, ring-of-resistance, ring-of-three-wishes, ring-of-animal-influence — pack listed `requiresAttunement: true`, SRD 5.2.1 lists them as no-attunement (2014 PHB had them as attunement-required; 2024 PHB removed the gate).
- cloak-of-the-manta-ray, periapt-of-health — pack listed `requiresAttunement: false`, SRD requires attunement.
- ring-of-feather-falling — pack rarity uncommon, SRD rarity rare (with attunement, which the pack already had set).

Tests: 1451 pass, tsc --noEmit clean. No snapshot impact.

**Content audit: spell class lists (slice 182)**

Compared the `classes` array on every pack spell against the parenthesized class list in the SRD 5.2.1 spell-header line. 50 mismatches found and fixed.

The drift was symmetric: 41 spells had missing classes (the pack denied access to a legitimate SRD caster, e.g., Bard couldn't cast Cure Wounds, Druid couldn't cast Aid, Ranger couldn't cast Dominate Beast), and ~10 spells had extra classes (most commonly Warlock or Sorcerer entries that the 2024 PHB / SRD 5.2.1 dropped; one spell had `artificer` which isn't even an SRD class).

Representative fixes: cure-wounds gained bard; aid gained druid + ranger; revivify gained druid + ranger and dropped artificer; dominate-beast gained ranger; greater-restoration gained paladin + ranger; conjure-fey dropped warlock; flesh-to-stone dropped warlock and gained druid + sorcerer; speak-with-dead gained wizard.

Most missing-class fixes restore SRD-correct caster access; most extra-class fixes remove non-SRD entries. The net effect is a more permissive caster surface for classic utility spells and a tighter list for the warlock/sorcerer where the 2024 PHB pulled back.

Tests: 1451 pass, tsc --noEmit clean. No snapshot impact (class-list field doesn't feed the wired-features snapshot).

**Content audit: Enhance Ability SRD 5.2.1 alignment (slice 181)**

Enhance Ability had several drift points from SRD 5.2.1:

- Six variants (including a CON one, Bear's Endurance, from the 2014 PHB); SRD 5.2.1 lists only five abilities (Strength, Dexterity, Intelligence, Wisdom, Charisma — no Constitution). Dropped the bears-endurance variant from the spell's caster-choice list and removed the orphan `bears-endurance-active` condition entirely.
- Class list missing Ranger and Wizard. Added both (SRD 5.2.1: Bard, Cleric, Druid, Ranger, Sorcerer, Wizard).
- Material component text "fur or a feather from a beast" normalized to "fur or a feather" per SRD.

Test surface: enhance-ability test file updated to test 5 variants instead of 6. Spell-coverage matrix entry switched from the bears-endurance variant to bulls-strength as the representative cast. Features-wired-conditions snapshot refreshed (`bears-endurance-active` removed).

Tests: 1451 pass (one less than 1452 because the 6-variant test row was removed), tsc --noEmit clean.

**Content audit: spell attack kinds + monster stat sweep (slice 180)**

Two SRD 5.2.1 audits run; one found drift, the other found none.

Spell attack-kind audit: scanned every pack spell with `mechanicalEffects.kind === 'attack'` and compared to the SRD body's "Ranged Spell Attack" or "Melee Spell Attack" phrasing. Six spells lacked the `attackKind` field entirely (silently defaulted at engine layer). All six are ranged-attack cantrips / L1 attack spells: fire-bolt, produce-flame, starry-wisp, guiding-bolt, ray-of-sickness, chromatic-orb. Added `"attackKind": "ranged"` to each. The save-ability audit ran in parallel and found zero drift across save-based spells.

Monster stat sweep: compared every pack monster against SRD on AC, HP, CR, and all six ability scores. Zero drift on 118 monsters; slices 154-164 (the secondary-monster-fields audit) and the content-authoring batches 1.1-1.21 already had every value correct. Audited monster speeds and active senses (darkvision / blindsight / tremorsense / truesight) in parallel and found zero drift there too. The audit also surfaced that `senses.passivePerceptionOverride` is unset on most monsters; not classed as drift because the field is informational-only with no engine consumer, but the gap is noted for a potential future sweep.

Tests: 1452 pass, tsc --noEmit clean.

**Content audit: spell components (slice 179)**

SRD 5.2.1 follow-up to slice 178. Compared V/S/M presence across all pack spells against SRD bodies; five mismatches found and fixed.

- conjure-woodland-beings: dropped material component (holly berry per creature), now V, S.
- conjure-elemental: dropped material component (per-element materials), now V, S.
- power-word-heal: dropped somatic, now V only (per SRD).
- resistance: dropped material component (miniature cloak), now V, S.
- true-strike: dropped verbal, switched to S, M with the SRD 5.2.1 material text (a weapon with which you have proficiency, worth 1+ CP), where the 2014 form was a different shape.

Tests: 1452 pass, tsc --noEmit clean.

**Content audit: spell castingTime / range / duration / concentration (slice 178)**

SRD 5.2.1 follow-up to slice 177's spell-school sweep. Audited every pack spell against SRD on castingTime, range, duration, and the concentration flag.

Real drift fixes (36 field edits across 27 spells):

- Castings: lesser-restoration to Bonus Action; produce-flame to Bonus Action; jump to Bonus Action; conjure-elemental + conjure-celestial to Action (were 1 minute); guards-and-wards to 1 hour (was 10 minutes); divination "1 action" normalized to "Action".
- Ranges: banishment 60 ft to 30 ft; conjure-elemental 90 to 60; conjure-fey 90 to 60; conjure-minor-elementals / conjure-woodland-beings 60-90 ft to Self; giant-insect 30 to 60 ft; arcane-sword 60 to 90 ft; sleep 90 to 60 ft; power-word-heal Touch to 60 feet; tsunami / storm-of-vengeance Sight to 1 mile; heroes-feast 30 ft to Self; produce-flame "Self / 30 feet" to Self.
- Durations: chill-touch 1 round to Instantaneous; color-spray 1 round to Instantaneous; command 1 round to Instantaneous; thaumaturgy "1 minute" to "Up to 1 minute"; goodberry Instantaneous to 24 hours; secret-chest Instantaneous to Until dispelled; astral-projection Special to Until dispelled; conjure-minor-elementals / conjure-woodland-beings / conjure-elemental / conjure-celestial / conjure-fey all 1 hour to 10 minutes (concentration limit lowered); forcecage "1 hour" to "Concentration, up to 1 hour"; animal-shapes / divine-favor / searing-smite all stripped of "Concentration, up to" prefix per SRD 5.2.1.
- Concentration flag flipped to match duration text: divine-favor, searing-smite, animal-shapes to false; forcecage to true.

The "ritual" castingTime variants (Action or Ritual, 1 minute or Ritual, etc.) are not drift because the pack uses a separate `ritual: true` flag with the bare castingTime; verified across all 14 affected spells. "Reaction, which you take when X" variants are likewise pack convention (terse "Reaction"; trigger condition lives in the spell's mechanical model). Self+shape range strings ("Self (15-foot cone)", "Self (15-foot radius)") were kept because they carry shape information that downstream consumers may rely on; the SRD body always describes the same shape and the pack's range string is informationally a superset.

Test update: `tests/golden/s61-smite-onhit.test.ts` no longer asserts that Searing Smite and Divine Favor establish a concentration slot or that Searing Smite's consume-on-trigger fires a ConcentrationBroken event. Per SRD 5.2.1 neither is a concentration spell. The rider mechanics (single-fire-then-consume for Searing Smite; every-hit for Divine Favor) are unchanged and still proved by the test.

Tests: 1452 pass, tsc --noEmit clean.

**Content audit: spell schools (slice 177)**

Audit pass over every spell in the pack against SRD 5.2.1 school + level. The slice-151 spell audit had explicitly deferred secondary fields including school; this slice closes that gap. 13 school drifts found and fixed; spell level had zero drift.

Schools fixed (pack to SRD 5.2.1):
- Acid Splash: conjuration to evocation (2014 was conjuration; 2024 PHB reclassified)
- Dancing Lights: evocation to illusion
- Divine Favor: evocation to transmutation
- Earthquake: evocation to transmutation
- Etherealness: transmutation to conjuration
- Flaming Sphere: evocation to conjuration
- Giant Insect: transmutation to conjuration
- Glibness: transmutation to enchantment
- Heal: evocation to abjuration
- Mass Cure Wounds: evocation to abjuration
- Mass Heal: evocation to abjuration
- Power Word Heal: evocation to enchantment
- Reincarnate: transmutation to necromancy

Most are 2014-PHB-flavored schools that the 2024 PHB / SRD 5.2.1 reclassified (the Heal family moving from evocation to abjuration is the most visible cluster).

Tests: 1452 pass, tsc --noEmit clean.

