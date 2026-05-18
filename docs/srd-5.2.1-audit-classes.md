# SRD 5.2.1 audit: classes, subclasses, class features

Fifth audit in the SRD 5.2.1 standardization series. Companion to the monster, magic-item, spell, and character-creation audits.

Outcome (slice 153): documentation pass. Identifies real drift and missing features; the fixes are content-authoring work for follow-up slices.

**Slice 172 update**: closed 12 of the 13 level-placement drift entries below. The Barbarian Improved Brutal Strike L13 to L17 entry was incorrect (SRD has Improved Brutal Strike at BOTH L13 and L17 as two separate features, and the pack already places them there). Also closed one rename (Cleric L20 Improved Divine Intervention to Greater Divine Intervention) from the pack-only-features table.

**Slice 173 update**: closed four more entries from the pack-only-features table. Renames: Paladin L11 Radiant Strike to Radiant Strikes (plural, matching SRD), Monk L18 Empty Body to Superior Defense. Drops: Monk L7 Step of the Wind: Heightened Mobility (2014-flavor, no SRD analog; Evasion remains the L7 grant), Warlock L3 Pact Boon (2014-flavor; SRD 5.2.1 handles Pact Boon as an Eldritch Invocation option starting at L1, and Warlock subclass selection at L3 is already modeled via the subclass machinery). Remaining pack-only entries (Cleric L2 Divine Spark as a separate feature, Sorcerer L20 Sorcery Points (20)) are schema / modeling differences, not drift — kept for now.

**Slices 174-176 update**: resource-pool value drift swept clean. Slice 174 closed Cleric Channel Divinity (1/2/3 to 2/3/4), Paladin Channel Divinity (added L11 max=3), Fighter Second Wind (added L4 max=3 + L10 max=4), and Bardic Inspiration uses (hardcoded 3 to `max(1, abilityMod CHA)` formula). Slice 174 also fixed the builder bug that was silently dropping Formula `max` on GrantResource. Slice 175 made Monk Ki + Sorcerer Sorcery Points linear-scaling via the `{kind: "level", classId: X}` formula primitive, dropping nine redundant tier-bump entries. Slice 176 moved Fighter Indomitable from L20 to L17 and corrected Druid Wild Shape uses (2/3/4 at L2/L6/L17 instead of 2/3/4/5/6 at L2/L5/L9/L13/L17). Of the original 13 level-placement drift items, all 12 real entries are now closed (the 13th, Barbarian Improved Brutal Strike, was an audit error: SRD has it at BOTH L13 and L17). Remaining work in this audit is the genuinely-missing L8+ main-class features (~17 entries) and the 41 missing subclass features at L6/L10/L14/L17.

## Status counts

| Layer | Pack | SRD 5.2.1 | Match |
|---|---|---|---|
| Classes (base names) | 12 | 12 | 12 / 12 |
| Subclasses (names) | 12 | 12 (one per class) | 12 / 12 |
| Main-class features (by first appearance) | ~110 | ~95 | ~95 in both; 12 with main-class level-placement drift; 1 subclass-feature drift |
| Subclass features | ~25 | ~66 | ~25 in both; **41 SRD-listed subclass features missing from pack** |

The class structure is clean. Drift surface concentrates in (a) per-feature level placements within main classes and (b) the depth of subclass coverage.

## Layer 1: classes (clean)

All 12 pack classes match SRD 5.2.1 names exactly: Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard.

## Layer 2: subclasses (clean)

All 12 pack subclasses match the 12 SRD 5.2.1 subclasses (SRD ships exactly one subclass per class): Path of the Berserker, College of Lore, Life Domain, Circle of the Land, Champion, Warrior of the Open Hand, Oath of Devotion, Hunter, Thief, Draconic Sorcery, Fiend Patron, Evoker.

## Layer 3: main-class features

The pack models scaling features as separate level entries (e.g., `Bardic Inspiration (d6)` at L1, `Bardic Inspiration (d8)` at L5, `Bardic Inspiration (d12)` at L15) while SRD lists each feature once at first appearance with scaling described in the body. The audit normalizes pack entries to first-appearance for comparison.

### Real level-placement drift (13 entries)

The pack places these features at different levels than SRD 5.2.1.

