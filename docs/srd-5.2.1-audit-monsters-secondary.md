# SRD 5.2.1 audit: secondary monster fields

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

## Why this isn't fixed in slice 154

Combined fix surface is ~270 individual field-level edits across 101 monsters. Several edits per monster, varying shapes (add/remove/replace), with engine implications that require validation per affected monster. Fitting that into a single reviewable commit isn't practical. This audit documents the gap and queues remediation as follow-up slices.

## Suggested follow-up slices

| Slice | Scope |
|---|---|
| 155 | Field-name bugs (Wolf + Young Red Dragon `passivePerception` → `passivePerceptionOverride`). Trivial. |
| 156 | Type / size drift fixes: Goblin Warrior → Fey, Stirge → Monstrosity, Invisible Stalker → Large. |
| 157 to 159 | Saving throw proficiency refresh in batches (45 diffs across ~30 monsters). Highest engine impact. |
| 160 to 161 | Skill proficiency + senses refresh batches. |
| 162 | Speed drift batch (20 entries). |
| 163 | Damage R / I / V + condition immunity batch. |
| 164 | Doc refresh: update README + content-attribution + this audit doc to mark complete. |

The exact slice grouping is a judgment call at execution time; the queue above is one workable shape.

## Re-running the audit

```bash
node /tmp/srd-audit-secondary.mjs
cat /tmp/srd-audit-secondary.json | jq '[.[] | select(.status == "drift")] | length'
```

Script at `/tmp/srd-audit-secondary.mjs`; not checked in.
