# SRD 5.2.1 audit: secondary monster fields

**Status (as of slice 196):** All secondary fields swept clean. Slice 180's monster-stat sweep verified zero drift on speeds + senses across all monsters. Slice 195's harness re-runs AC / HP / CR / ability scores on every test run. Field-level audits not yet in the harness (speed, skills, immunities, save proficiencies) all returned zero drift when re-run manually in the slice 196 cleanup pass.

Follow-up audit to the slice 141 to 149 monster initiative, which standardized the 111 starter-pack monsters on AC, HP, abilities, and CR. This slice (154) covers the secondary fields the primary audit script didn't check: size, type, alignment, speed, saving throw proficiencies, skill proficiencies, senses (darkvision / blindsight / tremorsense / truesight / passive perception override), damage resistances / immunities / vulnerabilities, condition immunities.

Companion to [docs/srd-5.2.1-audit.md](srd-5.2.1-audit.md). Actions / traits / reactions text bodies are still not covered; they remain a tangential cleanup item.

## Status counts

| Status | Count |
|---|---|
| `match` (no secondary diff) | 10 |
| `drift` (1+ secondary diff) | 101 |
| **Total** | 111 |

The 10 clean entries: Allosaurus, Deva, Fire Giant, Frost Giant, Griffon, Hill Giant, Plesiosaurus, Pteranodon, Satyr, Sprite.

The 101 drift entries hold roughly 270 individual field-level diffs. The audit found:

| Field family | Diff count | Engine impact |
|---|---|---|
| senses (most are passive perception) | 94 | medium |
| saving throw proficiencies | 45 | high (computeSavingThrow consumes these since slice 130) |
| skill proficiencies | 39 | medium (ability check planner uses these) |
| speed (climb / fly / swim / walk) | 20 | high (movement) |
| condition immunities | 12 | high (isImmuneToCondition since slice 129) |
| damage resistances | 10 | high (mitigateDamage since slice 129) |
| damage immunities | 5 | high |
| type | 2 | medium (predicates) |
| size | 1 | low |
| damage vulnerabilities | 1 | high |

## Field-name bugs (2)

Pack uses `senses.passivePerception` instead of the schema-declared `senses.passivePerceptionOverride` on two entries: **Wolf** (passivePerception 13) and **Young Red Dragon** (blindsight 30, darkvision 120, passivePerception 18). Per [src/schemas/primitives.ts](../src/schemas/primitives.ts), only `passivePerceptionOverride` is a recognized senses key; the `passivePerception` field is silently dropped by Zod parse. Pure schema-renames; once fixed, those overrides actually reach the engine.

## High-impact drift samples

A few representative diffs to motivate the follow-up fix slices:

### Aboleth
SRD lists DEX +3 (proficient) save. Pack ships CON / INT / WIS only. Engine save-proficiency derivation under-reports Aboleth DEX saves.

### Young Red Dragon
SRD lists proficient saves on DEX +4 and WIS +4. Pack ships CON +9 and CHA +8 (the 2014 dragon save profile). Engine reads wrong values across the board for this monster.

### Goblin Warrior
SRD type is "Fey (Goblinoid)". Pack ships type "Humanoid". 2024 SRD reclassified Goblins as Fey; the pack still uses the 2014 type. Predicates filtering on type (e.g., "humanoid only" effects) will mis-classify goblins.

### Stirge
SRD type is "Monstrosity". Pack ships "Beast". Real reclassification drift.

### Invisible Stalker
SRD size is "Large". Pack ships "Medium". Spells that select by size will mis-target.

### Speed drift cohort (17 entries)
- Owlbear, Spy, Giant Rat, Black Bear, Barbed Devil: missing climb 30/40
- Cloud Giant, Storm Giant: missing fly 20/25 (2024 added flight to several giants)
- Black Bear: walk 40 vs SRD 30, plus missing swim 30
- Specter, Ghost, Wraith, Air Elemental, Animated Flying Sword: walk 0 in pack but SRD lists explicit walk speed
- Lemure, Mammoth, Shambling Mound, Gibbering Mouther, Ochre Jelly: various walk-speed numbers wrong

### Passive perception derivation (81 entries)
Most "senses.passivePerceptionOverride" diffs are pack omissions where the SRD lists an explicit number. Many of these are derivable from WIS modifier + perception skill (the engine derives PP this way when the override is absent). They become real drifts only when the underlying skill / WIS values would yield a wrong derivation, which is the case for the ~39 monsters that also have skill drift.

## Initiative outcome

Audit fixes shipped across slices 155 through 163 (the slice-160 test-perf change is unrelated):

| Slice | Scope | Status |
|---|---|---|
| 155 | Wolf + Young Red Dragon `passivePerception` → `passivePerceptionOverride` schema-rename bugs | **done** |
| 156 | Type / size drift: Goblin Warrior → Fey, Stirge → Monstrosity, Invisible Stalker → Large | **done** |
| 157 | Saving throw proficiency refresh on 28 monsters | **done** |
| 158 | Skill proficiency refresh on 28 monsters | **done** |
| 159 | Senses refresh on 81 monsters | **done** |
| 161 | Speed refresh on 17 monsters | **done** |
| 162 | Damage resistance / immunity / vulnerability + condition immunity refresh on 23 monsters | **done** |
| 163 | Remove obsolete `qualifier: 'nonmagical'` GrantResistance traits from 23 monsters | **done** |

**Final audit state: 110 of 111 monsters match SRD 5.2.1 exactly on all audited fields.**

The single outstanding diff is the **Young White Dragon INT save**: SRD's INT save column shows "2" without sign while the corresponding INT mod is "−2". The math is consistent with neither no-proficiency (would expect "−2") nor proficiency-applied (would expect "+1" at the CR-6 PB of +3); the parsed value of +2 makes neither save = mod nor save = mod + PB. Treating this as an SRD source typo where the leading dash was dropped, the pack intentionally omits INT save proficiency for Young White Dragon. If WotC errata clarifies, this can be revisited.

## What this audit didn't cover

The script verified the structural fields. It did not verify:

- **Action / trait / reaction / bonus action / legendary action text bodies**. The narrative wording on each monster's special abilities was not compared. The pack's existing `actions: [...]` arrays are mechanical encodings of the SRD text; per-action verification is content-authoring work that would benefit from a different review approach (read each entry's text against the SRD).
- **Magic Resistance / Magic Weapons / other trait shapes** beyond `GrantResistance`. The audit checked the `damageResistances`/`damageImmunities` arrays and the `qualifier: 'nonmagical'` GrantResistance trait shape specifically; other trait entries (e.g. monsters with `GrantMagicResistance`) were not cross-referenced against SRD.

These could each be a future audit slice if needed.

## Re-running the audit

```bash
node /tmp/srd-audit-secondary.mjs
cat /tmp/srd-audit-secondary.json | jq '[.[] | select(.status == "drift")] | length'
```

Script at `/tmp/srd-audit-secondary.mjs`; not checked in.