| Class | Feature | Pack level | SRD level |
|---|---|---|---|
| Barbarian | Improved Brutal Strike | L13 | L17 |
| Bard | Expertise | L3 | L2 |
| Bard | Superior Inspiration | L20 | L18 |
| Cleric | Channel Divinity | L1 | L2 |
| Cleric | Improved Blessed Strikes | L17 | L14 |
| Fighter | Tactical Mind | L5 | L2 |
| Fighter | Tactical Shift | L9 | L5 |
| Fighter | Tactical Master | L11 | L9 |
| Ranger | Nature's Veil | L9 | L14 |
| Rogue | Reliable Talent | L11 | L7 |
| Rogue | Improved Cunning Strike | L14 | L11 |
| Rogue | Devious Strikes | L18 | L14 |
| Wizard (Evoker subclass) | Sculpt Spells | L3 | L6 |

These are content bugs where the engine grants a feature at the wrong character level compared to RAW. Each needs a per-class fix that moves the feature in `levelTable` to the correct level. Out of scope for the audit slice; tracked for follow-up.

### Pack-only main-class features (5 entries, PHB 2014-flavored)

These pack features don't appear in SRD 5.2.1's class sections. They're 2014 PHB feature names that the 2024 PHB / SRD 5.2.1 restructured or replaced.

| Class | Feature | Pack level | Status |
|---|---|---|---|
| Cleric | Channel Divinity: Divine Spark | L2 | SRD covers Divine Spark as a Channel Divinity sub-option, not as a standalone feature; modeling difference |
| Cleric | Improved Divine Intervention | L20 | SRD has "Greater Divine Intervention" at L20; pack uses 2014 name |
| Monk | Step of the Wind: Heightened Mobility | L7 | 2014-flavored; SRD has different L7 progression |
| Monk | Empty Body | L18 | 2014 capstone; SRD has "Superior Defense" at L18 |
| Sorcerer | Sorcery Points (20) | L20 | Capstone scaling note; SRD models sorcery points via the class table |
| Warlock | Pact Boon | L3 | 2014 feature; SRD 5.2.1 has Pact Magic at L1 and different L3 grants |
| Paladin | Radiant Strike | L11 | SRD has "Radiant Strikes" (plural) at L11; name variant |

A future slice could rename / restructure these to match SRD 5.2.1.

### SRD main-class features handled differently in pack schema (recurring patterns)

The audit found that every class has these SRD-listed "features" missing from the pack's `levelTable`:

- **Spellcasting** at L1: SRD lists "Spellcasting" as a class feature for every full caster. Pack models spellcasting via per-class `spellcastingAbility` + `spellSlotTable` fields rather than a feature entry. Not a content gap; schema difference.
- **`<Class>` Subclass** at L3: SRD lists subclass selection as a class feature. Pack models subclasses as separate entries (`pack.subclasses[]`) joined to characters via `classes[].subclassId`. Schema difference.
- **Ability Score Improvement** at L4: SRD lists ASI as a class feature. Pack handles ASI via the level-up planner. Schema difference.
- **Epic Boon** at L19: SRD lists Epic Boon selection as a class feature. Pack handles it via `featsTaken` (the chosen Epic Boon is a feat). Schema difference.
- **Weapon Mastery** at L1 (Barbarian, Fighter, Paladin): SRD lists this. Pack handles Weapon Mastery as a per-weapon property granted by class proficiency rules, not as a class-feature entry.

These don't appear in the "missing from pack" lists below.

### SRD-listed main features genuinely missing from pack

Filtering out the recurring patterns above, the genuinely-missing main-class features are concentrated in 2024 PHB updates the pack hasn't caught up with yet:

