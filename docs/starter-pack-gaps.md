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
| fighter | 1, 2, 5, 9, 11, 13, 17, 20 | 12 (ASI / subclass-only levels) |
| monk | 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 15, 17, 18, 20 | 5 (ASI / subclass-only levels) |
| paladin | 1, 2, 3, 5, 6, 9, 10, 11, 14, 18 | 10 (ASI / subclass-only levels) |
| ranger | 1, 2, 5 | 17 |
| rogue | 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 | 10 (Sneak Attack scales at every odd level) |
| sorcerer | 1, 2, 5, 10, 15, 17, 20 | 13 (ASI / subclass-only / un-named levels) |
| warlock | 1, 2, 3, 5, 7, 9, 11, 12, 13, 15, 17, 18, 20 | 7 (ASI / subclass-only levels) |
| wizard | 1, 2, 5, 18, 20 | 15 (ASI / subclass-only / un-named levels) |

Notable missing scaling: Wild Shape forms (the available CR / size / movement-mode beast list), Stunning Strike DC scaling, Martial Arts die (content-layer flags ship at L5 / L11 / L17 but stay as stubs — the engine's Custom martial-arts handler doesn't yet consult the level to compute the die), Sneak Attack damage (the only scaling-by-level feature that *does* currently land at the content layer). Rage use-count tiers (L3 / L6 / L12 / L17) wire after slice 49 via `GrantResource` overrides, the same pattern Channel Divinity uses; Rage damage bonus (L9 / L16) and Rage resistance / advantage still need engine work. Bardic Inspiration die scaling (L5 d8 / L10 d10 / L15 d12) wires after slice 50 via the `diceSize` field on `GrantResource`; the use-count formula is still hardcoded at 3 instead of CHA-mod-with-floor-1. Channel Divinity uses now scale fully across L1 / L6 / L18 (1 / 2 / 3 uses per rest) after slice 51. Wild Shape use-count tiers (L5 / L9 / L13 / L17) wire after slice 52 via the same pattern, hardcoding the PB-based progression instead of reading the actor's proficiency bonus.

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

### Sorcerer stub features (effects: [], waiting on engine work)

Slice 53 filled L10, L15, L17, L20 (plus an addition at L5). Wired entries bump the Sorcery Points max via `GrantResource` overrides at the milestone levels (L5 → 5, L10 → 10, L15 → 15, L17 → 17, L20 → 20). Non-milestone levels (L3 / L4 / L6 / L7 / L8 / L9 / L11 / L12 / L13 / L14 / L16 / L18 / L19) keep whichever max the last preceding milestone set, which under-counts the player's actual SP by 1 or 2 at most. The cleaner long-term fix is a `Formula` max on the L2 entry that reads the actor's sorcerer level; that's an L1-side edit deferred for now to keep this slice focused on filling empty rows. Stubs:

- `metamagic-known-3` (L10) and `metamagic-known-4` (L17) — increase the count of Metamagic options the sorcerer knows. The L2 Metamagic entry ships as `Custom { handlerId: 'metamagic' }`; no handler is registered, and the "known options" count isn't a real engine concept (players track their own list). These tier entries note the level the count changes; full wiring needs Metamagic as a first-class concept with a per-option enum.
- `arcane-apotheosis` (L20) — 2024 capstone: while Innate Sorcery is active, spending a Sorcery Point to use Metamagic on a spell costs zero points instead. Needs Innate Sorcery to be an actual condition the engine recognizes and a Metamagic-cost-zeroing override.

Observation: `innate-sorcery` is currently a 2-use long-rest resource at L1 with no scaling. PHB 2024 keeps it at 2/long-rest through L20, so no tier ladder is required there.

### Warlock stub features (effects: [], waiting on engine work)

Slice 54 filled every Warlock level that has a PHB 2024 feature (L1, L2, L3, L5, L7, L9, L11, L12, L13, L15, L17, L18, L20). All entries ship `effects: []` because the Warlock's defining mechanics map poorly to the current effect vocabulary:

