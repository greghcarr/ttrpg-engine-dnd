# Changelog archive: items batch 4.x (post-alpha.5 SRD equipment.md H4-surface rollups)

Originally in the `## Unreleased` section of [../../CHANGELOG.md](../../CHANGELOG.md). Moved here in slice 248 to keep the live CHANGELOG under the single-Read ceiling.

This window covers the 16 "Content authoring: items batch 4.x" entries — the SRD 5.2.1 equipment.md H4 surface walk: dungeoneering utility, alchemical-hazard consumables, light sources, containers, clothing + camp, writing + small-vessel utility, traps + restraints, spellcasting-focus subforms, adventuring packs, SRD-completion mixed-kind pack, artisan's tools (two waves), Other Tools + Gaming Set sub-forms, Musical Instruments (10/10 with Viol closure), Ammunition sub-forms (closes the equipment.md H4 surface).

Order: most-recent first (4.16 at top, 4.1 at bottom). For the parallel monster-batch rollups, see [archive-monsters-batch-4.md](archive-monsters-batch-4.md). For more recent slices, see [archive-slices-177-185.md](archive-slices-177-185.md). For older content, see [archive-content-batches-1.md](archive-content-batches-1.md).

---

**Content authoring: items batch 4.16, 5 SRD 5.2.1 Ammunition sub-forms (closes the equipment.md H4 surface)**

Closes the SRD 5.2.1 `## Adventuring Gear` Ammunition Varies entry (equipment.md line 776) by expanding its 5 sub-forms into explicit gear entries. Source: the Ammunition sub-table at equipment.md line 1204.

- New ids: `ammunition-arrows`, `ammunition-bolts`, `ammunition-bullets-firearm`, `ammunition-bullets-sling`, `ammunition-needles`. All `itemKind: 'gear'` with the family-prefix id convention matching batch 4.8 / 4.13 / 4.14 (foci / gaming / musical multi-form expansions).
- Cohort theme: ammunition. The SRD Ammunition table at line 1204 lists 5 variants with bundle quantities, total weights, costs, and typical storage:
  - Arrows: 20 per bundle, 1 lb, 1 GP, Quiver
  - Bolts: 20 per bundle, 1.5 lb, 1 GP, Case
  - Bullets, Firearm: 10 per bundle, 2 lb, 3 GP, Pouch
  - Bullets, Sling: 20 per bundle, 1.5 lb, 4 CP, Pouch
  - Needles: 50 per bundle, 1 lb, 1 GP, Pouch
