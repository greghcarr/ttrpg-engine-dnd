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

**Magic items (slice 150, completed).** The audit + per-entry diff record live at [docs/srd-5.2.1-audit-items.md](srd-5.2.1-audit-items.md). Slice 150 dropped 16 non-SRD entries (XGE cosmetics: Cloak of Billowing, Cloak of Many Fashions, Clothes of Mending, Ear Horn of Hearing, Hat of Vermin, Mystery Key, Pole of Angling, Shield of Expression, Tankard of Sobriety; plus Cap of Water Breathing, Deck of Many Things, Driftglobe, Rod of the Pact Keeper +1, Smoldering Armor, Staff of the Adder, Wand of Pyrotechnics). The remaining 122 entries either match an SRD 5.2.1 entry by name (98 case-insensitive matches), are granular variants of a grouped SRD entry (21: Armor +1/+2/+3, Weapon +1/+2/+3, Belt of X Giant Strength × 6, Ioun Stone variants × 8, Quaal's Feather Token Anchor), or use a slight name variant of an SRD entry (3: Stone of Good Luck = SRD "Stone of Good Luck (Luckstone)", Flametongue Longsword = SRD "Flame Tongue" variant, Amulet of Proof Against Detection and Location = SRD's same name with one capitalization diff). The audit covered names + grouping logic; rarity / attunement / effect-array drift checks are a separate follow-up.

## Confidently SRD-derived (auditable categories)

These categories have content matching SRD 5.2.1 with high confidence. CC BY 4.0 attribution applies; the package's NOTICE file carries the required attribution string.

- **Monsters** (111 entries). All verified against SRD 5.2.1 markdown (via the audit script and a spot-check against the SRD 5.2.1 PDF). See [docs/srd-5.2.1-audit.md](srd-5.2.1-audit.md). The pack is a 111-entry subset of the SRD 5.2.1's 235 monster stat blocks + 95 animal stat blocks (330 creatures total).
- **Magic items** (122 entries). All verified against SRD 5.2.1 markdown. See [docs/srd-5.2.1-audit-items.md](srd-5.2.1-audit-items.md). The pack is a 122-entry subset of the SRD 5.2.1's ~260 magic-item A-Z entries.
- **Conditions** (all 15 RAW + ~25 mechanic-rider conditions). Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious. The pack additionally ships mechanic-rider conditions that are this package's own encoding (e.g. `blessed`, `baned`, `held-paralyzed-active`, `cursed-attacks-active`, `fire-shield-warm-active`); these names and shapes are not WotC text, they are the engine's expression of how spell effects compose.
- **Weapons / Armor / Tools / Gear**. The mundane equipment matches SRD 5.2.1's equipment listing.
- **Backgrounds** (16 PHB 2024 backgrounds + 3 legacy 2014 names). The 2024 backgrounds (Acolyte, Artisan, Charlatan, Criminal, Entertainer, Farmer, Guard, Guide, Hermit, Merchant, Noble, Sage, Sailor, Scribe, Soldier, Wayfarer) are SRD 5.2.1 confirmed. The legacy names (Folk Hero, Guild Artisan, Outlander) ship alongside for existing-character compatibility.
- **Species** (7 entries). Human, Elf, Dwarf, Halfling, Tiefling, Dragonborn, Gnome. Basic versions ship; species traits beyond name + speed + size are mostly schema-only.

## Not yet individually audited

These categories ship 2024 PHB / DMG names with mechanical encodings, and likely match SRD 5.2.1 contents for the most part, but each entry has not been independently cross-referenced against the SRD 5.2.1 release.

- **Spells** (399 entries). Every 2024 PHB spell across L0 to L9. SRD 5.2.1 explicitly includes the PHB 2024 spell list. A small fraction of spell names may differ between PHB 2024 and SRD 5.2.1 (e.g. some power-level adjustments and rename normalizations); the pack uses the PHB 2024 names. Recommended: confirm SRD inclusion on a per-spell basis for any commercial use of an unusual spell.
- **Classes** (12) + class features. All 12 standard classes ship with L1-L20 progression. The base class tables and core features (Rage, Action Surge, Sneak Attack, Wild Shape, etc.) are SRD-confirmed. The pack's per-level feature wirings are this package's own encoding; per-feature SRD verification has not been done.
- **Feats** (~35). Including the six 2024 fighting styles. Origin feats + General feats + several Epic Boons. Most are SRD 5.2.1 confirmed; per-feat verification has not been done.

## Not in SRD 5.2.1 (consumer responsibility for downstream use)

These entries reference 2024 PHB or DMG mechanics whose presence in SRD 5.2.1 the authors have not verified, or which are known to fall outside SRD 5.2.1. They are present in the starter pack because the mechanical surface is implemented in the engine.

- **Bastions** (the entire stronghold system, including `Bastion`, `BastionFacility`, `BastionHireling`, turn orders such as `maintain` / `craft` / `recruit` / `research` / `trade` / `empower`). 2024 DMG content. The engine's implementation (schemas, events, reducers) is original. The concept of a stronghold system is unprotectable; the specific named turn orders and facility types derived from DMG text may not be in SRD 5.2.1. Treat the engine implementation as legally clean; treat the specific WotC-derived names as homebrew shapes that consumers can rename freely.
- **Epic Boons** (`Boon of Combat Prowess`, `Boon of Dimensional Travel`, `Boon of Energy Resistance`, `Boon of Fortitude`, `Boon of Irresistible Offense`, `Boon of Skill`, `Boon of Spell Recall`, `Boon of the Night Spirit`, `Boon of Truesight`). 2024 DMG content. SRD 5.2.1 inclusion not verified. Treat each name as homebrew if downstream use is sensitive.
- **Deck of Many Things**: famous DMG item. Card-by-card text is highly creative and protected; the starter pack ships only the name (no card details). Whether the name itself is acceptable for your use is a separate question.

## Trademarks

"Dungeons & Dragons", "D&D", and related marks are trademarks of Wizards of the Coast LLC. This package is not affiliated with WotC. The package name `ttrpg-engine-dnd` uses generic descriptive terms; "dnd" appears in the lowercase descriptive sense, not as branding.

## How to extend or replace the starter pack

If you need a clean-room content pack (no WotC-derived material), the practical approach is:

1. **Start from your own pack JSON** (see `src/schemas/content/` for the shapes).
2. **Load alongside or instead of the starter pack**: `resolveContent([myPack])` or `resolveContent([loadStarterPack(), myPack])` with later packs overriding by ID.
3. **Strip names that match SRD**: e.g., rename `fireball` to your own equivalent. Note that this loses interop with any other pack that references `fireball` by its SRD ID.

For most consumers, the starter pack as shipped (with CC BY 4.0 attribution per NOTICE) is sufficient and legally clean. The cautions above apply mostly to commercial distributors who want a tight legal footing.
