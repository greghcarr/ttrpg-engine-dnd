# Content attribution audit

Per-category review of the starter content pack at `src/content/packs/starter-pack.json` against the Dungeons & Dragons System Reference Document 5.2.1 (SRD 5.2.1), released by Wizards of the Coast under CC BY 4.0.

The intent is to be explicit about which content is confidently SRD-derived (covered by the CC BY 4.0 license with attribution) and which uses 2024 PHB/DMG mechanic names whose inclusion in SRD 5.2.1 the authors have either independently verified or have not.

**This is a good-faith audit, not legal advice.** If you publish derivatives or build a commercial product on top of this pack, consult an attorney and the current published SRD 5.2.1 contents list.

## SRD 5.2.1 standardization initiatives

**Monsters (slices 141 to 149, completed).** The audit script + the resulting per-monster diff record live at [docs/srd-5.2.1-audit.md](srd-5.2.1-audit.md).

- Slice 141 dropped 7 non-SRD entries: Beholder + Mind Flayer (WotC trademarks), Orc + Apprentice Wizard + Manes + Pixie + Spined Devil (not in SRD 5.2.1).
- Slice 142 renamed 9 entries to their SRD 5.2.1 names + refreshed stat drift: Acolyte → Priest Acolyte, Cult Fanatic → Cultist Fanatic, Flying Sword → Animated Flying Sword, Goblin → Goblin Warrior, Minotaur → Minotaur of Baphomet, Rug of Smothering → Animated Rug of Smothering, Thug → Tough, Tribal Warrior → Warrior Infantry, Veteran → Warrior Veteran.
- Slices 143 through 148 refreshed 56 entries with stat drift (mostly 2014 MM values updated to SRD 5.2.1 / 2024 MM values: HP totals + ability scores + occasionally AC).

**Post-initiative: 111 / 111 starter-pack monsters match SRD 5.2.1 exactly on AC, HP (average + formula), all six abilities, and CR.** The action / trait / save proficiency / resistance / immunity / speed / size / type / alignment fields stay as initially authored; spot-checks at slice 141 found these don't typically drift between 2014 and 2024 versions of shared stat blocks, but a follow-up pass on those secondary fields is not yet scheduled.

**Magic items (slice 150, completed).** The audit + per-entry diff record live at [docs/srd-5.2.1-audit-items.md](srd-5.2.1-audit-items.md).

**Character creation (slice 152, completed).** Audit at [docs/srd-5.2.1-audit-character-creation.md](srd-5.2.1-audit-character-creation.md). The cohort split: all 7 pack species are SRD-derived (Goliath + Orc are SRD-listed but not yet in pack, content-authoring follow-up); 4 of 19 backgrounds are SRD-derived (Acolyte, Criminal, Sage, Soldier), with 15 PHB 2024 backgrounds kept in the pack outside the SRD 5.2.1 license envelope; 16 of 33 feats are SRD-derived (Alert, Magic Initiate x 3 variants, Savage Attacker, Skilled, 4 of 6 Fighting Styles, 6 of 9 Epic Boons), with 17 PHB 2024 feats kept outside the SRD license envelope. Policy: keep the PHB 2024-only entries in the pack because character creation breadth needs them; downstream consumers building strict SRD-only forks can vendor a subset using the audit doc's named lists.

