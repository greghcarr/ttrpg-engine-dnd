# SRD 5.2.1 monster audit

Audit of the 118 monsters in [src/content/packs/starter-pack.json](../src/content/packs/starter-pack.json) against the SRD 5.2.1 (the official 2024 5e SRD published by WotC under CC-BY-4.0). The audit is the source of truth for an upcoming slice queue that standardizes the entire starter pack on SRD 5.2.1.

The audit is scripted: a Node parser reads the markdown SRD in `references/srd-markdown/` (gitignored), extracts AC / HP / abilities / CR for each H3 stat block, and diffs against the pack JSON. Source-of-truth for the SRD text itself is `references/SRD_CC_v5.2.1.pdf` (also gitignored). Spot-check verification of the markdown fork against the PDF was done at audit time; the markdown is faithful.

## Status counts

| Status | Count | Action |
|---|---|---|
| `exact-match` | 46 | no change |
| `drift` | 56 | refresh stats to SRD 5.2.1 |
| `rename-and-drift` | 9 | rename + refresh stats |
| `non-srd-5.2.1` | 7 | drop from pack |
| **Total** | **118** | |

## Resolution roadmap

| Slice | Scope | Status | Files touched |
|---|---|---|---|
| 141 | Drop 7 non-SRD entries | **done** | starter-pack.json (-7 entries) |
| 142 | Rename + refresh the 9 rename-and-drift entries | **done** | starter-pack.json, starter-pack.test.ts (one `goblin` to `goblin-warrior` id update) |
| 143 | Drift refresh batch 1 of 6 (Aboleth, Adult Black/Blue/Green/Red Dragon, Ankheg, Assassin, Bandit Captain, Bearded Devil, Black Bear) | **done** | starter-pack.json |
| 144 to 148 | Drift refresh batches 2 to 6 of 6 (~10 monsters each, 46 remaining) | pending | starter-pack.json, possibly tests |
| 149 | Doc refresh ([docs/content-attribution.md](content-attribution.md), README "60% SRD" headline, [docs/starter-pack-gaps.md](starter-pack-gaps.md)) | pending | docs only |

After this, post-pack count drops from 118 to 111. Combined with the 228 SRD entries we don't ship yet, the new SRD-coverage headline is ~111 / 339 = ~33% by entry count (or higher by frequently-used-in-encounters weighting; the headline math is a Slice 149 decision).

## Bucket 1: drop (7 entries)

Not present in SRD 5.2.1, will not ship in the starter pack.

| Pack id | Pack name | Reason |
|---|---|---|
| `beholder` | Beholder | WotC trademark, never in any SRD |
| `mind-flayer` | Mind Flayer | WotC trademark, never in any SRD |
| `orc` | Orc | Was in SRD 5.1, removed from SRD 5.2.1 (Orc is now a playable species in 2024) |
| `apprentice-wizard` | Apprentice Wizard | Volo's Guide entry, not in either SRD |
| `manes` | Manes | Not in SRD 5.2.1 |
| `pixie` | Pixie | Not in SRD 5.2.1 |
| `spined-devil` | Spined Devil | Not in SRD 5.2.1 |

## Bucket 2: rename and refresh (9 entries)

Stat block exists in SRD 5.2.1 under a different name, with updated stats. Pack id and name get updated; stats refreshed.

| Pack name | SRD 5.2.1 name | Diffs |
|---|---|---|
| Acolyte | Priest Acolyte | ac 10→13, hp.average 9→11, hp.formula 2d8→2d8 + 2, abilities.STR 10→14, abilities.CON 10→12 |
| Cult Fanatic | Cultist Fanatic | hp.average 33→44, hp.formula 6d8+6→8d8 + 8, abilities.WIS 13→14, abilities.CHA 14→13 |
| Flying Sword | Animated Flying Sword | hp.average 17→14, hp.formula 5d6→4d6 |
| Goblin | Goblin Warrior | hp.average 7→10, hp.formula 2d6→3d6, abilities.DEX 14→15 |
| Minotaur | Minotaur of Baphomet | hp.average 76→85, hp.formula 9d10+27→10d10 + 30 |
| Rug of Smothering | Animated Rug of Smothering | hp.average 33→27, hp.formula 6d10→5d10 |
| Thug | Tough | ac 11→12, abilities.DEX 11→12 |
| Tribal Warrior | Warrior Infantry | ac 12→13, hp.average 11→9, hp.formula 2d8+2→2d8, abilities.CON 12→11 |
| Veteran | Warrior Veteran | hp.average 58→65, hp.formula 9d8+18→10d8 + 20 |