- `eldritch-invocations-N` (L1 / L2 / L5 / L7 / L9 / L12 / L15 / L18) — the "known count" of invocations rises across eight tiers, but invocations themselves are a content catalog the pack doesn't ship. Each tier is a stub flag for now; full wiring needs (a) every PHB 2024 invocation as a Feat-like content row with its own `effects[]`, and (b) an `OfferChoice` at each tier that lets the player pick from the catalog. The L2 entry doubles as Magical Cunning's home (1/long-rest action that regains all expended Pact Magic slots after 1-minute meditation) — needs a "regain spell slots of a specific casting type" trigger action the engine doesn't expose.
- `pact-boon` (L3) — choice between Pact of the Blade (summon a bound weapon), Chain (find familiar at-will + special familiar list), Tome (extra cantrips + ritual book), Talisman (proficiency-bonus die to ally checks). Each pact is itself a multi-effect bundle; needs a top-level `OfferChoice` whose options carry sub-effect arrays the engine already understands (`GrantSpell` at-will, summon-system reuse for Chain, `GrantProficiency` for Tome cantrips).
- `mystic-arcanum-6/7/8/9` (L11 / L13 / L15 / L17) — one chosen Warlock spell of the given level, castable once per long rest without expending a Pact slot. Shape fits `OfferChoice + GrantSpell { preparation: 'oncePerLongRest' }` but the Warlock spell list isn't curated for the choice yet; stub until the spell catalog grows enough at L6+ to make the pick meaningful (the pack currently ships 0 spells at L6-9).
- `eldritch-master` (L20) — 1/long-rest action to regain all Pact Magic slots. Same shape as Magical Cunning's regain mechanic; same missing primitive.

Pre-existing gap closed by this slice: Warlock now ships `skillChoices` (choose 2 from Arcana, Deception, History, Intimidation, Investigation, Nature, Religion) and `subclassLevel: 3`, matching the shape every other class uses. Previously the entry shipped neither, which would have prevented a character creator from offering the Warlock's L1 skill picks or the Patron choice at L3.

### Wizard stub features (effects: [], waiting on engine work)

Slice 55 filled L2, L5, L18, L20 plus an L1 addition. The L2 entry (`scholar`) wires as the slice's only new fully-mechanical feature: an `OfferChoice` over the six academic skills (Arcana / History / Investigation / Medicine / Nature / Religion) with `oneOf: 2`, granting proficiency in the chosen pair. This is the first feature in the class-features fill-out that uses player-pick `OfferChoice` for proficiency (Bard's Expertise at L3 / L9 still hardcodes its picks; converting both is a separate small slice). Stubs:

- `ritual-adept` (L1) — cast any ritual spell prepared in the spellbook without expending a slot. Needs a "treat spell cast as ritual variant" path the engine doesn't expose at cast time.
- `memorize-spell` (L5) — once per turn, after a long rest, replace one prepared spell with another from the spellbook. Needs a per-turn one-shot edit to the prepared-list that the engine's level-up / long-rest events don't trigger.
- `spell-mastery` (L18) — pick one L1 and one L2 spell from the spellbook; cast them at their lowest level without a slot. Fits `OfferChoice` over the wizard's spellbook plus a "cast this spell with cost 0 once per arbitrary use" rule the engine doesn't model.
- `signature-spells` (L20) — pick two L3 spells; cast each 1/short rest with no slot. Same shape as Spell Mastery plus a short-rest cooldown.

Pre-existing gap closed by this slice: Wizard now ships `skillChoices` (choose 2 from Arcana, History, Investigation, Medicine, Nature, Religion) and `subclassLevel: 3`, matching every other class. The pack previously had no skill picks for wizards, which would have prevented a character creator from offering them.

### Fighter stub features (effects: [], waiting on engine work)