**Spells (slice 151, completed).** The audit + per-entry diff record live at [docs/srd-5.2.1-audit-spells.md](srd-5.2.1-audit-spells.md). The cohort had three buckets: 309 names that exact-matched SRD 5.2.1, 15 named-mage spells that needed renames to drop the wizard-name prefix (Bigby's Hand to Arcane Hand, Mordenkainen's Sword to Arcane Sword, Tasha's Hideous Laughter to Hideous Laughter, etc.), and 76 spells not in SRD 5.2.1. For the third bucket, the policy was "keep wired, drop schema-only": 12 entries with dedicated planner files or non-coverage test references (Absorb Elements, Armor of Agathys, Blade Ward, Cause Fear, Cloud of Daggers, Cordon of Arrows, Crusader's Mantle, Elemental Weapon, Hunger of Hadar, Spirit Shroud, Summon Beast, Thunder Step) stay because the engine has substantive investment in their mechanics; the other 64 (schema-only post-PHB content consumed only by the generic `planCastSpell` pipeline) get dropped. Post-slice-151: 336 spells (324 SRD 5.2.1-derived + 12 wired-non-SRD). Slice 150 dropped 16 non-SRD entries (XGE cosmetics: Cloak of Billowing, Cloak of Many Fashions, Clothes of Mending, Ear Horn of Hearing, Hat of Vermin, Mystery Key, Pole of Angling, Shield of Expression, Tankard of Sobriety; plus Cap of Water Breathing, Deck of Many Things, Driftglobe, Rod of the Pact Keeper +1, Smoldering Armor, Staff of the Adder, Wand of Pyrotechnics). The remaining 122 entries either match an SRD 5.2.1 entry by name (98 case-insensitive matches), are granular variants of a grouped SRD entry (21: Armor +1/+2/+3, Weapon +1/+2/+3, Belt of X Giant Strength × 6, Ioun Stone variants × 8, Quaal's Feather Token Anchor), or use a slight name variant of an SRD entry (3: Stone of Good Luck = SRD "Stone of Good Luck (Luckstone)", Flametongue Longsword = SRD "Flame Tongue" variant, Amulet of Proof Against Detection and Location = SRD's same name with one capitalization diff). The audit covered names + grouping logic; rarity / attunement / effect-array drift checks are a separate follow-up.

## Confidently SRD-derived (auditable categories)

These categories have content matching SRD 5.2.1 with high confidence. CC BY 4.0 attribution applies; the package's NOTICE file carries the required attribution string.

- **Monsters** (111 entries). All verified against SRD 5.2.1 markdown (via the audit script and a spot-check against the SRD 5.2.1 PDF). See [docs/srd-5.2.1-audit.md](srd-5.2.1-audit.md). The pack is a 111-entry subset of the SRD 5.2.1's 235 monster stat blocks + 95 animal stat blocks (330 creatures total).
- **Magic items** (122 entries). All verified against SRD 5.2.1 markdown. See [docs/srd-5.2.1-audit-items.md](srd-5.2.1-audit-items.md). The pack is a 122-entry subset of the SRD 5.2.1's ~260 magic-item A-Z entries.
- **Spells** (324 SRD 5.2.1-derived + 12 wired-non-SRD extras = 336 total). The 324 SRD entries verified by name match against SRD 5.2.1 markdown after slice 151's rename pass. The 12 wired-non-SRD extras are documented post-PHB content (XGE/TCE) kept in the pack because the engine has dedicated planners or tests for them; treat these as homebrew shapes for commercial-distribution purposes. See [docs/srd-5.2.1-audit-spells.md](srd-5.2.1-audit-spells.md) for the full audit.
- **Conditions** (all 15 RAW + ~25 mechanic-rider conditions). Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious. The pack additionally ships mechanic-rider conditions that are this package's own encoding (e.g. `blessed`, `baned`, `held-paralyzed-active`, `cursed-attacks-active`, `fire-shield-warm-active`); these names and shapes are not WotC text, they are the engine's expression of how spell effects compose.
- **Weapons / Armor / Tools / Gear**. The mundane equipment matches SRD 5.2.1's equipment listing.
- **Species** (7 entries). Human, Elf, Dwarf, Halfling, Tiefling, Dragonborn, Gnome. All SRD 5.2.1-derived (verified slice 152). SRD additionally ships Goliath and Orc, content-authoring follow-up. Species traits beyond name + speed + size are mostly schema-only.
- **Backgrounds (SRD-derived subset)**: only Acolyte, Criminal, Sage, Soldier are in SRD 5.2.1 (slice 152 verified). The pack additionally ships 15 PHB 2024 backgrounds outside the SRD license envelope, named in [docs/srd-5.2.1-audit-character-creation.md](srd-5.2.1-audit-character-creation.md); downstream consumers building strict SRD-only forks should vendor a subset of just the 4 SRD-derived backgrounds.
- **Feats (SRD-derived subset)**: 16 of 33 pack feats are in SRD 5.2.1 (Alert, Magic Initiate x 3 variants, Savage Attacker, Skilled, Fighting Style: Archery / Defense / Great Weapon Fighting / Two-Weapon Fighting, Boon of Combat Prowess / Dimensional Travel / Irresistible Offense / Spell Recall / Night Spirit / Truesight). The remaining 17 are PHB 2024-only (Crafter, Healer, Lucky, Musician, Tavern Brawler, Tough, Great Weapon Master, Polearm Master, Resilient (Constitution), Sharpshooter, Unarmored Defense (Barbarian), War Caster, Fighting Style: Dueling / Protection, Boon of Energy Resistance / Fortitude / Skill).