## Bucket 3: drift refresh (56 entries)

Name matches SRD 5.2.1 but stats are stale (mostly 2014 MM values that the SRD 5.2.1 updated). Keep id and name, refresh stats.

| Pack name | Diff count | Diffs |
|---|---|---|
| Aboleth | 2 | hp.average 135→150, hp.formula 18d10+36→20d10 + 40 |
| Adult Black Dragon | 1 | abilities.CHA 17→19 |
| Adult Blue Dragon | 3 | hp.average 225→212, hp.formula 18d12+108→17d12 + 102, abilities.CHA 19→20 |
| Adult Green Dragon | 1 | abilities.CHA 17→18 |
| Adult Red Dragon | 1 | abilities.CHA 21→23 |
| Ankheg | 3 | hp.average 39→45, hp.formula 6d10+6→6d10 + 12, abilities.CON 13→14 |
| Assassin | 5 | ac 15→16, hp.average 78→97, hp.formula 12d8+24→15d8 + 30, abilities.DEX 16→18, abilities.INT 13→16 |
| Bandit Captain | 2 | hp.average 65→52, hp.formula 10d8+20→8d8 + 16 |
| Bearded Devil | 3 | hp.average 52→58, hp.formula 8d8+16→9d8 + 18, abilities.CHA 11→14 |
| Black Bear | 1 | abilities.DEX 10→12 |
| Black Pudding | 2 | hp.average 85→68, hp.formula 10d10+30→8d10 + 24 |
| Boar | 3 | hp.average 11→13, hp.formula 2d8+2→2d8 + 4, abilities.CON 12→14 |
| Bone Devil | 3 | ac 19→16, hp.average 142→161, hp.formula 15d10+60→17d10 + 68 |
| Brown Bear | 5 | hp.average 34→22, hp.formula 4d10+12→3d10 + 6, abilities.STR 19→17, abilities.DEX 10→12, abilities.CON 16→15 |
| Chain Devil | 1 | ac 16→15 |
| Constrictor Snake | 1 | ac 12→13 |
| Couatl | 2 | hp.average 97→60, hp.formula 13d8+39→8d8 + 24 |
| Deva | 2 | hp.average 136→229, hp.formula 16d8+64→27d8 + 108 |
| Dire Wolf | 2 | hp.average 37→22, hp.formula 5d10+10→3d10 + 6 |
| Dretch | 1 | abilities.STR 11→12 |
| Druid | 4 | ac 11→13, hp.average 27→44, hp.formula 5d8+5→8d8 + 8, abilities.WIS 15→16 |
| Dryad | 1 | ac 11→16 |
| Earth Elemental | 2 | hp.average 126→147, hp.formula 12d10+60→14d10 + 70 |
| Fire Elemental | 2 | hp.average 102→93, hp.formula 12d10+36→11d10 + 33 |
| Frost Giant | 2 | hp.average 138→149, hp.formula 12d12+60→13d12 + 65 |
| Gelatinous Cube | 2 | hp.average 84→63, hp.formula 8d10+40→6d10 + 30 |
| Giant Centipede | 3 | ac 13→14, hp.average 4→9, hp.formula 1d6+1→2d6 + 2 |
| Giant Rat | 2 | ac 12→13, abilities.DEX 15→16 |
| Gibbering Mouther | 2 | hp.average 67→52, hp.formula 9d8+27→7d8 + 21 |
| Gray Ooze | 1 | ac 8→9 |
| Imp | 2 | hp.average 10→21, hp.formula 3d4+3→6d4 + 6 |
| Invisible Stalker | 2 | hp.average 104→97, hp.formula 16d8+32→13d10 + 26 |
| Iron Golem | 2 | hp.average 210→252, hp.formula 20d10+100→24d10 + 120 |
| Lemure | 4 | ac 7→9, hp.average 13→9, hp.formula 2d8+4→2d8, abilities.CON 14→11 |
| Mage | 3 | ac 12→15, hp.average 40→81, hp.formula 9d8→18d8 |
| Ochre Jelly | 2 | hp.average 45→52, hp.formula 6d10+12→7d10 + 14 |
| Ogre | 2 | hp.average 59→68, hp.formula 7d10+21→8d10 + 24 |
| Otyugh | 2 | hp.average 114→104, hp.formula 12d10+48→11d10 + 44 |
| Planetar | 3 | hp.average 200→262, hp.formula 16d10+112→21d10 + 147, abilities.CHA 24→25 |
| Priest | 3 | hp.average 27→38, hp.formula 5d8+5→7d8 + 7, abilities.STR 10→16 |
| Quasit | 2 | hp.average 7→25, hp.formula 3d4→10d4 |
| Satyr | 1 | ac 14→13 |
| Shadow | 2 | hp.average 16→27, hp.formula 3d8+3→5d8 + 5 |
| Shambling Mound | 2 | hp.average 136→110, hp.formula 16d10+48→13d10 + 39 |
| Skeleton | 2 | ac 13→14, abilities.DEX 14→16 |
| Solar | 2 | hp.average 243→297, hp.formula 18d10+144→22d10 + 176 |
| Sprite | 2 | hp.average 2→10, hp.formula 1d4→4d4 |
| Stirge | 3 | ac 14→13, hp.average 2→5, hp.formula 1d4→2d4 |
| Stone Golem | 3 | ac 17→18, hp.average 178→220, hp.formula 17d10+85→21d10 + 105 |
| Storm Giant | 1 | abilities.WIS 18→20 |
| Triceratops | 3 | ac 13→14, hp.average 95→114, hp.formula 10d12+30→12d12 + 36 |
| Unicorn | 2 | hp.average 67→97, hp.formula 9d10+18→13d10 + 26 |
| Wight | 2 | hp.average 45→82, hp.formula 6d8+18→11d8 + 33 |
| Wolf | 2 | ac 13→12, abilities.STR 12→14 |
| Young White Dragon | 2 | hp.average 133→123, hp.formula 14d10+56→13d10 + 52 |
| Zombie | 2 | hp.average 22→15, hp.formula 3d8+9→2d8 + 6 |

