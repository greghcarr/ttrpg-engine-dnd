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
| Spells | 399 / 399 | ~399 | 34 / 60 / 63 / 54 / 40 / 46 / 38 / 24 / 19 / 21 across L0–L9. **Every PHB 2024 spell now ships in the pack.** ~130 wired with `mechanicalEffects` (~18 cantrips, ~26 L1, ~20 L2, ~17 L3, ~12 L4, ~13 L5, ~10 L6, ~5 L7, ~6 L8, ~3 L9) + 7 dedicated planners (counterspell, dispel-magic, identify, misty-step, shield, hunters-mark, polymorph). The remaining ~270 ship schema-only, each blocked on a named engine primitive captured in the per-level sections below. |
| Items | 77 total | hundreds (DMG) | 53 weapons + armor + shields + tools + mundane gear + 9 magic items. Bulk DMG magic items deferred. |
| Monsters | 6 / hundreds | ~370 (MM) | Goblin, Orc, Wolf, Skeleton, Ogre, Young Red Dragon. CR 1/2 and most of MM deferred. |
| Conditions | 25 / 15 | 15 (RAW) | All 15 RAW conditions plus 10 mechanic-rider conditions used by the engine. |

## Spells

Status legend: `wired` = has `mechanicalEffects` array entries that the engine consumes. `planner` = handled by a dedicated planner (`planShield`, `planCounterspell`, `planDispelMagic`, `planIdentify`, `planMistyStep`, `planPolymorph`, `planHuntersMark`); `mechanicalEffects` stays empty by design. `schema-only` = ships in the pack so the schema validator + consumer code sees the spell, but no mechanical event is emitted on cast.

### Cantrips (L0): 34 / 34

**Wired (18):** acid-splash, chill-touch, eldritch-blast, fire-bolt, frostbite, guidance, mind-sliver, poison-spray, produce-flame, ray-of-frost, sacred-flame, shocking-grasp, starry-wisp, thorn-whip, thunderclap, toll-the-dead, vicious-mockery, word-of-radiance.

**Schema-only (16):** blade-ward, dancing-lights, druidcraft, friends, light, mage-hand, mending, message, minor-illusion, mold-earth, prestidigitation, resistance, shillelagh, spare-the-dying, thaumaturgy, true-strike. All intentionally narrative / utility — no mechanical event to emit.

### L1: 60 / 60 (full PHB list)

**Wired (26):** bane, bless, burning-hands, cause-fear, charm-person, color-spray, cure-wounds, divine-favor (on-hit rider), dissonant-whispers, earth-tremor, faerie-fire, find-familiar (summon), guiding-bolt, healing-word, hellish-rebuke, inflict-wounds, mage-armor, magic-missile, ray-of-sickness, searing-smite (on-hit rider, one-shot), sleep, tashas-hideous-laughter, thunderous-smite (on-hit rider, one-shot), thunderwave, unseen-servant (summon), wrathful-smite (on-hit rider, one-shot).

**Dedicated planner (3):** hunters-mark, identify, shield.

**Schema-only (35):** grouped by the engine primitive each one needs.