- **Bard**: Words of Creation (L20)
- **Cleric**: Divine Order (L1), Greater Divine Intervention (L20)
- **Druid**: Primal Order (L1)
- **Monk**: Heightened Focus (L10), ~~Self-Restoration (L10)~~ (slice 202: wired via `planSelfRestoration` + `GrantSelfRestoration` marker; food / water Exhaustion arm consumer-side), Disciplined Survivor (L14), Superior Defense (L18)
- **Paladin**: Paladin's Smite (L2), Aura Expansion (L18)
- **Ranger**: Expertise (L9), Precise Hunter (L17)
- **Rogue**: ~~Uncanny Dodge (L5)~~ (slice 200: wired as a dedicated reaction planner + `GrantUncannyDodge` marker, compensating-Healed pattern), ~~Elusive (L18)~~ (slice 199: wired via the new `CancelAdvantageOnAttackers` primitive, predicate-gated on `bearerHasIncapacitated`)
- **Sorcerer**: ~~Sorcery Incarnate (L7)~~ (slice 201: alternative-cost arm wired via `planInnateSorcery` + `GrantInnateSorcerySpendAlternative` marker; doubled-metamagic arm deferred pending once-per-spell metamagic enforcement)
- **Warlock**: Contact Patron (L9)

About 17 main-class features at slice 196; slice 199 closed Rogue L18 Elusive (`CancelAdvantageOnAttackers` primitive), slice 200 closed Rogue L5 Uncanny Dodge (dedicated reaction planner + `GrantUncannyDodge` marker), slice 201 closed Sorcerer L7 Sorcery Incarnate's alternative-cost arm (`planInnateSorcery` + `GrantInnateSorcerySpendAlternative` marker), and slice 202 closed Monk L10 Self-Restoration (`planSelfRestoration` + `GrantSelfRestoration` marker). 13 remaining (the doubled-metamagic arm of Sorcery Incarnate is deferred to a future metamagic-tracking slice).

## Layer 4: subclass features

This is the largest gap. SRD 5.2.1 ships 4-5 features per subclass at L3 / L6 / L10 / L14 / L17 (or similar progression). Pack subclasses mostly ship only the L3 features.

### Missing subclass features (41 total across 12 subclasses)

| Subclass | Missing features |
|---|---|
| Path of the Berserker | L6 Mindless Rage, L10 Retaliation, L14 Intimidating Presence |
| College of Lore | L6 Magical Discoveries, L14 Peerless Skill |
| Life Domain | L3 Life Domain Spells, L3 Preserve Life, L6 Blessed Healer, L17 Supreme Healing |
| Circle of the Land | L3 Circle of the Land Spells, L6 Natural Recovery, L10 Nature's Ward, L14 Nature's Sanctuary |
| Champion | L7 Additional Fighting Style, L10 Heroic Warrior, L15 Superior Critical, L18 Survivor |
| Warrior of the Open Hand | L6 Wholeness of Body, L11 Fleet Step, L17 Quivering Palm |
| Oath of Devotion | L3 Sacred Weapon, L7 Aura of Devotion, L15 Smite of Protection, L20 Holy Nimbus |
| Hunter | L7 Defensive Tactics, L11 Superior Hunter's Prey, L15 Superior Hunter's Defense |
| Thief | L9 Supreme Sneak, L13 Use Magic Device, L17 Thief's Reflexes |
| Draconic Sorcery | L3 Draconic Spells, L6 Elemental Affinity, L14 Dragon Wings, L18 Dragon Companion |
| Fiend Patron | L3 Fiend Spells, L6 Dark One's Own Luck, L10 Fiendish Resilience, L14 Hurl Through Hell |
| Evoker | L3 Potent Cantrip, L10 Empowered Evocation, L14 Overchannel |

Note: a few of these names match pack features tagged differently (e.g., Sacred Weapon is wired in the engine but lives under the Oath of Devotion subclass entry, not as a separate `levelGrants[3]` feature). The audit script flags by structural presence; some entries may be mechanically present but indexed differently.

## Distribution policy

The 12 classes and 12 subclasses are SRD 5.2.1-derived and ship under CC-BY-4.0 with attribution. The 5 PHB 2014-flavored main features that don't appear in SRD 5.2.1 (Empty Body, Pact Boon, etc.) are kept in the pack for the same reason backgrounds + feats keep their PHB extras (slice 152): the pack ships content-authoring material that downstream consumers can prune to SRD-only as needed.

The 41 missing SRD-listed subclass features are content-authoring follow-ups. Wiring them is per-feature engine + content work; the level-placement table above is the queue.

## Re-running the audit

```bash
node /tmp/class-audit.mjs
cat /tmp/class-audit.json
```

(Script at `/tmp/class-audit.mjs`; not checked in.)