## Bucket 4: exact match (46 entries)

Pack matches SRD 5.2.1 on all audited fields (AC, HP average + formula, all 6 abilities, CR). No action.

Adult White Dragon, Air Elemental, Allosaurus, Animated Armor, Awakened Shrub, Awakened Tree, Bandit, Barbed Devil, Berserker, Blink Dog, Bulette, Cloud Giant, Commoner, Cultist, Fire Giant, Ghost, Ghoul, Giant Frog, Giant Spider, Giant Wolf Spider, Gladiator, Griffon, Guard, Hill Giant, Knight, Mammoth, Manticore, Mastiff, Noble, Owlbear, Pegasus, Plesiosaurus, Pteranodon, Scout, Shield Guardian, Specter, Spy, Stone Giant, Treant, Tyrannosaurus Rex, Water Elemental, Wraith, Young Black Dragon, Young Blue Dragon, Young Green Dragon, Young Red Dragon.

## Audit fields and caveats

The script compares only the structural fields most likely to drift: AC, HP (average + formula), abilities (STR/DEX/CON/INT/WIS/CHA), and CR. It does **not** verify:

- Action / trait / reaction text or damage formulas (planner-relevant; checked manually during refresh)
- Skills, saves, senses, languages, immunities, resistances, vulnerabilities (low-frequency drift; checked manually during refresh)
- Speed (low-frequency drift; checked manually during refresh)
- Alignment, size, type (almost never drift; checked manually during refresh)

During each refresh slice (143 through 148), the script's diffs are the starting point but the full SRD entry gets a per-line read before committing. A clean `diffs.length == 0` does not guarantee the entry is fully SRD 5.2.1 compliant on every field; it guarantees the AC/HP/abilities/CR are correct, which is the bulk of what drifts in practice.

## Re-running the audit

The audit script lives at `/tmp/srd-audit.mjs` (one-off, not checked in). To regenerate the JSON:

```bash
node /tmp/srd-audit.mjs
```

When the slice work changes a stat block, re-run the audit and update this doc.
