# SRD 5.2.1 audit: species, backgrounds, feats

Companion to the monster ([docs/srd-5.2.1-audit.md](srd-5.2.1-audit.md)), magic-item ([docs/srd-5.2.1-audit-items.md](srd-5.2.1-audit-items.md)), and spell ([docs/srd-5.2.1-audit-spells.md](srd-5.2.1-audit-spells.md)) audits. This one covers the character-creation cohort: species, backgrounds, feats.

Outcome (slice 152): documented hybrid. The pack ships PHB 2024 content beyond SRD 5.2.1's narrower scope because character creation needs the breadth and these are non-controversial PHB 2024 names that downstream consumers can adopt freely with attribution to WotC.

## Status counts

| Category | Pack count | SRD 5.2.1 count | SRD-derived in pack | Non-SRD (PHB 2024 only) in pack | Action |
|---|---|---|---|---|---|
| Species | 7 | 9 | 7 | 0 | clean; can add Goliath + Orc as follow-ups |
| Backgrounds | 19 | 4 | 4 | 15 | keep all, document hybrid |
| Feats | 33 | 17 | 16 | 17 | keep all, document hybrid |

## Species (clean)

Pack ships all 7 species as SRD 5.2.1-derived: Human, Elf, Dwarf, Halfling, Tiefling, Dragonborn, Gnome. SRD 5.2.1 additionally ships Goliath and Orc, which are content-authoring follow-ups not yet in the pack.

## Backgrounds

SRD 5.2.1 ships only the 4 backgrounds named in slice 152's audit: Acolyte, Criminal, Sage, Soldier. The pack ships those 4 plus 15 PHB 2024 backgrounds that are not in SRD 5.2.1.

### SRD-derived (4)

| Pack id | Pack name | SRD 5.2.1 ✓ |
|---|---|---|
| `acolyte` | Acolyte | ✓ |
| `criminal` | Criminal | ✓ |
| `sage` | Sage | ✓ |
| `soldier` | Soldier | ✓ |

### PHB 2024 only, not in SRD 5.2.1 (15)

| Pack id | Pack name |
|---|---|
| `artisan` | Artisan |
| `charlatan` | Charlatan |
| `entertainer` | Entertainer |
| `farmer` | Farmer |
| `folk-hero` | Folk Hero |
| `guard` | Guard |
| `guide` | Guide |
| `guild-artisan` | Guild Artisan |
| `hermit` | Hermit |
| `merchant` | Merchant |
| `noble` | Noble |
| `outlander` | Outlander |
| `sailor` | Sailor |
| `scribe` | Scribe |
| `wayfarer` | Wayfarer |

These ship in the pack because character creation needs them; downstream consumers building strict SRD-only content can vendor a pack with just the 4 SRD-derived entries.

## Feats

SRD 5.2.1 ships 17 feats; pack ships 33. 16 are SRD-derived (counting Magic Initiate's 3 variant unrolls); 17 are PHB 2024 only.

### SRD-derived (16)

| Pack id | Pack name | SRD canonical |
|---|---|---|
| `alert` | Alert | Alert |
| `magic-initiate-cleric` | Magic Initiate (Cleric) | Magic Initiate (variant) |
| `magic-initiate-druid` | Magic Initiate (Druid) | Magic Initiate (variant) |
| `magic-initiate-wizard` | Magic Initiate (Wizard) | Magic Initiate (variant) |
| `savage-attacker` | Savage Attacker | Savage Attacker |
| `skilled` | Skilled | Skilled |
| `fighting-style-archery` | Fighting Style: Archery | Archery (Fighting Style) |
| `fighting-style-defense` | Fighting Style: Defense | Defense (Fighting Style) |
| `fighting-style-great-weapon` | Fighting Style: Great Weapon Fighting | Great Weapon Fighting (Fighting Style) |
| `fighting-style-two-weapon` | Fighting Style: Two-Weapon Fighting | Two-Weapon Fighting (Fighting Style) |
| `boon-of-combat-prowess` | Boon of Combat Prowess | ✓ |
| `boon-of-dimensional-travel` | Boon of Dimensional Travel | ✓ |
| `boon-of-irresistible-offense` | Boon of Irresistible Offense | ✓ |
| `boon-of-spell-recall` | Boon of Spell Recall | ✓ |
| `boon-of-the-night-spirit` | Boon of the Night Spirit | ✓ |
| `boon-of-truesight` | Boon of Truesight | ✓ |

### PHB 2024 only, not in SRD 5.2.1 (17)

Origin feats: `crafter` (Crafter), `healer` (Healer), `lucky` (Lucky), `musician` (Musician), `tavern-brawler` (Tavern Brawler), `tough` (Tough).

General feats: `great-weapon-master` (Great Weapon Master), `polearm-master` (Polearm Master), `resilient-con` (Resilient (Constitution)), `sharpshooter` (Sharpshooter), `unarmored-defense-barbarian` (Unarmored Defense (Barbarian)), `war-caster` (War Caster).

Fighting Styles: `fighting-style-dueling` (Fighting Style: Dueling), `fighting-style-protection` (Fighting Style: Protection).

Epic Boons: `boon-of-energy-resistance` (Boon of Energy Resistance), `boon-of-fortitude` (Boon of Fortitude), `boon-of-skill` (Boon of Skill).

### SRD feats not yet in pack (1 + 1 if you count Ability Score Improvement as a feat)

- **Boon of Fate** (Epic Boon): SRD-listed but not in pack. Content-authoring follow-up.
- **Grappler** (General feat): SRD-listed but not in pack. Content-authoring follow-up.
- **Ability Score Improvement** is in SRD's feats list but is conventionally treated as a built-in level-up mechanic rather than a content-pack feat entry.

## Distribution policy

The pack ships under CC-BY-4.0 with attribution to WotC for SRD 5.2.1-derived content. The PHB 2024-only entries are documented above so downstream consumers can:
- Build SRD-only forks by excluding the listed PHB 2024-only entries.
- Or, with appropriate care, distribute the full pack noting that some entries fall outside the SRD 5.2.1 licensing scope.

This audit makes the line explicit; the pack itself ships unchanged in slice 152.

## Re-running the audits

```bash
# Backgrounds
jq -r '.backgrounds[].name' src/content/packs/starter-pack.json | sort
awk '/^### Background Descriptions/,/^## Character Species/' \
  references/srd-markdown/character-origins.md \
  | grep -E "^#### " | grep -vE "^#### (Ability Scores|Feat|Skill Proficiencies|Tool Proficiency|Equipment)$"

# Species
jq -r '.species[].name' src/content/packs/starter-pack.json | sort
awk '/^### Species Descriptions/,/^## /' references/srd-markdown/character-origins.md \
  | grep -E "^#### " | head

# Feats
jq -r '.feats[].name' src/content/packs/starter-pack.json | sort
grep -E "^#### " references/srd-markdown/feats.md
```
