# Content attribution audit

Item-by-item review of the starter content pack at `src/content/packs/starter-pack.json` against the Dungeons & Dragons System Reference Document 5.2 (SRD 5.2), released by Wizards of the Coast under CC BY 4.0.

The intent is to be explicit about which content is clearly SRD-derived (covered by the CC BY 4.0 license with attribution) and which uses 2024 PHB/DMG mechanic names whose inclusion in SRD 5.2 the authors have not independently verified.

**This is a good-faith audit, not legal advice.** If you publish derivatives or build a commercial product on top of this pack, consult an attorney and the current published SRD 5.2 contents list.

## Confidently SRD-derived

All of these are present in SRD 5.2 in a form that matches the mechanical surface we encode. CC BY 4.0 attribution applies; the package's NOTICE file carries the required attribution string.

- **Species**: Human, Elf, Dwarf, Halfling, Tiefling, Dragonborn, Gnome (basic versions).
- **Classes**: Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard. The level tables, proficiency bonus progression, hit dice, saving throw proficiencies, and spellcasting type per class are SRD-standard.
- **Class features named in the pack**: Rage, Reckless Attack, Danger Sense, Fast Movement, Bardic Inspiration, Jack of All Trades, Expertise, Font of Inspiration, Channel Divinity, Druidic, Wild Shape, Wild Companion, Second Wind, Action Surge, Extra Attack, Martial Arts, Monk's Focus (Ki), Unarmored Defense, Unarmored Movement, Slow Fall, Stunning Strike, Evasion, Favored Enemy, Deft Explorer, Sneak Attack, Innate Sorcery, Font of Magic, Metamagic, Sorcerous Restoration. These are standard class-feature names in the 2024 PHB and per WotC's announcement of SRD 5.2 are included in the SRD release.
- **Backgrounds**: all 16 PHB 2024 backgrounds (Acolyte, Artisan, Charlatan, Criminal, Entertainer, Farmer, Guard, Guide, Hermit, Merchant, Noble, Sage, Sailor, Scribe, Soldier, Wayfarer) with their 2024 ability options, skill / tool proficiencies, and origin feats. Three legacy 2014 names (Folk Hero, Guild Artisan, Outlander) ship alongside for existing-character compatibility.
- **Origin feats** (named in pack): Savage Attacker, Alert, Magic Initiate (Cleric / Wizard / Druid variants), Tough, Skilled, Crafter, Lucky.
- **General feats** (named in pack): Great Weapon Master, Sharpshooter, Polearm Master, War Caster, Resilient.
- **Fighting Styles**: Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting.
- **Spells** (all 399 in the pack covering every PHB 2024 entry across L0–L9). The 2024 SRD release lists the same canonical names; mechanical encodings (damage dice, save abilities, conditionOnFail wirings, slot scaling, etc.) are this package's own implementation against the SRD shape. Specific spells whose SRD inclusion is worth verifying for commercial use are flagged separately in the "Likely SRD-included" section below.
- **Conditions** (all 15 2024 conditions): Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious. The pack additionally ships ~10 mechanic-rider conditions that are this package's own mechanical encodings (e.g. `blessed`, `baned`, `held-paralyzed-active`, `cursed-attacks-active`, `fire-shield-warm-active`, `healing-blocked-active`, `spirit-shroud-cold-active`). These names and shapes are not WotC text; they are the engine's expression of how spell effects compose.
- **Weapons**: Longsword, Rapier, Dagger, Shortsword, Longbow, Greatsword, Greataxe, Warhammer, Mace, Spear, Quarterstaff, Handaxe, Crossbow (light). All SRD-standard mundane weapons.
- **Armor**: Leather Armor, Chain Shirt, Chain Mail, Plate Armor, Shield, Studded Leather, Scale Mail, Breastplate, Half Plate, Ring Mail, Splint. All SRD-standard.
- **Tools and gear**: Thieves' Tools, Smith's Tools, Herbalism Kit, Calligrapher's Supplies, Lute, Torch, Rope (hempen, 50 feet), Backpack, Rations (1 day), Waterskin, Bedroll, Tinderbox.
- **Consumable magic items**: Potion of Healing, Potion of Greater Healing, Potion of Superior Healing.
- **Magic items**: Bag of Holding, Cloak of Protection, Boots of Elvenkind, Wand of Magic Missiles, Ring of Protection, Amulet of Health, Gauntlets of Ogre Power. All are standard SRD magic items.
- **Monsters**: Goblin, Orc, Wolf, Skeleton, Ogre. Standard low-CR SRD creatures.