## Not yet individually audited

These categories ship 2024 PHB / DMG names with mechanical encodings, and likely match SRD 5.2.1 contents for the most part, but each entry has not been independently cross-referenced against the SRD 5.2.1 release.

- **Classes** (12) + class features. All 12 standard classes ship with L1-L20 progression. The base class tables and core features (Rage, Action Surge, Sneak Attack, Wild Shape, etc.) are SRD-confirmed. The pack's per-level feature wirings are this package's own encoding; per-feature SRD verification has not been done.

## Not in SRD 5.2.1 (consumer responsibility for downstream use)

These entries reference 2024 PHB or DMG mechanics whose presence in SRD 5.2.1 the authors have not verified, or which are known to fall outside SRD 5.2.1. They are present in the starter pack because the mechanical surface is implemented in the engine.

- **Bastions** (the entire stronghold system, including `Bastion`, `BastionFacility`, `BastionHireling`, turn orders such as `maintain` / `craft` / `recruit` / `research` / `trade` / `empower`). 2024 DMG content. The engine's implementation (schemas, events, reducers) is original. The concept of a stronghold system is unprotectable; the specific named turn orders and facility types derived from DMG text may not be in SRD 5.2.1. Treat the engine implementation as legally clean; treat the specific WotC-derived names as homebrew shapes that consumers can rename freely.
- **PHB 2024-only backgrounds + feats** (slice 152): 15 backgrounds (Artisan, Charlatan, Entertainer, Farmer, Folk Hero, Guard, Guide, Guild Artisan, Hermit, Merchant, Noble, Outlander, Sailor, Scribe, Wayfarer) and 17 feats (origin: Crafter, Healer, Lucky, Musician, Tavern Brawler, Tough; general: Great Weapon Master, Polearm Master, Resilient (Constitution), Sharpshooter, Unarmored Defense (Barbarian), War Caster; fighting styles: Dueling, Protection; epic boons: Boon of Energy Resistance / Fortitude / Skill). PHB 2024 names not in SRD 5.2.1's narrower scope. Pack ships them because character creation needs the breadth; downstream consumers building strict SRD-only forks can exclude them using [docs/srd-5.2.1-audit-character-creation.md](srd-5.2.1-audit-character-creation.md).
- **Deck of Many Things**: famous DMG item. Card-by-card text is highly creative and protected; the starter pack ships only the name (no card details). Whether the name itself is acceptable for your use is a separate question.

## Trademarks

"Dungeons & Dragons", "D&D", and related marks are trademarks of Wizards of the Coast LLC. This package is not affiliated with WotC. The package name `ttrpg-engine-dnd` uses generic descriptive terms; "dnd" appears in the lowercase descriptive sense, not as branding.

## How to extend or replace the starter pack

If you need a clean-room content pack (no WotC-derived material), the practical approach is:

1. **Start from your own pack JSON** (see `src/schemas/content/` for the shapes).
2. **Load alongside or instead of the starter pack**: `resolveContent([myPack])` or `resolveContent([loadStarterPack(), myPack])` with later packs overriding by ID.
3. **Strip names that match SRD**: e.g., rename `fireball` to your own equivalent. Note that this loses interop with any other pack that references `fireball` by its SRD ID.

For most consumers, the starter pack as shipped (with CC BY 4.0 attribution per NOTICE) is sufficient and legally clean. The cautions above apply mostly to commercial distributors who want a tight legal footing.
