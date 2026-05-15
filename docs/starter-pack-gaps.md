# Starter pack coverage and gaps

Engine-internal accounting of what currently ships in [src/content/packs/starter-pack.json](../src/content/packs/starter-pack.json) versus what's deferred. Consumers of `ttrpg-engine-dnd` who want fuller coverage will be extending this pack; this doc tells them where the holes are and why.

This is separate from [content-attribution.md](content-attribution.md), which is a licensing audit (what's clearly SRD-derived vs needs verification). The two docs are kept in parallel: attribution tracks "may we ship this?", this doc tracks "is it actually in here, and how completely?".

## Coverage at a glance

| Category | In pack | Rough PHB total | Notes |
|---|---|---|---|
| Classes | 12 / 12 | 12 | All scaffolded with 1–20 level tables. Most L2+ rows ship empty (see Class features). |
| Subclasses | 12 / ~50 | ~50 | One canonical L3 subclass per class. No L7 / L10 / L14 features for any. |
| Species | 7 / ~10 | ~10 | Aasimar, Goliath, Orc deferred. |
| Backgrounds | 19 / 16 | 16 | Full PHB 2024 list shipped (plus three legacy entries kept for round-trip compatibility). |
| Feats | 33 total | ~50+ | 12 origin / 6 general / 6 fighting style / 9 epic boon. General feats partial. |
| Spells | 212 / ~370 | ~370 | 34 / 60 / 63 / 54 / 1 across L0–L4. Cantrips complete; L1 / L2 / L3 ship every PHB entry (~22 wired at L1, ~19 at L2, ~16 at L3 — counting summon-system wiring). L4+ stub-heavy. |
| Items | 77 total | hundreds (DMG) | 53 weapons + armor + shields + tools + mundane gear + 9 magic items. Bulk DMG magic items deferred. |
| Monsters | 6 / hundreds | ~370 (MM) | Goblin, Orc, Wolf, Skeleton, Ogre, Young Red Dragon. CR 1/2 and most of MM deferred. |
| Conditions | 25 / 15 | 15 (RAW) | All 15 RAW conditions plus 10 mechanic-rider conditions used by the engine. |

## Spells

Status legend: `wired` = has `mechanicalEffects` array entries that the engine consumes. `planner` = handled by a dedicated planner (`planShield`, `planCounterspell`, `planDispelMagic`, `planIdentify`, `planMistyStep`, `planPolymorph`, `planHuntersMark`); `mechanicalEffects` stays empty by design. `schema-only` = ships in the pack so the schema validator + consumer code sees the spell, but no mechanical event is emitted on cast.

### Cantrips (L0): 34 / 34

**Wired (18):** acid-splash, chill-touch, eldritch-blast, fire-bolt, frostbite, guidance, mind-sliver, poison-spray, produce-flame, ray-of-frost, sacred-flame, shocking-grasp, starry-wisp, thorn-whip, thunderclap, toll-the-dead, vicious-mockery, word-of-radiance.

**Schema-only (16):** blade-ward, dancing-lights, druidcraft, friends, light, mage-hand, mending, message, minor-illusion, mold-earth, prestidigitation, resistance, shillelagh, spare-the-dying, thaumaturgy, true-strike. All intentionally narrative / utility — no mechanical event to emit.

### L1: 60 / 60 (full PHB list)

**Wired (22):** bane, bless, burning-hands, cause-fear, charm-person, color-spray, cure-wounds, dissonant-whispers, earth-tremor, faerie-fire, find-familiar (summon), guiding-bolt, healing-word, hellish-rebuke, inflict-wounds, mage-armor, magic-missile, ray-of-sickness, sleep, tashas-hideous-laughter, thunderwave, unseen-servant (summon).

**Dedicated planner (3):** hunters-mark, identify, shield.

**Schema-only (35):** grouped by the engine primitive each one needs.

- **On-hit trigger system** (rider that fires on the caster's next weapon attack): `divine-favor`, `ensnaring-strike`, `hail-of-thorns`, `hex`, `searing-smite`, `thunderous-smite`, `wrathful-smite`. The smite-pattern cohort.
- **Reaction system** (cast as a reaction to a trigger event): `absorb-elements`, `feather-fall`, `sanctuary`. Also future Silvery Barbs and a Shield-as-spell variant.
- **Area-effect spell mechanic** (zone with save on enter + ongoing condition / damage): `entangle`, `grease`. Also future Cloudkill, Wall of Fire.
- **Temp-HP grant as a spell mechanic** (current `heal` writes to `current` only): `false-life`, `heroism`.
- **Caster-chosen options at cast time** (damage type or spell variant): `chromatic-orb`, `command` (per-word effects).
- **AC-buff condition** (flat AC bonus tied to a condition): `shield-of-faith`.
- **Type-conditional buff** (advantage / disadvantage keyed to creature type): `protection-from-evil-and-good`.
- **Pure narrative / utility** (intentionally no mechanical event): `alarm`, `animal-friendship`, `comprehend-languages`, `compelled-duel`, `create-or-destroy-water`, `detect-evil-and-good`, `detect-magic`, `detect-poison-and-disease`, `disguise-self`, `expeditious-retreat`, `fog-cloud`, `goodberry`, `jump`, `longstrider`, `purify-food-and-drink`, `silent-image`, `speak-with-animals`. Rituals, illusions, sensory spells; they parse and load, they just don't emit anything.

### L2: 63 / 63 (full PHB list)

**Wired (19):** aid, blindness-deafness, crown-of-madness, find-steed (summon), flame-blade, heat-metal, hold-person, invisibility, lesser-restoration, melfs-acid-arrow, moonbeam, prayer-of-healing, protection-from-poison, scorching-ray, shatter, spiritual-weapon, suggestion, summon-beast (summon), web.

**Dedicated planner (1):** misty-step.

**Schema-only (43):** grouped by the engine primitive each one needs.

- **On-hit trigger system** (rider that fires on the caster's next weapon attack): `branding-smite`. Continues the smite-pattern cohort from L1.
- **Area-effect spell mechanic** (zone with save on enter, ongoing damage, or movement penalty): `cloud-of-daggers`, `darkness`, `dust-devil`, `flaming-sphere`, `silence`, `spike-growth`, `zone-of-truth`.
- **Caster-chosen options at cast time** (variant chosen by caster, ability target chosen): `calm-emotions`, `enhance-ability`, `enlarge-reduce`.
- **AC-buff condition** (flat AC bonus tied to a condition): `barkskin` (sets AC to 17 — a "set AC" variant of the AC buff primitive).
- **Attack-roll-buff condition** (impose advantage / disadvantage on attacks against target): `blur` (disadv against caster), `mirror-image` (duplicate intercept pool), `pass-without-trace` (+10 stealth).
- **Item-buff condition** (modifies attack / damage of an equipped weapon while active): `magic-weapon`.
- **On-hit weapon-damage rider** (modifies damage a target deals on subsequent attacks): `ray-of-enfeeblement`.
- **Recurring-rider primitive** (effect that fires each turn while condition is active): `phantasmal-force` (1d6 psychic per believed turn).
- **Movement-mode condition** (flying / climbing / hover modes): `levitate`, `spider-climb`.
- **Aerial restraint condition** (knocks flying targets to ground): `earthbind`.
- **Perception-buff condition**: `enthrall` (disadvantage on perception against caster).
- **On-action trigger rider** (cast on willing creature who gains a one-time / per-action effect): `dragons-breath`.
- **Trap mechanic** (placed delayed-effect area): `cordon-of-arrows`.
- **Multi-target linked condition** (effect that ties two creatures together): `warding-bond`.
- **Transformation handler** (shapeshift utility): `alter-self`.
- **Push primitive** (move target via STR save with no damage): `gust-of-wind`.
- **Pure narrative / utility** (intentionally no mechanical event): `animal-messenger`, `arcane-lock`, `augury`, `continual-flame`, `darkvision`, `detect-thoughts`, `find-traps`, `gentle-repose`, `knock`, `locate-animals-or-plants`, `locate-object`, `magic-mouth`, `nystuls-magic-aura`, `rope-trick`, `see-invisibility`, `skywrite`. Ritual, divination, illusion, and utility spells; they parse and load, they just don't emit a mechanical event.

### L3: 54 / 54 (full PHB list)

**Wired (16):** animate-dead (summon), call-lightning, conjure-animals (summon), fear, fireball, hypnotic-pattern, lightning-bolt, mass-healing-word, phantom-steed (summon), sleet-storm, spirit-guardians, summon-fey (summon), summon-lesser-demons (summon), summon-shadowspawn (summon), summon-undead (summon), vampiric-touch.

**Dedicated planner (2):** counterspell, dispel-magic.

**Schema-only (36):** grouped by the engine primitive each one needs.

- **Area-effect spell mechanic** (zone with save on enter, ongoing damage, or movement penalty): `hunger-of-hadar`, `leomunds-tiny-hut`, `plant-growth`, `slow`, `stinking-cloud`, `wind-wall`. Several couple area with a recurring-rider primitive (Hunger, Stinking Cloud).
- **On-hit trigger system** (rider that fires on a weapon attack): `blinding-smite`, `crusaders-mantle`, `lightning-arrow`. The smite-pattern cohort.
- **Composite-buff condition** (single condition that imposes multiple distinct effects): `beacon-of-hope` (heal-max + advantage on WIS + death saves), `haste` (extra action + speed + AC + DEX-save advantage).
- **Caster-chosen options at cast time** (variant chosen by caster, damage type chosen): `bestow-curse` (4-variant curse), `elemental-weapon` (damage type), `spirit-shroud` (damage type + on-hit).
- **Type-conditional area-effect** (ward against creature types): `magic-circle`.
- **Illusion mechanic** (INT save against interaction with illusion + recurring belief check): `major-image`.
- **Resistance-buff condition** (damage-type resistance tied to a condition): `protection-from-energy`.
- **Cursed condition** (the condition itself isn't yet modeled): `remove-curse` — once `cursed` lands, this is a one-line `remove-condition` wire.
- **Movement-mode condition**: `fly`.
- **Transformation handler** (shapeshift utility): `gaseous-form`.
- **Trap mechanic** (placed delayed-effect): `glyph-of-warding`.
- **Resurrection mechanic**: `revivify`.
- **Scrying mechanic** (remote sensor): `clairvoyance`.
- **Multi-mechanic teleport** (matches Misty Step's dedicated-planner pattern; needs its own planner for teleport + area damage): `thunder-step`.
- **Recurring-rider primitive** (heal each turn from caster bonus action): `aura-of-vitality`.
- **Pure narrative / utility** (intentionally no mechanical event): `create-food-and-water`, `daylight`, `feign-death`, `meld-into-stone`, `nondetection`, `sending`, `speak-with-dead`, `speak-with-plants`, `tongues`, `water-breathing`, `water-walk`. Rituals, divination, and quality-of-life spells.

### L4: 1 / ~28

**Dedicated planner (1):** polymorph.

**Schema-only:** none in pack yet. The remaining ~27 PHB L4 spells are not yet in the pack.

### L5–L9: 0 / ~140

Not in pack.

## Class features

All twelve classes have a `levelTable` keyed 1–20, but most rows ship `features: []`. The content shape exists; the data is the gap.

| Class | Levels with features | Empty rows |
|---|---|---|
| barbarian | 1, 2, 3, 5, 6, 7, 9, 11, 12, 13, 15, 17, 18, 20 | 6 (ASI / subclass-only levels) |
| bard | 1, 2, 3, 5, 7, 9, 10, 15, 20 | 11 (ASI / subclass-only / un-named levels) |
| cleric | 1, 2, 5, 6, 7, 10, 17, 18, 20 | 11 (ASI / subclass-only levels) |
| druid | 1, 2, 5, 7, 9, 13, 15, 17, 18, 20 | 10 (ASI / subclass-only / un-named levels) |
| fighter | 1, 2, 5 | 17 |
| monk | 1, 2, 4, 5, 7 | 15 |
| paladin | 1, 2, 3 | 17 |
| ranger | 1, 2, 5 | 17 |
| rogue | 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 | 10 (Sneak Attack scales at every odd level) |
| sorcerer | 1, 2, 5 | 17 |
| warlock | (none) | 20 |
| wizard | 1 | 19 |

Notable missing scaling: Wild Shape forms (the available CR / size / movement-mode beast list), Action Surge count, Extra Attack at L11/L20, Stunning Strike DC scaling, Martial Arts die, Ki uses, Sneak Attack damage (the only scaling-by-level feature that *does* currently land at the content layer). Rage use-count tiers (L3 / L6 / L12 / L17) wire after slice 49 via `GrantResource` overrides, the same pattern Channel Divinity uses; Rage damage bonus (L9 / L16) and Rage resistance / advantage still need engine work. Bardic Inspiration die scaling (L5 d8 / L10 d10 / L15 d12) wires after slice 50 via the `diceSize` field on `GrantResource`; the use-count formula is still hardcoded at 3 instead of CHA-mod-with-floor-1. Channel Divinity uses now scale fully across L1 / L6 / L18 (1 / 2 / 3 uses per rest) after slice 51. Wild Shape use-count tiers (L5 / L9 / L13 / L17) wire after slice 52 via the same pattern, hardcoding the PB-based progression instead of reading the actor's proficiency bonus.

### Barbarian stub features (effects: [], waiting on engine work)

Slice 49 filled the empty L3-L20 rows. Wired entries lift the rage use cap at L3 / L6 / L12 / L17. The remaining new features ship `effects: []` because each needs a primitive the engine doesn't have yet:

- `primal-knowledge` (L3) — needs a "use STR mod instead of normal mod on these skill checks while raging" effect; depends on a `raging` condition the engine doesn't ship.
- `instinctive-pounce` (L7) — bonus-action movement piggyback when entering Rage; needs the rage entry hook to attach a one-time movement grant.
- `brutal-strike` (L9), `improved-brutal-strike` (L13), `improved-brutal-strike-mighty-roar` (L17) — replace Reckless Attack's advantage with a +1d10 (then +2d10) damage rider plus a chosen effect (Forceful Blow / Hamstring Blow / Sundering Blow / Staggering Blow). Needs a choice-at-attack-time primitive that the attack planner consults.
- `relentless-rage` (L11) — auto-succeed a failed save once per Rage at the cost of Exhaustion; needs a save-result-replacement hook.
- `persistent-rage` (L15) — drop the 10-round Rage duration but keep the "ends on no-attack-no-damage turn" rule; needs Rage to be a real ongoing effect with duration tracking the engine doesn't model.
- `indomitable-might` (L18) — use STR score in place of a STR check total when lower; needs check-total replacement.
- `primal-champion` (L20) — STR / CON +4 with a cap of 25; needs an ability-score-modification effect (the current schema only modifies derived values, not the base scores).

Open item: the L1 Weapon Mastery feature (Barbarian gets 2 slots per the 2024 PHB) is not in the current pack — the L1 row only ships Rage + Unarmored Defense. That's a separate one-line fix outside this slice.

### Bard stub features (effects: [], waiting on engine work)

Slice 50 filled L7, L9, L10, L15, L20. Wired entries scale the Bardic Inspiration die (d8 / d10 / d12 at L5 / L10 / L15) and add a second Expertise pair at L9 (currently hardcoded to performance + deception, mirroring the L3 hardcode of insight + persuasion). The remaining stubs:

- `countercharm` (L7) — Performance check to grant nearby allies a saving-throw advantage against Charmed / Frightened or to interrupt a hostile spell; needs a reaction-window primitive and a recurring action.
- `magical-secrets` (L10) — daily-rest spell swap from any class's spell list; needs cross-class spell access plus a choice protocol that fires on long rest.
- `superior-inspiration` (L20) — regain one Bardic Inspiration use on rolling initiative if at zero; needs an on-initiative trigger hook the engine doesn't model.

The Expertise picks at L3 and L9 are hardcoded skill pairs because the existing `OfferChoice` protocol can express a player-pick but the L3 entry that shipped earlier didn't use it; the L9 entry matches L3's pattern for consistency. Moving both to player-pick is a separate small slice once any class needs the pattern (Rogue Expertise is the obvious next consumer).

### Cleric stub features (effects: [], waiting on engine work)

Slice 51 filled L2, L5, L7, L10, L17, L18, L20. The L18 entry wires the Channel Divinity use-count to 3/rest via `GrantResource`, completing the L1 / L6 / L18 tier ladder. The remaining stubs:

- `divine-spark` (L2) — Channel Divinity option that lets the cleric heal or deal necrotic / radiant damage as a Bonus Action. Needs a "choose CD option at activation time" protocol and a saved-spell-like cast surface; the engine has `channel-divinity` as a resource but no per-option dispatch.
- `sear-undead` (L5) — Channel Divinity (Turn Undead) adds radiant damage on a failed save. Needs Turn Undead modeled as an action plus a per-tier damage rider; not in pack.
- `blessed-strikes` (L7) and `improved-blessed-strikes` (L17) — choice between Divine Strike (+1d8 damage type on weapon attack) or Potent Spellcasting (+WIS mod to cantrip damage). Needs a `OfferChoice` over once-per-acquisition options plus the on-hit-rider / cantrip-bonus primitives.
- `divine-intervention` (L10) and `improved-divine-intervention` (L20) — 1/week (1/long-rest at L20) prayer for a divine effect. Needs a flag for "intervention used in last 7 days" plus a freeform DM-resolution event; closest existing surface is `CustomEffect`, but no handler ships.

Open item: L1 Divine Order (choice between Protector and Thaumaturge sub-features at character creation) is not in the L1 features array. Same shape as Barbarian's missing L1 Weapon Mastery; deferred to a later one-line slice.

### Druid stub features (effects: [], waiting on engine work)

Slice 52 filled L5, L7, L9, L13, L15, L17, L18, L20. Wired entries hardcode Wild Shape use counts at PB-based tiers (3 / 4 / 5 / 6 at L5 / L9 / L13 / L17). The pack still uses short-rest recharge from the L2 entry; 2024 RAW is long-rest recharge with PB uses, so the use-count progression matches the rulebook but the recharge cadence is a pre-existing inconsistency. Stubs:

- `wild-resurgence` (L5) — regain one Wild Shape charge when casting a 1st+ level spell, or convert a Wild Shape charge into a 1st-level slot. Needs a "gain resource" trigger action (the engine's `OnEvent` ships only `SpendResource`, not a grant) plus a player-elected reverse swap.
- `elemental-fury` (L7) and `improved-elemental-fury` (L15) — choice between Potent Spellcasting (+WIS mod to druid cantrip damage) or Wild Strike (extra unarmed-strike rider when Wild Shaped). Needs the same on-hit-rider + cantrip-bonus primitives Cleric's Blessed Strikes is blocked on.
- `beast-spells` (L18) — cast druid spells while in Wild Shape. Needs the engine's Wild Shape handler to consult an "allow caster actions" flag rather than swap the entire actor.
- `archdruid` (L20) — unlimited Wild Shape (treat the resource as auto-refunded on use), plus the ability to disregard verbal / somatic / non-cost material components for druid spells. Needs an "ignore resource cost" override.

The CR / movement-mode / size catalog of Wild Shape forms (Beast Shape, Combat Wild Shape, etc.) is still entirely consumer territory; the engine accepts a chosen statblock at transformation time but no canonical druid form library ships in the pack.

## Subclasses

One canonical L3 subclass ships per class:

- path-of-the-berserker, college-of-lore, life-domain, circle-of-the-land, champion, warrior-of-the-open-hand, oath-of-devotion, hunter, thief, draconic-sorcery, fiend-patron, evoker.

Each entry's `levelGrants` only has an L3 row. L7 / L10 / L14 (the standard subclass progression points) are unstarted across every subclass. The additional 3–4 subclasses per class in the PHB are not in the pack.

Even within the L3 row, several subclass features ship as content stubs (the names appear but no mechanical wiring): Wild Shape forms (druid), Patron Spells (warlock fiend, paladin devotion), Hunter's Lore + Hunter's Prey (ranger hunter), Fast Hands (rogue thief), Open Hand Technique (monk), Land's Aid (druid circle of the land), Sculpt Spells (evoker wizard), Dark One's Blessing (warlock fiend).

## Items

- **Weapons (40):** Every PHB 2024 simple + martial weapon plus tagged mastery (`vex`, `topple`, `sap`, `nick`, `push`, `slow`, `cleave`, `graze`, `flex`). Weapon catalogue is complete.
- **Armor + shields (13):** Every PHB 2024 armor entry.
- **Tools + mundane gear (~15):** Thieves' tools, smith's tools, herbalism kit, lute, torch, rope, backpack, rations, waterskin, bedroll, tinderbox.
- **Magic items (9):** Bag of Holding, Cloak of Protection, Boots of Elvenkind, Wand of Magic Missiles, Ring of Protection, Amulet of Health, Gauntlets of Ogre Power, plus three potions (Healing, Greater Healing, Superior Healing).

The DMG is hundreds of items long; this pack ships a representative slice. Magic item charges are tracked via the engine's `resources` shape; only Wand of Magic Missiles currently exercises that.

## Monsters

Six statblocks: Goblin (CR 1/4), Orc (CR 1/2), Wolf (CR 1/4), Skeleton (CR 1/4), Ogre (CR 2), Young Red Dragon (CR 10).

Notable gaps for tutorial / starter encounters: Bandit, Cultist, Commoner, Guard, Veteran, Bandit Captain. CR 1/8 and the rest of CR 1/2–1 is the easiest near-term fill.

## Species

Seven species: Human, Elf, Dwarf, Halfling, Tiefling, Dragonborn, Gnome. PHB 2024 adds Aasimar, Goliath, and the 2024-edition Orc as a playable species. None are in the pack.

## Backgrounds

The full PHB 2024 list (16) is shipped: Acolyte, Artisan, Charlatan, Criminal, Entertainer, Farmer, Folk Hero, Guard, Guide, Hermit, Merchant, Noble, Outlander, Sage, Sailor, Scribe, Soldier, Wayfarer. Plus three legacy entries kept for round-trip compatibility.

## Feats

- **Origin (12):** Savage Attacker, Alert, Magic Initiate (Cleric / Wizard / Druid variants), Tough, Skilled, Crafter, Lucky, Healer, Musician, Tavern Brawler.
- **Fighting Style (6):** Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting.
- **General (6):** Great Weapon Master, Sharpshooter, Polearm Master, War Caster, Resilient (Constitution variant), Unarmored Defense (Barbarian).
- **Epic Boon (9):** Combat Prowess, Dimensional Travel, Energy Resistance, Fortitude, Irresistible Offense, Skill, Spell Recall, the Night Spirit, Truesight.

PHB 2024 ships ~30 general feats and ~25 origin feats; this pack carries the most common. The other ~20+ general feats (Ability Score Improvement, Athlete, Charger, Crusher, Defensive Duelist, Fey Touched, Heavily Armored, Inspiring Leader, Keen Mind, Magic Initiate as a general feat, Mage Slayer, Mounted Combatant, Observant, Piercer, Poisoner, Sentinel, Shadow Touched, Shield Master, Skill Expert, Skulker, Slasher, Speedy, Tavern Brawler upgrade tier, Telekinetic, Telepathic, Weapon Master) and the remaining origin feats are deferred.

## Conditions

All 15 RAW conditions ship (Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious). Ten engine-mechanic conditions also ship to back rider effects (e.g. `sapped`, `vexed-by`, `slowed-10ft` for weapon masteries; `blessed`, `mage-armored`, `guided`, `concentrating` for spell mechanics). Complete.

## Future engine slices (what unblocks the deferred spells)

Each entry below is one engine primitive: a focused engine slice that, once landed, retro-wires a cohort of spells currently shipping schema-only. Ranked roughly by spell-count payoff. When a slice lands, mark it `✓ shipped (slice N)` and walk the affected spells from schema-only to wired in the per-level breakdowns above.

| Primitive | Spells unblocked | Notes |
|---|---|---|
| **~~Summon system~~** ✓ shipped | 11 wired (find-familiar, unseen-servant, find-steed, summon-beast, animate-dead, conjure-animals, phantom-steed, summon-fey, summon-lesser-demons, summon-shadowspawn, summon-undead) | `CompanionSummoned` / `CompanionDismissed` events, `summon` SpellMechanic with inline statblock, slot-level HP scaling, concentration auto-dismiss via `clearConcentrationEffect`. Companions are stored as `kind: 'creature'` Characters with a `summonSource` pointer to controller / spell / slot / effect. |
| **Area-effect spell mechanic** | ~13 (entangle, grease, cloud-of-daggers, darkness, dust-devil, flaming-sphere, silence, spike-growth, zone-of-truth, hunger-of-hadar, leomunds-tiny-hut, plant-growth, slow, stinking-cloud, wind-wall) | Persistent zone with on-enter / on-start-of-turn save handlers; couples with recurring-rider primitive for damage-per-turn variants. |
| **On-hit trigger system** | ~9 (divine-favor, ensnaring-strike, hail-of-thorns, hex, searing-smite, thunderous-smite, wrathful-smite, branding-smite, blinding-smite, crusaders-mantle, lightning-arrow, ray-of-enfeeblement) | Effect rider that fires on caster's next weapon attack; unblocks all smite-pattern spells. Foundation already in place via Sneak Attack rider. |
| **Composite-buff condition** | ~5 (haste, beacon-of-hope, blur, mirror-image, magic-weapon, pass-without-trace) | Single named condition that imposes multiple distinct modifiers (e.g. Haste = extra action + speed + AC + DEX-save adv). |
| **Caster-chosen options at cast time** | ~7 (chromatic-orb, command, calm-emotions, enhance-ability, enlarge-reduce, bestow-curse, elemental-weapon, spirit-shroud) | Pending-choice protocol on cast: caster picks variant; resolution reads the choice and applies the matching effect. |
| **Reaction system** | ~3 (absorb-elements, feather-fall, sanctuary), plus all future reaction spells | Cast as a reaction to a trigger event; needs `ReactionRegistered` event + a window on the appropriate `apply` calls. |
| **Movement-mode condition** | ~3 (fly, spider-climb, levitate) | Adds a movement type (fly / climb / hover) to derived speed; sits next to existing `derivedSpeed` work. |
| **Transformation handler** (spell variant) | ~2 (alter-self, gaseous-form) | Spell-side transformation; piggybacks on the existing `wildShape` / `polymorph` pattern but with spell-defined target shapes. |
| **AC-buff condition** | ~3 (shield-of-faith, barkskin, false-life partial) | Flat AC modifier tied to a condition; "set AC to N" variant for barkskin. |
| **Temp-HP grant primitive** | ~3 (false-life, heroism, plus aid's upcast variant) | Spell mechanic that writes to `hp.temp` and stacks per RAW (max, not additive). |
| **Recurring-rider primitive** | ~4 (heroism, hex damage, aura-of-vitality, phantasmal-force) | Effect that re-fires each round / turn while a condition is active. Couples with area-effect for "damage on start of turn in zone". |
| **Item-buff condition** | ~3 (magic-weapon, elemental-weapon, holy-weapon-eventually) | Tags an equipped weapon with +N to attack/damage + optional damage-type rider. |
| **Attack-roll-buff condition** | ~3 (blur, mirror-image, pass-without-trace) | Imposes advantage / disadvantage on attacks against or by the target. Mirror Image's duplicate-pool is a variant. |
| **Type-conditional buff / ward** | ~3 (protection-from-evil-and-good, magic-circle) | Effects whose application depends on the affected creature's type. |
| **Cursed condition** | ~2 (remove-curse, plus future bestow-curse variants) | Standard cursed condition + remove-condition counterpart. |
| **Resistance-buff condition** | 1 (protection-from-energy), plus future wired smites | Damage-type resistance tied to a condition. |
| **Trap mechanic** | ~2 (glyph-of-warding, cordon-of-arrows) | Placed delayed-effect that fires on trigger. |
| **Dedicated planner: Thunder Step** | 1 | Matches Misty Step's pattern but adds an area damage on the origin square. |
| **Resurrection / death utility** | 1 (revivify) | Engine model for "creature was dead → now alive at N HP". |
| **Scrying / divination utility** | 1 (clairvoyance) | Remote sensor primitive. |
| **Illusion-interaction primitive** | ~2 (major-image, silent-image extended) | INT save on interaction + recurring belief check. |
| **Push / aerial-restraint primitives** | ~2 (gust-of-wind, earthbind) | Forced movement on save + ground tether. |

Picking from this list, top three by spell-count payoff: summon system (11+), area-effect mechanic (~13), on-hit trigger (~9). The other primitives each unblock smaller cohorts; bundle them together by primitive when their turn comes.

## How this list is maintained

At the close of each content slice, update the relevant section here and bump the "Coverage at a glance" counts. If the slice introduces a new mechanic kind (e.g. a future reaction-spell primitive), retro-update the affected schema-only spells to either `wired` or move them to a different deferred bucket. When an engine slice from the "Future engine slices" table ships, mark it as done and walk the affected spells in this doc to their new status.