## Likely SRD-included but worth verifying before commercial use

The authors believe these are in SRD 5.2 based on WotC's announced inclusion criteria, but have not independently confirmed every entry against the published SRD 5.2 release. Consumers planning commercial distribution should verify directly.

- **Weapon Mastery property names**: Sap, Vex, Topple, Push, Slow, Cleave, Nick, Graze, Flex. These are 2024 PHB combat mechanics. WotC announced that SRD 5.2 includes the weapon-mastery system; the specific named masteries should be covered, but verify against the SRD release.
- **Young Red Dragon**: a Monster Manual creature. The base statblock dimensions (HP, AC, abilities, fire immunity, multiattack pattern) are standard MM content; the SRD typically includes representative dragons but the exact mix in SRD 5.2 may not include a Young Red Dragon. If commercializing, consider replacing with a SRD-confirmed dragon or making the dragon homebrew.
- **Flametongue Longsword**: SRD includes "Flame Tongue" (the weapon type); whether the specific variant of "Flametongue Longsword" is enumerated may vary.

## Not confirmed in SRD 5.2

These entries reference 2024 PHB or DMG mechanics whose presence in SRD 5.2 the authors have not verified. They are present in the starter pack because the mechanical surface is implemented in the engine; consumers should either (a) treat these as homebrew shapes that they replace with their own pack content, or (b) confirm SRD inclusion before commercial distribution.

- **Bastions** (the entire stronghold system, including `Bastion`, `BastionFacility`, `BastionHireling`, turn orders such as `maintain` / `craft` / `recruit` / `research` / `trade` / `empower`). This is a 2024 DMG system. The engine's implementation (schemas, events, reducers) is original. The *concept* of a stronghold system is unprotectable; the *specific named turn orders and facility types* derived from DMG text may not be in SRD 5.2.
- **Epic Boons** (`Boon of Combat Prowess`, `Boon of Dimensional Travel`, `Boon of Energy Resistance`, `Boon of Fortitude`, `Boon of Irresistible Offense`, `Boon of Skill`, `Boon of Spell Recall`, `Boon of the Night Spirit`, `Boon of Truesight`). 2024 DMG content. Many SRD releases historically exclude post-20 boon content. Verify.
- **Deck of Many Things**: famous DMG item. The name is concise and individual names are generally outside copyright scope, but the *card-by-card text* of the Deck is highly creative and clearly protected. The starter pack ships only the name (no card details), which is the conservative choice; verify naming itself is acceptable for your use.

## Trademarks

"Dungeons & Dragons", "D&D", and related marks are trademarks of Wizards of the Coast LLC. This package is not affiliated with WotC. The package name `ttrpg-engine-dnd` uses generic descriptive terms; "dnd" appears in the lowercase descriptive sense, not as branding.

## How to extend or replace the starter pack

If you need a clean-room content pack (no WotC-derived material), the practical approach is:

1. **Start from your own pack JSON** (see `src/schemas/content/` for the shapes).
2. **Load alongside or instead of the starter pack**: `resolveContent([myPack])` or `resolveContent([loadStarterPack(), myPack])` with later packs overriding by ID.
3. **Strip names that match SRD**: e.g., rename `fireball` to your own equivalent. Note that this loses interop with any other pack that references `fireball` by its SRD ID.

For most consumers, the starter pack as shipped (with CC BY 4.0 attribution per NOTICE) is sufficient and legally clean. The cautions above apply mostly to commercial distributors who want a tight legal footing.