- Descriptions populated per the batch-4.9 / 4.10 precedent because the bundle quantity is essential metadata (pack data otherwise can't distinguish "1 arrow" from "1 bundle of 20 arrows"). SRD uses the unicode ½ glyph for the 1.5 lb weights; pack normalizes to decimal "1.5 lb." matching existing pack content (no unicode fractions used anywhere in starter-pack.json).
- Bullets, Firearm ship despite the pack not currently containing the Musket / Pistol weapons that consume them. SRD includes firearms in the Ammunition table and the Tinker's Tools Craft list (equipment.md line 713), so the firearm ammunition shipping makes the pack RAW-complete on the ammunition surface; consumers can author firearm weapons as content extensions without re-deriving ammunition data.
- Schema gap noted: the gear schema has no `ammunition: { for: weaponKind, bundleSize: N }` field; the relationship between ammunition entries and the weapons that consume them stays narrative/SRD-source-of-truth.

Coverage bump: items 325 to 330 total, gear 72 to 77. **SRD 5.2.1 `equipment.md` H4 surface is now fully exhausted in the pack**: every H4 entry across the Weapons, Armor, Tools, and Adventuring Gear sections is shipped, except for the 3 deferred-with-reason focus subforms (Arcane Staff / Arcane Wand / Druidic Wooden Staff, all documented in batch 4.8's note with concrete reasons: Quarterstaff overlap and namespace collision).

**Content authoring: items batch 4.15, Viol (closes SRD Musical Instruments 10/10)**

Single-entry closure batch. New id `musical-viol`, name "Viol", `category: 'musical'`. Source: equipment.md line 749. Closes the SRD 5.2.1 Musical Instrument variant catalog (10/10 shipped: Lute from alpha.5 + 8 from batch 4.14 + Viol from this batch).

Coverage bump: items 324 to 325, tools 36 to 37. SRD 5.2.1 `## Tools` section is now fully shipped modulo the pre-existing alpha.5 miscategorization of `thieves-tools` / `herbalism-kit` (both still flagged as `category: 'artisan'` instead of `'other'`; awaits engine-session fix at merge time).

**Content authoring: items batch 4.14, 8 SRD 5.2.1 Musical Instrument sub-forms**

Continues the tools catalog walk against `references/srd-markdown/equipment.md`. Eight new `itemKind: 'tool'` entries with `category: 'musical'`, covering 8 of the 9 unship Musical Instrument variants from the SRD's multi-form Musical Instrument entry (line 749).

- New ids: `musical-bagpipes`, `musical-drum`, `musical-dulcimer`, `musical-flute`, `musical-horn`, `musical-lyre`, `musical-pan-flute`, `musical-shawm`. Source: equipment.md line 749 "**Variants:** Bagpipes (30 GP, 6 lb.), drum (6 GP, 3 lb.), dulcimer (25 GP, 10 lb.), flute (2 GP, 1 lb.), horn (3 GP, 2 lb.), lute (35 GP, 2 lb.), lyre (30 GP, 2 lb.), pan flute (12 GP, 2 lb.), shawm (2 GP, 1 lb.), viol (30 GP, 1 lb.)".
- Cohort theme: 8 of 9 unship Musical Instrument variants. Viol deferred to a future closure batch to keep this batch at the 8-entry convention; Viol's combination of name-recognition (less common in modern parlance than the others) and cost (30 GP, on par with Bagpipes / Lute / Lyre) made it the natural cut.
- ID convention: `musical-{instrument}` family-prefix matching the existing alpha.5-seed `musical-lute`. Two-word variants get kebab-cased (`musical-pan-flute`).
- Name convention: bare instrument name (no comma-form qualifier), matching `musical-lute`'s shipped `name: "Lute"` rather than the comma-form qualifier convention used for batch 4.8 focus subforms and batch 4.13 Gaming Set variants. The asymmetry exists because alpha.5 set the precedent.
- SRD source uses lowercase variant names ("drum", "dulcimer", "flute", "horn", "lute", "lyre", "pan flute", "shawm", "viol") except Bagpipes which is capitalized. Pack normalizes to title case across all entries, same stylistic-inconsistency-in-source treatment as batch 4.13's Gaming Set variants.

Coverage bump: items 316 to 324 total, tools 28 to 36. Musical Instrument variants now 9/10 shipped (Viol the only remaining variant); SRD 5.2.1 tools catalog is one variant away from complete.

**Content authoring: items batch 4.13, 8 SRD 5.2.1 Other Tools + Gaming Set sub-forms**

Continues the tools catalog walk against `references/srd-markdown/equipment.md` (`## Tools` section). Eight new `itemKind: 'tool'` entries split between `category: 'other'` (4 entries) and `category: 'gaming'` (4 Gaming Set variants).

- New ids: `disguise-kit`, `forgery-kit`, `navigators-tools`, `poisoners-kit`, `gaming-set-dice`, `gaming-set-dragonchess`, `gaming-set-playing-cards`, `gaming-set-three-dragon-ante`. Source lines in equipment.md: 727 (Disguise Kit), 732 (Forgery Kit), 736 to 739 (Gaming Set Varies + variants), 751 (Navigator's Tools), 755 (Poisoner's Kit).
- Cohort theme: closes the SRD `Other Tools` and `Gaming Set` categories. The 4 Other Tools (Disguise Kit, Forgery Kit, Navigator's Tools, Poisoner's Kit) are the 4 single-form entries from the `#### Other Tools` subsection; the 4 Gaming Set variants are the SRD-listed sub-forms of the multi-form Gaming Set entry (line 739: "Variants: Dice (1 SP), dragonchess (1 GP), playing cards (5 SP), three-dragon ante (1 GP)").
- Gaming Set sub-forms use the family-prefix id convention established by batch 4.8's focus subforms (`arcane-focus-crystal`, `holy-symbol-amulet`). Names use the comma-form qualifier ("Gaming Set, Dice", "Gaming Set, Three-Dragon Ante", etc.) so the family lineage stays parseable.
- SRD presents the Gaming Set variant names with mixed capitalization ("Dice" capitalized but "dragonchess" / "playing cards" / "three-dragon ante" lowercase, line 739). Pack normalizes to title case ("Dragonchess", "Playing Cards", "Three-Dragon Ante") matching the existing pack convention for grouped variants. The SRD lowercase forms are a stylistic inconsistency in the source rather than a deliberate name-form distinction.
- Pre-existing alpha.5 miscategorization persists: `thieves-tools` and `herbalism-kit` still ship as `category: 'artisan'` despite SRD 5.2.1 classifying both as Other Tools (equipment.md lines 741, 760). Still flagged for engine-session fix at merge time; not addressed in this batch per the content-lane "do not modify existing entries" rule. With the fix applied, pack tool-category counts will be: artisan 17, other 6, gaming 4, musical 1 (total 28, matching the SRD section structure).

Coverage bump: items 308 to 316 total, tools 20 to 28. Only Musical Instrument variants remain unship in the tools catalog (9 sub-forms: Bagpipes, Drum, Dulcimer, Flute, Horn, Lyre, Pan Flute, Shawm, Viol; Lute already shipped from alpha.5). Batch 4.14 candidate.

**Content authoring: items batch 4.12, 7 SRD 5.2.1 artisan's tools (second wave; closes the catalog)**

Closes the SRD 5.2.1 artisan's tools catalog with the alphabetical second wave. Seven new `itemKind: 'tool'` entries with `category: 'artisan'`, pure-stub shape per the ToolSchema.

- New ids: `leatherworkers-tools`, `masons-tools`, `painters-supplies`, `potters-tools`, `tinkers-tools`, `weavers-tools`, `woodcarvers-tools`. Source lines in equipment.md: 680, 686, 692, 698, 710, 715, 720.
- Cohort theme: alphabetical second wave closing the SRD 5.2.1 artisan's tools section. With this batch the pack now ships 17/17 SRD artisan's tools: Calligrapher's Supplies and Smith's Tools (alpha.5 seed) plus 15 from batches 4.11 / 4.12.
- 7-entry batch rather than 8 because closing the exact SRD section boundary is cleaner than padding with one arbitrary Other Tools entry. Prior batches have varied in size (4.10 was 5 entries, 4.2 / 4.4 / etc were 8).
- **Pre-existing miscategorization caught during the audit pass**: the alpha.5-seed `thieves-tools` and `herbalism-kit` ship with `category: 'artisan'` (file lines 1874, 1876) but SRD 5.2.1 places both under the "Other Tools" section (equipment.md lines 741 and 760, NOT under the "Artisan's Tools" subsection at line 622). This is a pre-existing drift, not introduced by this batch. Per the content-lane "do not modify existing entries" rule, the fix stays as a flagged note for the engine session to address at merge time. Effect: pack-level `category: 'artisan'` queries currently return 19 entries (15 from this batch + 2 from alpha.5 correctly + 2 miscategorized alpha.5); after the fix it should return 17.

Coverage bump: items 301 to 308 total, tools 13 to 20. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated. SRD artisan's tools catalog now 17/17 complete (modulo the noted alpha.5 miscategorization). Remaining tool gaps: 4 Other Tools entries, 4 Gaming Set sub-forms, 9 Musical Instrument sub-forms.

**Content authoring: items batch 4.11, 8 SRD 5.2.1 artisan's tools (first wave)**

Opens the tools catalog walk against `references/srd-markdown/equipment.md` (`## Tools` section, lines 604 to 763). Eight new `itemKind: 'tool'` entries with `category: 'artisan'`, matching the existing pure-stub tool shape `{ id, itemKind, name, category }` used by the alpha.5 seed tools (the ToolSchema has no description field, unlike Gear and Consumable).

- New ids: `alchemists-supplies`, `brewers-supplies`, `carpenters-tools`, `cartographers-tools`, `cobblers-tools`, `cooks-utensils`, `glassblowers-tools`, `jewelers-tools`. Source lines in equipment.md: 626, 632, 644, 650, 656, 662, 668, 674.
- Cohort theme: alphabetical first wave of the SRD 5.2.1 artisan's tools catalog. The SRD lists 17 artisan's tools total; 2 were already shipped (Calligrapher's Supplies, Smith's Tools as alpha.5 seed), this batch ships 8 more, leaving 7 second-wave artisans for batch 4.12 (Leatherworker's, Mason's, Painter's Supplies, Potter's, Tinker's, Weaver's, Woodcarver's).
- ID convention follows the existing tool entries: drop apostrophes from possessives (`smiths-tools`, `calligraphers-supplies` precedent extends to `alchemists-supplies`, `brewers-supplies`, etc.).
- Naming convention preserves the apostrophe-bearing canonical SRD names ("Alchemist's Supplies", "Brewer's Supplies", "Carpenter's Tools"), matching the Smith's Tools / Calligrapher's Supplies shape already in pack.
- Schema gap noted: the ToolSchema has no slot for RAW per-tool mechanics (Ability score for checks, Utilize action DCs, Craft list). Those stay in the SRD source-of-truth until the schema gains tool-mechanic fields. Pack-level data ships canonical name + category only.

Coverage bump: items 293 to 301 total, tools 5 to 13. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated to reflect the tool-catalog opener. 7 SRD artisan's tools, 4 Other Tools entries, 4 Gaming Set sub-forms, and 9 Musical Instrument sub-forms remain unship; future batches will continue the catalog walk.

**Content authoring: items batch 4.10, SRD-completion mixed-kind pack (5 entries)**

Closes the SRD 5.2.1 adventuring-gear catalog walk by shipping the last canonical entries not previously authored: Net (gear, reclassified by SRD 5.2.1 from a 2014-PHB weapon to adventuring gear) plus the three SRD 5.2.1 potions missing from the pack (Diminution, Poison, Vitality) plus Perfume (the standalone entry referenced in Diplomat's Pack contents from batch 4.9).

- New ids: `net`, `potion-of-diminution`, `potion-of-poison`, `potion-of-vitality`, `perfume`. Sources: equipment.md line 1554 (Net), magic-items.md lines 3234 / 3389 / 3454 (the three potions), equipment.md line 1578 (Perfume).
- Net SRD reclassification finding: the 2024 PHB / SRD 5.2.1 moved Net from the Weapons section (where it appeared in the 2014 PHB as a simple ranged weapon dealing 0 damage) to the Adventuring Gear section. In SRD 5.2.1 `equipment.md`, Net is at line 1554 under `## Adventuring Gear` (line 764), NOT under `## Weapons` (line 42). Net's RAW mechanics ("thrown as part of the Attack action", 15-ft range, DC 8 + DEX + PB save vs Restrained) are now classified as adventuring-gear-with-attack-action-semantics. Ships as `itemKind: 'gear'` with a description capturing the throw / save / escape / destroy mechanics. Earlier batch-menu narration called Net a "missing simple-ranged weapon"; corrected here.
- The three potions ship as `itemKind: 'consumable'` with `onConsume: []` stubs and SRD-derived descriptions, matching the existing Potion of Healing / Greater Healing / Climbing / Animal Friendship / Growth / Heroism / Mind Reading / Resistance / Fire Breath / Hill Giant Strength / Invisibility / Flying / Speed / Water Breathing / Stone Giant Strength / Frost / Fire / Cloud / Storm Giant Strength shape.
- Perfume ships as `itemKind: 'consumable'` because the SRD describes it as a 4-ounce vial applied to oneself with a 1-hour mechanical effect ("Advantage on Charisma (Persuasion) checks made to influence an Indifferent Humanoid within 5 ft"), matching the substance-with-on-use-effect convention. Closes the batch-4.9 follow-up note that flagged Perfume as referenced inside Diplomat's Pack contents but never authored standalone.
- Pack weapons count drops from "40 weapons" (the doc's prior figure, which was off by one) to 39 weapons accurately. The pack's actual weapon array is 39 entries: 36 SRD canonical weapons plus the three monster-adapter weapons (Ogre Greatclub, Young Red Dragon Rend, Unarmed Strike). Coverage row updated to reflect actual file content.

Coverage bump: items 288 to 293 total (+4 since Net moves from weapons-side to gear-side), gear 71 to 72, consumables 38 to 42. SRD 5.2.1 catalog walk now complete on the H4-entry surface across all three item-source files (equipment.md, magic-items.md, weapons section). The remaining 4 SRD H4 deferrals (Arcane Staff / Arcane Wand / Druidic Wooden Staff / Ammunition Varies) all have documented reasons in batch 4.8's note. Branch ready to merge as the full items-batch-4 lane.

**Content authoring: items batch 4.9, 8 SRD 5.2.1 adventuring packs + Component Pouch**

Continues the adventuring-gear catalog walk against `references/srd-markdown/equipment.md`. Eight new `itemKind: 'gear'` entries: the seven canonical adventuring packs plus Component Pouch (a spellcasting-focus substitute rather than a focus itself).

- New ids: `burglars-pack`, `component-pouch`, `diplomats-pack`, `dungeoneers-pack`, `entertainers-pack`, `explorers-pack`, `priests-pack`, `scholars-pack`. Source: equipment.md lines 1346, 1386, 1398, 1435, 1439, 1443, 1602, 1632.
- Cohort theme: bundled equipment + spellcaster utility. Packs are SRD multi-item bundles whose entire identity is "what's inside"; Component Pouch joins this batch because it's the most-spellcaster-adjacent gear entry remaining (RAW: holds a spellcaster's Material components).
- Departure from gear-stub convention: all 8 ship with the `description` field populated, unlike the pure-stub `{ id, itemKind, name }` shape used by batches 4.1 / 4.3 to 4.8 and the alpha.5 seed gear. Reason: a "Burglar's Pack" entry without a contents list is meaningless to a consumer; the whole point of pack entries is the bundle composition. Descriptions are SRD-verbatim contents lists matching equipment.md text exactly.
- The SRD descriptions in the contents lists use informal short names that differ from the pack's canonical name field in three places: "Hooded Lantern" / "Bullseye Lantern" (canonical: "Lantern, Hooded" / "Lantern, Bullseye"), "Map or Scroll Cases" (canonical: "Case, Map or Scroll"), and "Fine Clothes" (canonical: "Clothes, Fine"). The descriptions are kept SRD-verbatim rather than canonicalized; consumer code that wants to resolve description references to ids can name-match either form.
- Diplomat's Pack references Perfume in its contents list. Perfume is an SRD-canonical entry (equipment.md line 1578) that has not been authored as a standalone item in any prior batch; will land in a future "narrative-utility scraps" batch alongside the remaining unship SRD entries.
- Component Pouch description matches SRD verbatim ("Watertight pouch filled with compartments that hold all the free Material components of your spells").

Coverage bump: items 280 to 288 total, gear 63 to 71. Adventuring-gear catalog walk now effectively complete: only 4 SRD 5.2.1 H4 entries remain unship across the equipment.md catalog (the three deferred-with-reason focus subforms from batch 4.8 plus the Ammunition Varies entry). Plus the Net (1 GP) simple-ranged weapon and three SRD-listed potions (Diminution, Poison, Vitality) on the consumables / weapons sides.

**Content authoring: items batch 4.8, 8 SRD 5.2.1 spellcasting-focus subforms**

Continues the adventuring-gear catalog walk against `references/srd-markdown/equipment.md`. Eight new pure-stub `itemKind: 'gear'` entries spanning the three SRD spellcasting-focus families.

- New ids: `arcane-focus-crystal`, `arcane-focus-orb`, `arcane-focus-rod`, `druidic-focus-sprig-of-mistletoe`, `druidic-focus-yew-wand`, `holy-symbol-amulet`, `holy-symbol-emblem`, `holy-symbol-reliquary`. Source: equipment.md Arcane Focus table (lines 1259 to 1300), Druidic Focus table (lines 1402 to 1433), Holy Symbol table (lines 1459 to 1492).
- Cohort theme: spellcasting foci across the three SRD families. Each family is structured in `equipment.md` as a "Varies" parent entry plus a subforms table; the pack ships each subform as its own gear entry rather than the family-level "Varies" wrapper, matching the pack's existing convention for grouped variants (e.g. "Ioun Stone, Agility" / "Lantern, Bullseye"). Names use the same comma-form qualifier ("Arcane Focus, Crystal", "Holy Symbol, Amulet", etc.) so the family lineage stays parseable from the name alone.
- Family coverage: 3 Arcane subforms (Crystal 10 GP, Orb 20 GP, Rod 10 GP), 2 Druidic (Sprig of Mistletoe 1 GP, Yew Wand 10 GP), 3 Holy Symbol (Amulet 5 GP, Emblem 5 GP, Reliquary 5 GP).
- Three SRD subforms deferred from this batch with explicit reasons (folded into the gaps doc):
  - Arcane Focus Staff: RAW-equivalent to the existing Quarterstaff weapon entry per the SRD note "(also a Quarterstaff)" on equipment.md line 1290. Deferred to avoid data duplication; consumers can use the Quarterstaff entry as both a weapon and an Arcane Focus.
  - Arcane Focus Wand: the bare "Wand" gear id would collide with the magic-item-wands namespace (Wand of Magic Missiles, Wand of Fireballs, etc.). Deferred until either a namespace prefix convention is settled or the focus role gains a schema field that disambiguates without an id collision.
  - Druidic Focus Wooden Staff: same Quarterstaff overlap deferral as the Arcane Staff (equipment.md line 1423 "Wooden staff (also a Quarterstaff)").
- Schema note: the gear schema has no `focus: 'arcane' | 'druidic' | 'holy'` field, so the focus role stays content-side narrative for now. A future engine slice could add a focus marker to the gear schema; not deepening the schema preemptively per the "stop the bleeding, don't fix the past" rule on the agnostic-core seam.
- Component Pouch (1 GP, equipment.md line 1386) is a spellcasting-focus substitute rather than a focus itself. Will ship in a future batch alongside the adventuring packs (Burglar's, Diplomat's, etc.) as a separate "spellcasting tools" sub-cohort, or earlier if a "miscellaneous spellcaster utility" cohort lands.

Coverage bump: items 272 to 280 total, gear 55 to 63. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated. ~10 SRD adventuring-gear entries remain unship (the 3 deferred-with-reason focus subforms, Component Pouch, 7 adventuring packs, Ammunition table) plus the Net (1 GP) simple-ranged weapon on the weapons side.

**Content authoring: items batch 4.7, 8 SRD 5.2.1 traps + restraints + container stragglers**

Continues the adventuring-gear catalog walk against `references/srd-markdown/equipment.md`. Eight new pure-stub `itemKind: 'gear'` entries closing two deferred sub-cohorts in one batch.

- New ids: `bell`, `bottle-glass`, `case-crossbow-bolt`, `hunting-trap`, `lock`, `manacles`, `pot-iron`, `spikes-iron`. Source lines in equipment.md: 1322, 1338, 1358, 1498, 1532, 1540, 1590, 1650.
- Cohort theme split into two halves: traps + restraints (Bell as alarm, Hunting Trap, Lock, Manacles, Spikes Iron) plus the three container stragglers explicitly deferred in earlier batches (Bottle Glass deferred in 4.6, Case Crossbow Bolt deferred in 4.4 to avoid ammunition-case redundancy with Quiver, Pot Iron deferred in 4.4 as kitchenware-adjacent).
- Names per SRD canonical including the comma form ("Spikes, Iron" / "Bottle, Glass" / "Pot, Iron" / "Case, Crossbow Bolt").
- All eight are gear-kind despite Hunting Trap (RAW: snaps shut on pressure plate, 1d4 Piercing + restrained, DC 13 STR to escape) and Spikes Iron (RAW: hammered into wood to jam doors or anchor rope) carrying mechanical RAW. The gear schema has no effects array, so the mechanics stay narrative; engine-modeled deployment is a future engine slice.
- Closes the deferred-candidate list from prior batches. Remaining gear unship is primarily structural: foci as "Varies" multi-form entries (Arcane Focus / Druidic Focus / Holy Symbol / Component Pouch) plus the seven adventuring packs and Ammunition table.

Coverage bump: items 264 to 272 total, gear 47 to 55. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated. ~18 SRD adventuring-gear entries remain (foci families, packs, Ammunition), plus the Net (1 GP) simple-ranged weapon on the weapons side.

**Content authoring: items batch 4.6, 8 SRD 5.2.1 writing + small-vessel utility gear entries**

Continues the adventuring-gear catalog walk against `references/srd-markdown/equipment.md`. Eight new pure-stub `itemKind: 'gear'` entries matching the existing alpha.5 seed gear shape and the 4.1 / 4.3 / 4.4 / 4.5 cohorts.

- New ids: `book`, `ink`, `ink-pen`, `map`, `paper`, `parchment`, `string`, `vial`. Source lines in equipment.md: 1334, 1504, 1508, 1546, 1570, 1574, 1658, 1674.
- Cohort theme: writing + small-vessel utility, the precision-craft items used by scribes, scholars, and spellcasters. Six core writing entries (Book, Ink, Ink Pen, Map, Paper, Parchment) plus two utility stragglers (String, Vial).
- Verified non-presence in SRD 5.2.1 via grep: Sealing Wax, Whetstone, Soap are NOT in `equipment.md`, dropped from the 2024 PHB / SRD 5.2.1 catalog. Did not author them.
- Vial closes the batch-4.2 deferral note: it ships as gear (the small glass container itself), not consumable (the agents like Antitoxin and Poison Basic that come pre-filled in a vial were shipped in 4.2 as their own ids).
- One more container-shape candidate (Bottle, Glass, equipment.md line 1338) stays deferred for a future batch alongside Pot Iron and Case Crossbow Bolt.

Coverage bump: items 256 to 264 total, gear 39 to 47. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated. ~26 SRD adventuring-gear entries remain unship.

**Content authoring: items batch 4.5, 8 SRD 5.2.1 clothing + camp gear entries**

Continues the adventuring-gear catalog walk against `references/srd-markdown/equipment.md`. Eight new pure-stub `itemKind: 'gear'` entries matching the existing alpha.5 seed gear shape and the 4.1 / 4.3 / 4.4 cohorts.

- New ids: `blanket`, `clothes-fine`, `clothes-travelers`, `costume`, `flask`, `jug`, `robe`, `tent`. Source lines in equipment.md: 1326, 1378, 1382, 1390, 1447, 1512, 1618, 1662.
- Cohort theme: personal wear + camp gear, covering the canonical SRD clothing entries (Fine, Traveler's, Costume, Robe, Blanket) plus the camp / vessel gear (Tent, Flask, Jug).
- Names per SRD canonical including the comma form ("Clothes, Fine" / "Clothes, Traveler's"). The SRD 5.2.1 entry is "Costume" not "Clothes, Costume" (per `equipment.md` line 1390); kept as just "Costume" to match.
- No collisions with existing pack ids. Note the bare `robe` id is distinct from the magic-item ids (`robe-of-the-archmagi`, `robe-of-eyes`, `robe-of-useful-items`), and the bare `flask` is distinct from the batch-4.2 `oil` consumable (which RAW comes in an oil flask but ships as a single consumable).
- RAW capacity / mechanical details stay narrative per the existing gear-shape convention (Tent fits 2 people, Flask holds 1 pint, Jug holds 1 gallon, Clothes Fine appropriate to high society, etc.).

Coverage bump: items 248 to 256 total, gear 31 to 39. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated. ~34 SRD adventuring-gear entries remain unship (foci as "Varies" multi-form entries, writing supplies, traps + restraints, misc utility, plus deferred Pot Iron / Case Crossbow Bolt).

**Content authoring: items batch 4.4, 8 SRD 5.2.1 containers**

Continues the adventuring-gear catalog walk against `references/srd-markdown/equipment.md`. Eight new pure-stub `itemKind: 'gear'` entries matching the existing alpha.5 seed gear shape and the batch-4.1 / 4.3 cohorts.

- New ids: `barrel`, `basket`, `bucket`, `case-map-or-scroll`, `chest`, `pouch`, `quiver`, `sack`. Source lines in equipment.md: 1310, 1314, 1342, 1362, 1370, 1598, 1606, 1628.
- Cohort theme: storage / carry. The eight cover the canonical SRD container family from generic (Sack, Pouch, Basket) through specialized (Quiver for arrows, Case Map or Scroll for documents) to dungeon-furniture (Barrel, Chest, Bucket).
- Two canonical SRD candidates deferred: Pot Iron (kitchenware, not strictly a storage container in the carrying sense) and Case Crossbow Bolt (parallel of Quiver scoped to bolt ammunition; shipped only Quiver to avoid the ammunition-case redundancy in a single batch). Both remain available for a future batch.
- All eight are gear-kind without per-use mechanical effects. RAW capacity numbers (Barrel 40 gallons, Sack 30 lb, Pouch 6 lb, Quiver 20 arrows, etc.) stay narrative; the gear schema has no capacity field, and the pack's weight / cost metadata stays unship across the alpha.5-shaped gear cohort.

Coverage bump: items 240 to 248 total, gear 23 to 31. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated. ~42 SRD adventuring-gear entries remain unship (clothing, foci, writing supplies, traps + restraints, misc utility, plus the two deferred candidates).

**Content authoring: items batch 4.3, 8 SRD 5.2.1 light-sources + observation gear entries**

Continues the adventuring-gear catalog walk against `references/srd-markdown/equipment.md`. Eight new entries shipping as pure-stub `itemKind: 'gear'` with no description, matching the existing alpha.5 seed gear shape and the batch-4.1 dungeoneering-utility cohort.

- New ids: `candle`, `lamp`, `lantern-bullseye`, `lantern-hooded`, `magnifying-glass`, `mirror`, `signal-whistle`, `spyglass`. Source lines in equipment.md: 1354, 1520, 1524, 1528, 1536, 1550, 1640, 1654. Names per SRD canonical including the comma form ("Lantern, Bullseye" / "Lantern, Hooded").
- Cohort theme: extended perception, illumination + magnification + reflection + signaling. All 8 are gear-kind (reusable physical objects without per-use mechanical effects) per the pack convention that distinguishes gear from consumable.
- Magnifying Glass's RAW "Advantage on appraise / inspect ability checks" and Hooded Lantern's RAW "Bonus Action to lower / raise the hood" stay narrative for now; the gear schema has no `effects` array, so the mechanics live in the SRD source-of-truth rather than the pack. Future engine slices could add gear-effect projection; not deepening the schema for content reasons.
- All four light sources (Candle, Lamp, Lantern Bullseye, Lantern Hooded) ship without engine-modeled illumination state; the SRD radius / cone / dim-light values stay consumer-narrative until the engine models lighting zones (existing deferral, same gap shape as Lantern of Revealing's invisibility-reveal arm).

Coverage bump: items 232 to 240 total, gear 15 to 23. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated. ~50 SRD adventuring-gear entries remain unship (containers, clothing, foci, writing supplies, traps + restraints, misc utility) for future batches.

**Content authoring: items batch 4.2, 8 SRD 5.2.1 alchemical-hazard consumables**

Continues the adventuring-gear catalog walk against the SRD 5.2.1 equipment table (source: `references/srd-markdown/equipment.md`). Eight new entries shipping as `itemKind: 'consumable'` with `onConsume: []` stubs and SRD-verbatim mechanical text in the `description` field, matching the existing alpha.5 potion shape (e.g., Potion of Greater Healing).

- New ids: `acid`, `alchemists-fire`, `antitoxin`, `ball-bearings`, `caltrops`, `holy-water`, `oil`, `poison-basic`. Cohort theme: alchemical agents and area-denial deployables, the canonical SRD "improvised weapon / utility hazard" family from `equipment.md` lines 768, 772, 1255, 1306, 1350, 1494, 1560, 1582.
- itemKind decision: all 8 ship as consumable rather than gear. RAW each entry has per-use mechanical effects (thrown attacks with DC 8 + DEX + PB saves on Acid / Alchemist's Fire / Holy Water / Oil-as-thrown, Utilize actions with fixed-DC saves on Ball Bearings / Caltrops, Bonus Action drink-or-coat on Antitoxin / Poison Basic). The pack's existing convention is consumable = substance with on-use effect, gear = physical object with no mechanical event. Oil dual-purposes as lamp fuel + thrown improvised weapon; the consumable kind wins because two of its three RAW use-modes are mechanical.
- Effects stay deferred behind the `ConsumeItem` planner blocker batches 1.3 (potion set) and 1.12 (potions and oils) already named. The 4.2 cohort joins that queue. When `ConsumeItem` lands, each entry's `onConsume` arm wires from the `description` text without further authoring.
- Verified one drift catch via the grep-first rule: Holy Water is 2d8 Radiant per SRD 5.2.1, not 2d6 (the 2014 PHB value). Caught at the SRD lookup step, before authoring.

Coverage bump: items 224 to 232 total, consumables 30 to 38. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` updated. Three SRD-listed consumables still unship (Potion of Diminution, Potion of Poison, Potion of Vitality), candidates for a future small completion batch.

**Content authoring: items batch 4.1, 8 SRD 5.2.1 dungeoneering-utility gear entries**

Opens the adventuring-gear catalog walk against the SRD 5.2.1 equipment table (verified against `references/srd-markdown/equipment.md`). All eight ship as pure-stub `itemKind: 'gear'` entries with no effects, no charges, no description, matching the existing alpha.5 seed gear shape (torch, rope, backpack, rations, waterskin, bedroll, tinderbox). Snapshot-clean.

- New ids: `block-and-tackle`, `chain`, `climbers-kit`, `crowbar`, `grappling-hook`, `ladder-10`, `pole-10`, `shovel`. Names match SRD canonical exactly ("Ladder", "Pole", the 10-foot length lives in the SRD body text rather than the entry name; the kebab-case ids keep the suffix to leave room for future length variants).
- Cohort theme: physical dungeoneering utility (traversal, breaching, hauling, anchoring). All eight are SRD-priced entries (Climber's Kit 25 GP, Crowbar 2 GP, Grappling Hook 2 GP, Chain 5 GP, Shovel 2 GP, Block and Tackle 1 GP, Pole 5 CP, Ladder 1 SP). Cost / weight metadata stays unship until a future content pass takes the full mundane-item catalog (matches the existing alpha.5 gear shape).
- Three non-SRD candidates dropped from the original plan during the audit pass: Hammer (the SRD ships Light Hammer / Warhammer as weapons, no gear-kind hammer), Pick / Miner's (dropped in the 2024 / SRD 5.2.1 catalog), Piton (rolled into Climber's Kit body text, no standalone entry). Replaced with Block and Tackle, Chain, and Climber's Kit.

Coverage bump: items 217 to 224 total, gear 7 to 15. Items section and Coverage at a glance row in `docs/starter-pack-gaps.md` are updated.