Slice 56 filled L9, L11, L13, L17, L20 plus an L5 addition. Six wired entries cover the major Fighter scaling: Indomitable use-count tiers (L9 / L13 / L20 = 1 / 2 / 3 per long rest via `GrantResource` overrides), the Action Surge tier bump at L17 (1 → 2 per short rest, same shape Cleric uses for Channel Divinity), and the Extra Attack tier bumps at L11 (count: +1 on top of L5) and L20 (another +1). The Extra Attack tier entries assume the engine sums `ModifyActionEconomy.extraAttack.count` across sources rather than overriding; if it overrides, the tier behavior would need a different shape (a single feature whose count grows by level, not three separate +1 entries). Stubs:

- `tactical-mind` (L5) — when failing an ability check, spend a Second Wind use to add 1d10 to the check. Needs a "spend resource to reroll" trigger that fires on check-failure events.
- `tactical-shift` (L9) — when using Second Wind, also move up to half your Speed without provoking opportunity attacks. Needs the same Second Wind-as-trigger hook plus a one-shot movement-grant primitive (the same gap Druid's Instinctive Pounce names).
- `tactical-master` (L11) — apply a chosen Weapon Mastery property (Push, Sap, or Slow) on a weapon attack regardless of the weapon's mastery. Needs `planWeaponMastery` to accept an "override mastery for this attack" parameter; the existing planner reads the equipped weapon's mastery, not a per-attack choice.
- `studied-attacks` (L13) — on missing a weapon attack, gain advantage on the next attack against the same target before the end of your next turn. Needs a per-target "studied" condition + an on-miss trigger; the on-hit trigger system is on the deferred-engine-slices list, this is its on-miss counterpart.

Action Surge tier-up at L17 uses the same `GrantResource max:2 shortRest` shape as the L2 entry; the engine has been treating Action Surge as a real resource since its initial wiring, so this scales cleanly. Indomitable at L9 introduces the resource and L13 / L20 raise its max — same Channel Divinity / Rage / Wild Shape / Sorcery Points pattern (fifth class to follow that ladder).

### Monk stub features (effects: [], waiting on engine work)

Slice 57 filled L2 (addition), L3, L5 (addition), L6, L7 (addition), L9, L10, L11, L13, L15, L17, L18, L20. Four wired entries bump the Ki max via `GrantResource` overrides at milestones (L5 → 5, L10 → 10, L15 → 15, L20 → 20). Non-milestone levels keep the L2 hardcoded max of 2, undercounting by 1-4 vs the RAW "Ki = monk level" formula; the cleaner fix is a `Formula` max on the L2 entry that reads monk level (the wizard's Arcane Recovery uses this shape), deferred to keep the slice scoped. Stubs:

- `uncanny-metabolism` (L2) — on initiative, regain Hit Points (martial-arts-die-roll + monk level) and regain all expended Ki points, once per long rest. Needs an on-initiative trigger hook plus a heal-by-formula primitive.
- `deflect-attacks` (L3) — reaction to reduce damage from an attack, then redirect martial-arts-die + DEX + monk-level damage back at the attacker. Needs the reaction system plus a "reduce-then-counter" sequencing the engine doesn't model.
- `martial-arts-die-d8` (L5), `martial-arts-die-d10` (L11), `martial-arts-die-d12` (L17) — the Custom martial-arts handler at L1 doesn't yet consult monk level to pick the die size. These tier-flags ship so the content surface acknowledges the scaling; the handler-side fix is a single line once someone wires it.
- `empowered-strikes` (L6) — unarmed strikes count as magical and can deal force damage. Needs a "damage-type override on unarmed strike" content rider; the closest existing primitive is the on-hit damage rider used for Sneak Attack but it doesn't replace the base damage type.
- `heightened-mobility` (L7) — Patient Defense and Step of the Wind cost zero Ki on the first use per turn. Needs a "free first cost per turn" tracker on specific Ki-using actions.
- `acrobatic-movement` (L9) — move along walls or liquids on your turn without falling; advantage on STR (Athletics) checks. Needs a `MovementMode` extension plus a conditional advantage on a check.
- `deflect-energy` (L13) — extend Deflect Attacks to also reduce damage from a damage type the attack deals. Same reaction hook as Deflect Attacks.
- `perfect-focus` (L15) — when rolling initiative, if you have fewer than 4 Ki points, regain expended Ki up to a total of 4. Same on-initiative trigger as Uncanny Metabolism plus a conditional ceiling.
- `empty-body` (L18) — spend 4 Ki to become Invisible and gain Resistance to all damage types except Force for 1 minute, no Concentration. Needs the Invisibility condition wired plus a multi-damage-type-resistance buff. Some of those conditions ship; bundling them into a single feature is a stub.
- `body-and-mind` (L20) — DEX and WIS scores increase by 4, max 25 for those. Same shape as Barbarian's Primal Champion stub; needs an ability-score-modification effect with a max-override.

Stunning Strike DC scaling (8 + prof + WIS) is still the engine's responsibility; the L5 stunning-strike entry is `Custom { handlerId: 'stunning-strike' }` and the handler is presumed to read the actor's stats.

### Paladin stub features (effects: [], waiting on engine work)

Slice 58 filled L5, L6, L9, L10, L11, L14, L18. One wired entry: Extra Attack at L5 (same `ModifyActionEconomy.extraAttack count: 1` shape Fighter / Ranger / Barbarian / Monk use). Seven stubs cover the aura cohort plus the Smite-adjacent and Channel Divinity options:

- `faithful-steed` (L5) — cast Find Steed without expending a spell slot, once per long rest. Shape fits `GrantSpell { preparation: 'oncePerLongRest' }` once Find Steed is wired (it ships as a summon spell after slice 48); the wire is short-circuited because the existing Find Steed entry assumes a 2nd-level slot is consumed and there's no "free cast" flag on the spell mechanic yet.
- `aura-of-protection` (L6), `aura-of-courage` (L10), `aura-improvements` (L18) — friendly creatures within 10ft (30ft at L18) gain CHA-mod to saves (Aura of Protection) and immunity to Frightened (Aura of Courage). Needs an aura primitive: a persistent effect on the paladin whose radius and on-enter / on-leave hooks gate sub-effects on allies. The closest existing surface is concentration-style effect instances, but no "radius + ally-check" wrapper ships.
- `abjure-foes` (L9) — Channel Divinity option that frightens creatures within 60ft on a failed WIS save and prevents them from approaching. Same per-CD-option dispatch primitive Cleric's Divine Spark and Sear Undead are blocked on.
- `radiant-strike` (L11) — on a weapon attack hit, deal +1d8 radiant damage. Fits the on-hit trigger system named in the deferred-engine-slices table; once that ships, this and the smite cohort (Branding Smite, Searing Smite, Divine Favor, etc) wire together.
- `restoring-touch` (L14) — when using Lay on Hands, also cure one disease or condition (Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, Stunned) by spending an additional 5 HP from the pool. Needs Lay on Hands to be planner-modeled rather than purely a resource grant; the resource ships but no `planLayOnHands` exists yet.

Pre-existing gap closed by this slice: Paladin now ships `skillChoices` (choose 2 from Athletics, Insight, Intimidation, Medicine, Persuasion, Religion) and `subclassLevel: 3`, matching every other class. The pack previously had neither.

Open item: Divine Smite is L2 in PHB 2024 (the paladin can deal +2d8 radiant damage by spending a 1st-level spell slot on a weapon hit, scaling +1d8 per slot level up to 5d8). Not yet in the L2 features. Wireable as a planner (`planDivineSmite` consuming a slot and emitting damage) once the on-hit trigger pathway lands, similar to how the smite-pattern spells will land. Deferred to keep this slice's scope tight; flagged here for the next paladin-touch.

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