- **On-hit trigger system** (rider that fires on the caster's next weapon attack): `ensnaring-smite`, `hail-of-thorns`, `hex`. The smite-pattern cohort that still needs primitives beyond simple damage rider (target-side condition lookup for hex, save-or-restrain rider for ensnaring strike, AoE-on-hit for hail of thorns). The simple damage riders (Divine Favor, Searing / Wrathful / Thunderous Smite) wired in slice 61.
- **Reaction system** (cast as a reaction to a trigger event): `absorb-elements`, `feather-fall`, `sanctuary`. Also future Silvery Barbs and a Shield-as-spell variant.
- **Area-effect spell mechanic** (zone with save on enter + ongoing condition / damage): `entangle`, `grease`. Also future Cloudkill, Wall of Fire.
- **Temp-HP grant as a spell mechanic** (current `heal` writes to `current` only): `false-life`, `heroism`.
- **Caster-chosen options at cast time** (damage type or spell variant): `chromatic-orb`, `command` (per-word effects).
- **AC-buff condition** (flat AC bonus tied to a condition): `shield-of-faith`.
- **Type-conditional buff** (advantage / disadvantage keyed to creature type): `protection-from-evil-and-good`.
- **Pure narrative / utility** (intentionally no mechanical event): `alarm`, `animal-friendship`, `comprehend-languages`, `compelled-duel`, `create-or-destroy-water`, `detect-evil-and-good`, `detect-magic`, `detect-poison-and-disease`, `disguise-self`, `expeditious-retreat`, `fog-cloud`, `goodberry`, `jump`, `longstrider`, `purify-food-and-drink`, `silent-image`, `speak-with-animals`. Rituals, illusions, sensory spells; they parse and load, they just don't emit anything.

### L2: 63 / 63 (full PHB list)

**Wired (20):** aid, blindness-deafness, branding-smite (on-hit rider, one-shot), crown-of-madness, find-steed (summon), flame-blade, heat-metal, hold-person, invisibility, lesser-restoration, melfs-acid-arrow, moonbeam, prayer-of-healing, protection-from-poison, scorching-ray, shatter, spiritual-weapon, suggestion, summon-beast (summon), web.

**Dedicated planner (1):** misty-step.

**Schema-only (43):** grouped by the engine primitive each one needs.

- (none remaining at L2 — `branding-smite` wired in slice 61 as a one-shot on-hit rider, same shape as the L1 smite cohort).
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

**Wired (17):** animate-dead (summon), call-lightning, conjure-animals (summon), crusaders-mantle (aura buff), fear, fireball, hypnotic-pattern, lightning-bolt, mass-healing-word, phantom-steed (summon), sleet-storm, spirit-guardians, summon-fey (summon), summon-lesser-demons (summon), summon-shadowspawn (summon), summon-undead (summon), vampiric-touch.

**Dedicated planner (2):** counterspell, dispel-magic.

**Schema-only (36):** grouped by the engine primitive each one needs.

- **Area-effect spell mechanic** (zone with save on enter, ongoing damage, or movement penalty): `hunger-of-hadar`, `leomunds-tiny-hut`, `plant-growth`, `slow`, `stinking-cloud`, `wind-wall`. Several couple area with a recurring-rider primitive (Hunger, Stinking Cloud).
- **On-hit trigger system** (rider that fires on a weapon attack): `blinding-smite`, `lightning-arrow`. (Crusader's Mantle wired in slice 63 as an aura that applies the rider to multiple targets via the buff mechanic.)
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

### L4: 40 / 40 (full PHB list)

**Wired (12):** blight, charm-monster, conjure-minor-elementals (summon), conjure-woodland-beings (summon), freedom-of-movement, greater-invisibility, ice-storm, phantasmal-killer, summon-aberration (summon), summon-construct (summon), summon-elemental (summon), summon-greater-demon (summon).

**Dedicated planner (1):** polymorph.

**Schema-only (27):** grouped by the engine primitive each one needs.

- **Area-effect spell mechanic**: `black-tentacles`, `wall-of-fire`, `guardian-of-faith`, `private-sanctum`, `compulsion`. Five area shapes / variants of the same deferred primitive.
- **Sensor / scrying primitive**: `arcane-eye`, `locate-creature`. Remote viewing surfaces.
- **Aura primitive (sub-effects beyond simple condition projection)**: `aura-of-life` (sub-HP-floor mechanic + auto-revive at 0 HP), `aura-of-purity` (multi-effect resistance + condition immunities).
- **Cross-plane travel / banishment**: `banishment` (CHA save → other plane; return on concentration end).
- **Multi-target movement-restriction**: `resilient-sphere`, `watery-sphere`. Force-cage variants needing per-target restraint with sphere-shaped lifetime.
- **Terrain / shaping utilities**: `control-water`, `hallucinatory-terrain`, `stone-shape`, `fabricate`. Terrain primitive not modeled.
- **Targeted teleport (planner)**: `dimension-door` — same shape as Misty Step but multi-target; a `planDimensionDoor` is the obvious follow-up.
- **DM-resolution ritual**: `divination`.
- **Action-table riser**: `confusion` — failed save makes target take random actions per turn; no "confused" condition / action-table mechanic.
- **Domination semantics**: `dominate-beast` — distinct from Charmed (full control); not modeled.
- **Caster-chosen damage type + on-attack output**: `elemental-bane`.
- **Alarm + delayed-attack pattern**: `faithful-hound`.
- **AddDamageToAttacker TriggerAction**: `fire-shield` — retaliation damage when caster is hit; the existing `AddDamage` TriggerAction emits damage to `event.targetId` not `event.attackerId`.
- **Transformation handler for non-self targets**: `giant-insect`.
- **On-fatal-damage trigger primitive**: `death-ward`.
- **Resistance qualifier (magical-vs-nonmagical)**: `stoneskin` — half damage from nonmagical B/P/S only.
- **Extradimensional storage**: `secret-chest`.

### L5: 46 / ~46 (full PHB list)

**Wired (13):** cloudkill, cone-of-cold, conjure-elemental (summon), contagion, dominate-person, greater-restoration (remove-condition: charmed / petrified / paralyzed / stunned / poisoned / blinded / deafened), hold-monster, holy-weapon (concentration buff with +2d8 radiant OnEvent rider on weapon hits), insect-plague, mass-cure-wounds, summon-celestial (summon), summon-draconic-spirit (summon), synaptic-static.

**Schema-only (33):** grouped by the engine primitive each one needs.

- **Area-effect spell mechanic** (often with multi-damage-type or terrain interplay): `flame-strike` (fire + radiant), `destructive-wave` (thunder + radiant or necrotic + condition), `wall-of-force`, `wall-of-light`, `wall-of-stone`, `passwall`, `hallow`.
- **Sensor / scrying primitive**: `scrying`.
- **DM-resolution rituals**: `commune`, `commune-with-nature`, `contact-other-plane`, `legend-lore`, `dream`, `modify-memory`.
- **Long-duration compulsion**: `geas` (30-day forced compulsion with recurring psychic damage on disobedience).
- **Resurrection / death-reversal**: `raise-dead`, `reincarnate`.
- **Illusion primitive**: `mislead`, `seeming`.
- **Terrain primitive**: `creation`, `passwall` (also area), `wall-of-stone` (also area).
- **Multi-target weapon planner**: `steel-wind-strike` (teleport to 5 targets, melee strike each).
- **On-action attack rider**: `swift-quiver` (bonus-action extra ammo attacks).
- **Cross-plane summon**: `planar-binding`.
- **Teleport-network primitive**: `teleportation-circle`, `tree-stride`, `far-step` (recurring per-bonus-action teleport).
- **Sapience-grant primitive**: `awaken`.
- **Controllable spell-construct (action menu)**: `bigbys-hand`, `animate-objects`.
- **Multi-mode buff**: `dispel-evil-and-good`, `circle-of-power` (conditional aura sub-effect).
- **Forced movement (contested)**: `telekinesis`.
- **Domination semantics distinct from charmed**: `rarys-telepathic-bond` (utility, narrative only).

### L6: 38 / ~38 (full PHB list)

**Wired (10):** chain-lightning, circle-of-death, disintegrate, eyebite (WIS save → frightened, approximation of the 4-keyword sub-options), flesh-to-stone (CON save → restrained, approximating the petrification stages), harm, heal (flat 70 HP), mass-suggestion, summon-fiend (summon), sunbeam.

**Schema-only (28):** the heavy clusters at L6 — transformations (`investiture-of-flame` / `ice` / `stone` / `wind`, `tashas-otherworldly-guise`, `tensers-transformation`, `wind-walk`), wards (`forbiddance`, `globe-of-invulnerability`, `guards-and-wards`), terrain walls (`blade-barrier`, `wall-of-ice`, `wall-of-thorns`), and ritual / DM-resolution (`contingency`, `find-the-path`, `magic-jar`, `move-earth`, `planar-ally`, `programmed-illusion`, `soul-cage`, `true-seeing`, `drawmijs-instant-summons`, `arcane-gate`, `create-undead`, `conjure-fey`, `ottos-irresistible-dance`, `word-of-recall`, `heroes-feast`). Each is one of the existing deferred primitives (area-wall, transformation handler, multi-effect ritual buff, etc.) the gaps table above already names.

### L7: 24 / ~24 (full PHB list)

**Wired (5):** conjure-celestial (summon), delayed-blast-fireball, finger-of-death, fire-storm, regenerate.

**Schema-only (19):** mostly long-range / cross-plane / illusion / utility — crown-of-stars (on-action rider), divine-word / power-word-pain (HP-threshold tier effect), dream-of-the-blue-veil / etherealness / plane-shift / teleport (cross-plane / long-range teleport), forcecage / whirlwind (area-confinement), mirage-arcane / project-image (illusion), mordenkainens-magnificent-mansion / sequester (extradimensional / time-pause), mordenkainens-sword (controllable construct), prismatic-spray (random-damage-table AoE), resurrection (full-resurrection primitive), reverse-gravity (physics primitive), simulacrum (dedicated planner exists), symbol (trap mechanic).

### L8: 19 / ~19 (full PHB list)

**Wired (6):** dominate-monster, feeblemind (INT save → stunned + 4d6 psychic, approximating the int/cha-score reduction), incendiary-cloud, maddening-darkness, sunburst, tsunami.

**Schema-only (13):** the big-shape transformations and rituals — antimagic-field (magic suppression), antipathy-sympathy (type-conditional buff), clone (resurrection-on-death), demiplane / maze (extradimensional / single-target plane shift), control-weather (environment primitive), earthquake (multi-stage terrain area), holy-aura (multi-effect aura), mind-blank (multi-type immunity), power-word-stun (HP-threshold tier effect), animal-shapes (mass transformation), glibness / telepathy (narrative).

### L9: 21 / ~21 (full PHB list)

**Wired (3):** mass-heal (flat 70 HP — RAW is a 700-HP pool but the existing heal mechanic doesn't carry a pool; approximation per target), psychic-scream (INT save with 14d6 psychic + stunned on fail), weird (WIS save with 4d10 psychic area + frightened on fail).

**Schema-only (18):** the legendary effects — astral-projection / gate (cross-plane), foresight (multi-effect buff), imprisonment (6-variant utility), invulnerability (total damage immunity), mass-polymorph (multi-target transformation), meteor-swarm (multi-AoE multi-damage), power-word-heal (full heal + multi-condition remove), power-word-kill (HP-threshold), prismatic-wall (multi-layer wall), ravenous-void (forced-movement AoE), shapechange (transformation handler), storm-of-vengeance (multi-stage area), time-ravage (multi-effect single-target), time-stop (turn-economy), true-polymorph + true-resurrection + wish (each with a dedicated planner already shipped: polymorph, future resurrection, wish).

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
| paladin | 1, 2, 3, 5, 6, 9, 10, 11, 14, 18 | 10 (ASI / subclass-only levels; both auras fully wired after slice 64; L18 range bump to 30ft via slice 65) |
| ranger | 1, 2, 5, 6, 9, 10, 13, 17, 18, 20 | 10 (ASI / subclass-only levels) |
| rogue | 1, 2, 3, 5, 6, 7, 9, 11, 13, 14, 15, 17, 18, 19, 20 | 5 (ASI / subclass-only levels) |
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
- `improved-blessed-strikes` (L17) — boosts Divine Strike to +2d8. Same `OnEvent` rider shape as the L7 entry but with bigger dice; honest die-scaling needs either replace-by-id semantics on level-up (so L17's OnEvent overrides L7's) or a level-conditional dice expression. Deferred until the broader die-scaling concern (Sneak Attack is the only feature that scales properly today) lands.
- `divine-intervention` (L10) and `improved-divine-intervention` (L20) — 1/week (1/long-rest at L20) prayer for a divine effect. Needs a flag for "intervention used in last 7 days" plus a freeform DM-resolution event; closest existing surface is `CustomEffect`, but no handler ships.

`blessed-strikes` at L7 is **wired (partially)** after slice 62: the `OnEvent` rider that fires +1d8 radiant on weapon hits (once per turn) is fully wired via the on-hit trigger primitive shipped in slice 61. The L7 entry is an `OfferChoice` between Divine Strike (the wired branch) and Potent Spellcasting (a stub branch — adds caster's WIS modifier to cantrip damage, needs a `TriggerAction.AddAbilityModDamage` that the engine doesn't model).

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
- `abjure-foes` (L9) — Channel Divinity option that frightens creatures within 60ft on a failed WIS save and prevents them from approaching. Same per-CD-option dispatch primitive Cleric's Divine Spark and Sear Undead are blocked on.
- `radiant-strike` (L11) — on a weapon attack hit, deal +1d8 radiant damage. Fits the on-hit trigger system named in the deferred-engine-slices table; once that ships, this and the smite cohort (Branding Smite, Searing Smite, Divine Favor, etc) wire together.
- `restoring-touch` (L14) — when using Lay on Hands, also cure one disease or condition (Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, Stunned) by spending an additional 5 HP from the pool. Needs Lay on Hands to be planner-modeled rather than purely a resource grant; the resource ships but no `planLayOnHands` exists yet.

Pre-existing gap closed by this slice: Paladin now ships `skillChoices` (choose 2 from Athletics, Insight, Intimidation, Medicine, Persuasion, Religion) and `subclassLevel: 3`, matching every other class. The pack previously had neither.

Open item: Divine Smite is L2 in PHB 2024 (the paladin can deal +2d8 radiant damage by spending a 1st-level spell slot on a weapon hit, scaling +1d8 per slot level up to 5d8). Not yet in the L2 features. Wireable as a planner (`planDivineSmite` consuming a slot and emitting damage) once the on-hit trigger pathway lands, similar to how the smite-pattern spells will land. Deferred to keep this slice's scope tight; flagged here for the next paladin-touch.

### Ranger stub features (effects: [], waiting on engine work)

Slice 59 filled L5 (addition), L6, L9, L10, L13, L17, L18, L20. Six wired entries: Hunter's Mark use-count tiers at L5 / L9 / L13 / L17 (3 / 4 / 5 / 6 uses, matching the 2024 PB-uses-per-long-rest formula by hardcoding milestones), Roving at L6 (`ModifySpeed walk +5` — the climb/swim "equal to walking speed" portion of Roving is not yet expressed because the schema's `ModifySpeed` only adjusts the named mode, not "match another mode"), and Feral Senses at L18 (`GrantSense blindsight 30` — exact RAW shape for 2024). Stubs:

- `natures-veil` (L9) — bonus action: become Invisible until the start of your next turn, expending a Hunter's Mark use. Needs an action surface that consumes a resource and applies the Invisible condition for a duration; the Invisible condition ships and `SpendResource` is a `TriggerAction`, but they're not bundled into a single feature shape.
- `tireless` (L10) — gain temp HP when finishing a Short Rest (10 + WIS mod), and Hunter's Mark uses refresh on Short Rest. Needs a temp-HP grant primitive (the deferred temp-HP slice in the spell engine table covers this) plus a recharge-frequency-override on the existing `hunters-mark` resource.
- `relentless-hunter` (L13) — taking damage while concentrating on Hunter's Mark doesn't break concentration. Needs a per-spell concentration-immunity flag or a condition that the concentration-check planner consults.
- `foe-slayer` (L20) — once per turn, add WIS modifier to one weapon attack roll or damage roll against a creature marked by Hunter's Mark. Needs an on-attack-or-damage trigger filtered on the target's marked state.

The Roving climb/swim "equal to walking speed" pattern recurs across classes that gain climb / swim modes (some subclass features do the same). A `ModifySpeed mode: 'climb' op: 'matchWalk'` extension would wire several deferred features in one shot.

### Rogue stub features (effects: [], waiting on engine work)

Slice 60 filled L1 (three additions), L2, L3, L5, L6, L11, L14, L15, L18, L20. The L15 entry (Slippery Mind) wires cleanly via two `GrantProficiency` saves (WIS and CHA). The L1 Expertise (`expertise-rogue`) and L6 Expertise (`expertise-rogue-2`) both use `OfferChoice` with `oneOf: 2` over the full 11-skill rogue list, plus a Weapon Mastery grant (2 slots) at L1. Four wired entries plus eight stubs:

- `thieves-cant` (L1) — language proficiency for the rogue dialect. Could wire via `GrantProficiency { target: 'language', id: 'thieves-cant' }`, but the language isn't in the pack's language list yet; stub until the language ships.
- `cunning-action` (L2) — bonus action: Dash, Disengage, or Hide. Each sub-effect already has a planner (`planDash`, etc.); needs a top-level "grant an alternate bonus action with N options" surface plus the action-economy attribution.
- `steady-aim` (L3) — bonus action: grant yourself advantage on the next attack this turn, but your speed becomes 0 until end of turn. Needs a self-effect that lasts until end of turn plus a speed-0 condition.
- `cunning-strike` (L5) and `improved-cunning-strike` (L14) — when dealing Sneak Attack damage, forgo 1d6 (Improved: 2d6) to apply one of several effects (Poison, Trip, Withdraw, Daze, Knock Out, Obscure). Needs a "trade damage dice for a condition application" primitive that hooks into the Sneak Attack `OnEvent` already in place; the existing rider doesn't yet support an "exchange" mode.
- `reliable-talent` (L11) — treat any natural d20 roll of 9 or lower as 10 when making an ability check using a skill or tool you have proficiency in. Needs a per-roll floor that the check planner consults; closest existing surface is `GrantHalfProficiencyBonusFloor` but that adds to the total, not a die-floor.
- `devious-strikes` (L18) — upgrades Cunning Strike effects with three more options (Daze, Knock Out, Obscure). Same primitive gap as Cunning Strike.
- `stroke-of-luck` (L20) — once per short rest, turn a missed attack into a hit or a failed check into a 20. Needs a per-resolve override hook on attack and check events.

Sneak Attack damage scaling continues to be the only fully-modeled scaling-by-level class feature in the pack (each odd level rewrites the `AddDamage.dice` literal). All four wired entries this slice plus the existing odd-level Sneak Attack ladder make Rogue the highest-coverage class in the pack: 15 of 20 levels carry features after this slice.

Pre-existing gap closed: Rogue now ships `skillChoices` (choose 4 from Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, Stealth) and `subclassLevel: 3`, matching every other class.

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
| **~~Area-effect spell mechanic~~** ✓ shipped (partial) | 12 wired (stinking-cloud, wall-of-fire, wall-of-thorns, wall-of-ice, blade-barrier, entangle, grease, black-tentacles, flaming-sphere, cloud-of-daggers, hunger-of-hadar, spike-growth) | The `aura-damage` mechanic has been extended over four slices to cover most of the persistent-area-effect family (slice 68: optional damage + conditionOnFail; slice 69: 4 more spells; slice 70: optional saveAbility; slice 71: trigger tags for multi-component zones). Slice 72 adds a sibling `movement-damage` mechanic for damage-per-foot-moved (Spike Growth: 2d4 piercing per 5 ft) with a dedicated `engine.plan.tickMovementDamage({casterId, targetId, feetMoved})` planner. Distinct kind from aura-damage so the per-tick vs per-traversal semantics stay legible. Remaining deferred area-effect spells (plant-growth, slow, dust-devil, silence, zone-of-truth, darkness, wind-wall, leomunds-tiny-hut) need additional primitives: pure terrain marker (Plant Growth), area-of-pure-obscurement / silence zones, and the on-cast targeting-and-save-then-buff pattern (Slow). |
| **~~Aura primitive~~** ✓ shipped | 3 wired (paladin Aura of Protection L6, Aura of Courage L10, Crusader's Mantle L3 spell) | Slice 63 adds the `GrantAura` effect (auraId, rangeFeet, allyConditionId) as discoverable metadata: consumers (dndbnb / DMs / VTTs) read the bearer's `GrantAura` effects and apply / remove the `allyConditionId` on in-range allies via `ConditionApplied` / `ConditionRemoved`. The engine doesn't auto-project (position is consumer territory). Aura conditions wire cleanly via the existing condition system; Crusader's Mantle reuses the L3 spell `buff` mechanic with multi-target lists plus an `OnEvent` rider in the same shape as Divine Favor. |
| **~~Source-relative Formula extension~~** ✓ shipped | 1 wired (paladin Aura of Protection L6, +CHA-mod-of-source to ally saves) | Slice 64 adds the `sourceAbilityMod` Formula kind plus the threading needed to evaluate Formula values inside `AddModifier` effects. `EffectAccumulator` now folds Formula values into numeric modifiers when a `FormulaContext` is provided; `buildEffectStack` iterates applied conditions individually and passes the source character's ability scores when an `AppliedCondition.sourceCharacterId` link exists and the caller threaded a `characters` map through. Open derive surfaces that don't yet thread `characters`: AC, attack bonus, ability check, encumbrance, damage mitigation, spell DC, action economy. Adding `characters` to those input shapes is a small follow-up; saves work in the meantime, and saves are the only RAW use case for Aura of Protection. |
| **~~Condition-immunity gate (spell condition application)~~** ✓ shipped (partial) | Aura of Courage now actually blocks Frightened in the spell pipeline (the only path RAW-relevant for the feature). | Slice 66 adds `isImmuneToCondition(state, content, targetId, conditionId)` in `src/derive/condition-immunity.ts`. The spell planner's save (`conditionOnFail`) and buff branches consult it before staging `ConditionApplied` events. Other planners that emit `ConditionApplied` (movement, weapon-mastery, contested, sacred-weapon, stunning-strike, frenzy, the reactive-spells branch) don't yet gate — none of them currently apply Frightened or any other condition the engine actually carries an immunity for, so the RAW impact is zero today. As new immunity-relevant conditions come online (Charmed, Paralyzed, Poisoned, Stunned interactions), wire the helper in those planners on demand. |
| **~~On-hit trigger system~~** ✓ shipped (partial) | 5 wired (divine-favor, searing-smite, wrathful-smite, thunderous-smite, branding-smite); 7 still deferred (ensnaring-strike, hail-of-thorns, hex, blinding-smite, crusaders-mantle, lightning-arrow, ray-of-enfeeblement) | Slice 61 adds the `consumeOnTrigger` flag on `OnEvent` effects: a one-shot rider lifts its parent condition after firing (and breaks concentration if the parent is concentration-tracked). The straightforward smite-cohort spells are wired. The remaining seven need additional primitives beyond the simple damage rider: target-side condition lookup for Hex's attacker-vs-hexed-target filter, save-or-restrain rider for Ensnaring Strike, AoE-on-hit for Hail of Thorns and Lightning Arrow, condition-on-hit for Blinding Smite, aura primitive for Crusader's Mantle, and on-attack-output debuff for Ray of Enfeeblement. |
| **~~Composite-buff condition~~** ✓ shipped (content) | 3 wired (haste, blur, pass-without-trace) | Slice 73 confirmed the "composite-buff" gap was a content-authoring gap, not an engine gap: conditions already support multiple effects in their `effects` array. Haste ships as a condition with four sibling effects (`ModifySpeed multiply 2`, `AddModifier ac +2`, `SetAdvantage save:DEX advantage`, `ModifyActionEconomy extraAction +1`). Blur uses `ImposeDisadvantageOnAttackers`. Pass without Trace uses `AddModifier { skill: 'stealth' } +10` and is applied to caster + allies via the existing buff mechanic (consumer lists allies in cast intent). Remaining: beacon-of-hope (needs death-save-advantage primitive + heal-maximize), mirror-image (duplicate-pool primitive), magic-weapon (item-buff). |
| **Caster-chosen options at cast time** | ~7 (chromatic-orb, command, calm-emotions, enhance-ability, enlarge-reduce, bestow-curse, elemental-weapon, spirit-shroud) | Pending-choice protocol on cast: caster picks variant; resolution reads the choice and applies the matching effect. |
| **Reaction system** | ~3 (absorb-elements, feather-fall, sanctuary), plus all future reaction spells | Cast as a reaction to a trigger event; needs `ReactionRegistered` event + a window on the appropriate `apply` calls. |
| **~~Movement-mode condition~~** ✓ shipped | 2 wired (fly, spider-climb). Levitate still deferred — RAW is a vertical-only positional effect, not a movement-mode addition. | `ModifySpeed` effect kind already supports `mode: 'fly' \| 'climb'`. Fly + Spider Climb wire as buff conditions carrying ModifySpeed entries. Slice 77 retrofit `getEffectiveSpeed` so ModifySpeed entries actually affect the engine's move planner — also retrofits Fast Movement, Unarmored Movement, Roving, Haste, and the Grappled/Restrained/Paralyzed/Petrified/Unconscious zero-speed conditions (which all already carried the appropriate ModifySpeed entries in the pack but were ignored by the planner). |
| **Transformation handler** (spell variant) | ~2 (alter-self, gaseous-form) | Spell-side transformation; piggybacks on the existing `wildShape` / `polymorph` pattern but with spell-defined target shapes. |
| **~~AC-buff condition~~** ✓ shipped | 2 wired (shield-of-faith, barkskin) | Shield of Faith is the simple case — a condition with `AddModifier target:'ac' value:2`, which already worked via existing primitives once authored. Barkskin needs floor semantics (AC bumps to 17 if natural is lower, regardless of armor). Slice 74 adds a `SetACFloor` Effect kind, an `acFloors` collector on EffectAccumulator, and a floor check in `computeAC` that bumps the natural total and stamps a `floor:<source>` breakdown entry. Distinct from OverrideACFormula (which replaces the formula entirely and only applies unarmored). |
| **~~Temp-HP grant primitive~~** ✓ shipped (partial) | 1 wired (false-life). Heroism still deferred — needs a recurring-rider primitive for "start-of-turn temp HP." Aid was a misclassification — its 5-per-target buff writes to `hp.maxBonus`, not temp HP, and already wires via the existing `aid-buffed` condition. | Slice 75 adds a `temp-hp` SpellMechanic kind plus a planner that rolls `amountDice + flatAmount + extraPerSlotLevel * (slotLevel - spellLevel)` per target and emits `TempHPGranted`. The existing `applyTempHPGranted` reducer already implements RAW max-not-additive semantics. False Life ships with `1d4 + 4 + 5/slot`. |
| **Recurring-rider primitive** | ~4 (heroism, hex damage, aura-of-vitality, phantasmal-force) | Effect that re-fires each round / turn while a condition is active. Couples with area-effect for "damage on start of turn in zone". |
| **~~Item-buff condition~~** ✓ shipped (partial) | 1 wired (magic-weapon). Elemental Weapon still deferred — needs caster-chosen damage type + extra-damage dice on each hit, both beyond the current `attackBonus + damageBonus` shape. Holy Weapon is already wired as a self-buff condition (slice 73) since its bonus applies to "your weapon attacks" generically, not a specific instance. | Slice 76 adds `ItemInstance.temporaryBuff` (attackBonus, damageBonus, sourceEffectInstanceId, source) plus `ItemBuffApplied` / `ItemBuffRemoved` events and reducers. The attack derive reads `attackBonus` into the breakdown; the attack planner adds `damageBonus` to the damage roll modifier. `clearConcentrationEffect` walks item instances and strips any buff tagged with the dropped effect's id. New `engine.plan.magicWeapon({ casterId, weaponInstanceId, slotLevel })` planner handles the cast end-to-end: slot consume, concentration start, buff stamp. Slot scaling is +1 / +1 / +2 / +2 / +3 at L2-6+. |
| **Attack-roll-buff condition** | ~3 (blur, mirror-image, pass-without-trace) | Imposes advantage / disadvantage on attacks against or by the target. Mirror Image's duplicate-pool is a variant. |
| **Type-conditional buff / ward** | ~3 (protection-from-evil-and-good, magic-circle) | Effects whose application depends on the affected creature's type. |
| **Cursed condition** | ~2 (remove-curse, plus future bestow-curse variants) | Standard cursed condition + remove-condition counterpart. |
| **Resistance-buff condition** | 1 (protection-from-energy), plus future wired smites | Damage-type resistance tied to a condition. |
| **Trap mechanic** | ~2 (glyph-of-warding, cordon-of-arrows) | Placed delayed-effect that fires on trigger. |
| **Dedicated planner: Thunder Step** | 1 | Matches Misty Step's pattern but adds an area damage on the origin square. |
| **Resurrection / death utility** | 1 (revivify) | Engine model for "creature was dead → now alive at N HP". |
| **Scrying / divination utility** | 1 (clairvoyance) | Remote sensor primitive. |
| **Illusion-interaction primitive** | ~2 (major-image, silent-image extended) | INT save on interaction + recurring belief check. |
| **~~Push / aerial-restraint primitives~~** ✓ shipped | 2 wired (gust-of-wind, earthbind) | Slice 78 adds a `CreaturePushed` event (informational, like TriggerFired — the engine doesn't model positions, so the consumer applies the position change). The save mechanic gains an optional `pushedFeetOnFail` field that emits the event per failed target. Gust of Wind wires as STR save + 15 ft push. Earthbind wires the aerial restraint via a save → `earthbound-active` condition with `ModifySpeed mode:'fly' op:'set' value:0`; slice 77's getEffectiveSpeed retrofit ensures the fly-zero actually applies. The "falls when grounded" portion of Earthbind is consumer-side (falling damage). |

Picking from this list, top three by spell-count payoff: summon system (11+), area-effect mechanic (~13), on-hit trigger (~9). The other primitives each unblock smaller cohorts; bundle them together by primitive when their turn comes.

## How this list is maintained

At the close of each content slice, update the relevant section here and bump the "Coverage at a glance" counts. If the slice introduces a new mechanic kind (e.g. a future reaction-spell primitive), retro-update the affected schema-only spells to either `wired` or move them to a different deferred bucket. When an engine slice from the "Future engine slices" table ships, mark it as done and walk the affected spells in this doc to their new status.
