# Spell gaps catalog

Per-spell catalog of which entries in the starter pack are wired (engine consumes `mechanicalEffects` or a dedicated planner) versus schema-only (ships in the pack but emits no mechanical event on cast). Extracted from [starter-pack-gaps.md](starter-pack-gaps.md) in slice 249 to keep that doc readable.

For the priority queue and "Future engine slices" backlog that names which primitive each schema-only spell waits on, see [starter-pack-gaps.md](starter-pack-gaps.md).

---

## Spells

Status legend: `wired` = has `mechanicalEffects` array entries that the engine consumes. `planner` = handled by a dedicated planner (`planShield`, `planCounterspell`, `planDispelMagic`, `planIdentify`, `planMistyStep`, `planPolymorph`, `planHuntersMark`); `mechanicalEffects` stays empty by design. `schema-only` = ships in the pack so the schema validator + consumer code sees the spell, but no mechanical event is emitted on cast.

### Cantrips (L0): 34 / 34

**Wired (20):** acid-splash, blade-ward (buff condition with GrantResistance for bludgeoning/piercing/slashing; turn-end auto-expiry via slice-109 `autoExpiry: { afterRounds: 1, trigger: 'turnEnd' }`), chill-touch, eldritch-blast, fire-bolt, frostbite, guidance, mind-sliver, poison-spray, produce-flame, ray-of-frost, resistance (buff condition; consumer-managed 1d4 bonus to one save like Guidance), sacred-flame, shocking-grasp, starry-wisp, thorn-whip, thunderclap, toll-the-dead, vicious-mockery, word-of-radiance.

**Schema-only (14):** dancing-lights, druidcraft, friends, light, mage-hand, mending, message, minor-illusion, mold-earth, prestidigitation, shillelagh, spare-the-dying, thaumaturgy, true-strike. All intentionally narrative / utility — no mechanical event to emit.

### L1: 60 / 60 (full PHB list)

**Wired (33):** bane, bless, burning-hands, cause-fear, charm-person, chromatic-orb (caster-chosen damage type), color-spray, command (caster-chosen variant on save mechanic, 5 variants), cure-wounds, divine-favor (on-hit rider), dissonant-whispers, earth-tremor, faerie-fire, feather-fall (falling-protection buff), find-familiar (summon), guiding-bolt, healing-word, hellish-rebuke, hex (target-side source-filtered rider, +1d6 necrotic), inflict-wounds, longstrider (buff condition with ModifySpeed +10 walk), mage-armor, magic-missile, protection-from-evil-and-good (full RAW shape as of slice 104: type-conditional ImposeDisadvantageOnAttackers + source-gated charmed/frightened GrantConditionImmunity, both gating on the six warded types — aberration, celestial, elemental, fey, fiend, undead; the RAW "possessed" clause stays narrative since the engine has no possessed condition), ray-of-sickness, sanctuary (buff condition + dedicated `engine.plan.sanctuaryWardSave` reaction planner — the attacker rolls a WIS save against the caster's spell DC, and a `SanctuaryProtected` event marks failed saves so the consumer drops the attack; the "spell ends when bearer attacks" RAW clause rides on an OnEvent rider with consumeOnTrigger), searing-smite (on-hit rider, one-shot), sleep, tashas-hideous-laughter (end-of-turn WIS save lifts the condition via `recurringSave.onSuccess: 'removeCondition'`), thunderous-smite (on-hit rider, one-shot), thunderwave, unseen-servant (summon), wrathful-smite (on-hit rider, one-shot).

**Dedicated planner (5):** hunters-mark, identify, shield, absorb-elements, silent-image (slice 137: 1st-level visual Illusion entity bound to caster concentration; consumers use `planInvestigateIllusion` to roll Investigation against the baked DC).

**Schema-only (29):** grouped by the engine primitive each one needs.

- **On-hit trigger system** (rider that fires on the caster's next weapon attack): `ensnaring-smite`, `hail-of-thorns`. Hex's target-side rider wired in slice 88 via `event.attackerIsSource`. The remaining two need primitives beyond the simple damage rider (save-or-restrain rider for Ensnaring Strike, AoE-on-hit for Hail of Thorns).
- **Reaction system** (cast as a reaction to a trigger event): future Silvery Barbs. Absorb Elements wired in slice 91, Sanctuary wired in slice 107. Each ships as its own dedicated planner the consumer calls before/after the triggering event; the engine has no generic reaction-window primitive. Feather Fall slipped this bucket via slice 81's passive `GrantFallingProtection` effect on `planFalling`.
- **Area-effect spell mechanic** (zone with save on enter + ongoing condition / damage): `entangle`, `grease`. Also future Cloudkill, Wall of Fire.
- **Temp-HP grant as a spell mechanic** (current `heal` writes to `current` only): `false-life`, `heroism`.
- (Caster-chosen options wired for L1 — Chromatic Orb's damage type via slice 82, Command's 5-variant save via slice 85.)
- **AC-buff condition** (flat AC bonus tied to a condition): `shield-of-faith`.
- **Pure narrative / utility** (intentionally no mechanical event): `alarm`, `animal-friendship`, `comprehend-languages`, `compelled-duel`, `create-or-destroy-water`, `detect-evil-and-good`, `detect-magic`, `detect-poison-and-disease`, `disguise-self`, `expeditious-retreat`, `fog-cloud`, `goodberry`, `jump`, `purify-food-and-drink`, `speak-with-animals`. Rituals, illusions, sensory spells; they parse and load, they just don't emit anything.
- (Silent Image wired in slice 137 via the dedicated `planSilentImage` planner + new Illusion runtime entity; see L3 for the shared illusion-interaction primitive.)

### L2: 63 / 63 (full PHB list)

**Wired (26):** aid, blindness-deafness, branding-smite (on-hit rider, one-shot), calm-emotions (caster-chosen save variant), cordon-of-arrows (trap, 4 charges, fixed DC 13 piercing), crown-of-madness, darkvision (buff condition with GrantSense darkvision 60), enhance-ability (6-variant buff), enlarge-reduce (caster-chosen buff variant), find-steed (summon), flame-blade, heat-metal, hold-person (paralyzed + end-of-turn WIS save lifts the condition via `recurringSave.onSuccess: 'removeCondition'`), invisibility, lesser-restoration, melfs-acid-arrow, mirror-image (slice 124 attack-deflection pool), moonbeam, prayer-of-healing, protection-from-poison, scorching-ray, shatter, spiritual-weapon, suggestion, summon-beast (summon), web.

**Dedicated planner (1):** misty-step.

**Schema-only (39):** grouped by the engine primitive each one needs.

- (none remaining at L2 — `branding-smite` wired in slice 61 as a one-shot on-hit rider, same shape as the L1 smite cohort).
- **Area-effect spell mechanic** (zone with save on enter, ongoing damage, or movement penalty): `cloud-of-daggers`, `darkness`, `dust-devil`, `flaming-sphere`, `silence`, `spike-growth`, `zone-of-truth`.
- (Caster-chosen options wired for L2 — Enlarge/Reduce via slice 83, Calm Emotions via slice 84, Enhance Ability via slice 86. RAW edges still deferred: Calm Emotions' suppress variant doesn't auto-strip existing Charmed/Frightened; Enlarge/Reduce's ±1d4 weapon-damage rider needs a per-attack damage-die primitive; Enhance Ability's Bear's-Endurance 2d6 temp HP needs a multi-mechanic shape that conditions one mechanic on the variant chosen by another, and Cat's Grace's <20ft fall immunity needs a distance-gated GrantFallingProtection variant.)
- **AC-buff condition** (flat AC bonus tied to a condition): `barkskin` (sets AC to 17 — a "set AC" variant of the AC buff primitive).
- **Attack-roll-buff condition** (impose advantage / disadvantage on attacks against target): `blur` (disadv against caster), `pass-without-trace` (+10 stealth). Mirror Image's duplicate-pool wired in slice 124 (planAttack + planOffHandAttack interception; cast-spell attack-mechanic path is a documented deferral).
- (Item-buff wired — Magic Weapon via slice 76 dedicated planner, Elemental Weapon via slice 90's extra-damage extension.)
- **On-hit weapon-damage rider** (modifies damage a target deals on subsequent attacks): `ray-of-enfeeblement`.
- **Recurring-rider primitive** (effect that fires each turn while condition is active): `phantasmal-force` (1d6 psychic per believed turn).
- **Movement-mode condition** (flying / climbing / hover modes): `levitate`, `spider-climb`.
- **Aerial restraint condition** (knocks flying targets to ground): `earthbind`.
- **Perception-buff condition**: `enthrall` (disadvantage on perception against caster).
- **On-action trigger rider** (cast on willing creature who gains a one-time / per-action effect): `dragons-breath`.
- (Trap mechanic wired in slice 94 — Cordon of Arrows ships as a fixed-DC 13 / 1d6 piercing / 4-charge trap; see slice 94 row for primitive details.)
- **Multi-target linked condition** (effect that ties two creatures together): `warding-bond`.
- **Transformation handler** (shapeshift utility): `alter-self`.
- **Push primitive** (move target via STR save with no damage): `gust-of-wind`.
- **Pure narrative / utility** (intentionally no mechanical event): `animal-messenger`, `arcane-lock`, `augury`, `continual-flame`, `detect-thoughts`, `find-traps`, `gentle-repose`, `knock`, `locate-animals-or-plants`, `locate-object`, `magic-mouth`, `nystuls-magic-aura`, `rope-trick`, `see-invisibility`, `skywrite`. Ritual, divination, illusion, and utility spells; they parse and load, they just don't emit a mechanical event.

### L3: 54 / 54 (full PHB list)

**Wired (22):** animate-dead (summon), bestow-curse (caster-chosen 4-variant save; extra-damage variant wired in slice 88 via the target-side source-filtered rider, inactive-turn variant wired in slice 92 via the `recurringSave` condition field, attack-disadvantage variant wired in slice 96 via the `SetAdvantageVsSource` effect — the ability-disadvantage variant is still narrative-only pending the nested-ability-sub-choice primitive), call-lightning, conjure-animals (summon), crusaders-mantle (aura buff), fear, fireball, glyph-of-warding (Explosive Runes variant only: trap, 1 charge, caster-DC, caster-chosen damage type from acid / cold / fire / lightning / thunder, 5d8 DEX save half), hypnotic-pattern, lightning-bolt, magic-circle (full RAW shape as of slice 104: same disadvantage-on-attackers + source-gated charmed/frightened immunity as Protection from Evil and Good, gating on the six warded types; the engine doesn't model the caster's RAW choice of a single type, so the ward applies against all six broader than RAW), mass-healing-word, phantom-steed (summon), protection-from-energy (caster-chosen 5-variant buff; acid / cold / fire / lightning / thunder resistance via the existing `GrantResistance` effect), sleet-storm, spirit-guardians, spirit-shroud (caster-chosen 3-variant buff; cold / necrotic / radiant +1d8 per hit, plus heal-block on the hit target via the BlockHealing primitive shipped in slice 98), summon-fey (summon), summon-lesser-demons (summon), summon-shadowspawn (summon), summon-undead (summon), vampiric-touch.

**Dedicated planner (7):** counterspell, dispel-magic, elemental-weapon, thunder-step (slice 128: action, teleport caster + one willing ally within 5 ft up to 90 ft, AoE 3d10 thunder on origin with CON save half, +1d10 per slot above 3rd), remove-curse (slice 134: action, touch, strips every condition tagged `category: 'curse'` on the touched target via `planRemoveCurse`), clairvoyance (slice 135: 10-minute cast, places a remote sight-or-hearing Sensor entity bound to the caster's concentration; sight/hearing mode toggles via `planSwitchSensorMode` on the caster's action; concentration drop sweeps the sensor automatically), major-image (slice 137: 3rd-level audiovisual Illusion entity; shares `planInvestigateIllusion` with Silent Image).

**Schema-only (32):** grouped by the engine primitive each one needs.

- **Area-effect spell mechanic** (zone with save on enter, ongoing damage, or movement penalty): `hunger-of-hadar`, `leomunds-tiny-hut`, `plant-growth`, `slow`, `stinking-cloud`, `wind-wall`. Several couple area with a recurring-rider primitive (Hunger, Stinking Cloud).
- **On-hit trigger system** (rider that fires on a weapon attack): `blinding-smite`, `lightning-arrow`. (Crusader's Mantle wired in slice 63 as an aura that applies the rider to multiple targets via the buff mechanic.)
- **Composite-buff condition** (single condition that imposes multiple distinct effects): `beacon-of-hope` (heal-max + advantage on WIS + death saves), `haste` (extra action + speed + AC + DEX-save advantage).
- (Caster-chosen options wired for L3 — Spirit Shroud via slice 89; Elemental Weapon via slice 90's item-buff extension.)
- (Major Image wired in slice 137 via the dedicated `planMajorImage` planner; shares the new Illusion runtime entity with Silent Image, with `kind: 'audiovisual'` vs `'visual'`. Both spells use `planInvestigateIllusion` for the per-creature disbelief check.)
- (Resistance-buff wired in slice 95 — Protection from Energy ships as a caster-chosen 5-variant buff routing to five `protection-X-active` conditions, each carrying a `GrantResistance` effect for the matching damage type. The engine's resistance pipeline already supported this; the slice is pure content.)
- (Remove Curse wired in slice 134 via the dedicated `planRemoveCurse` planner + a new `category: 'curse' \| 'disease' \| 'poison'` field on ConditionSchema; the four `cursed-*-active` variants are all tagged `category: 'curse'` and Remove Curse walks the touched target's appliedConditions and strips every match.)
- **Movement-mode condition**: `fly`.
- **Transformation handler** (shapeshift utility): `gaseous-form`.
- (Glyph of Warding's Explosive Runes wired in slice 94 as a trap with caster-DC and caster-chosen damage type; see slice 94 row. The Spell Glyph variant — storing an arbitrary spell whose targets are resolved at trigger time — still ships schema-only since the trap payload only models save + damage today.)
- **Resurrection mechanic**: `revivify`.
- (Clairvoyance wired in slice 135 via `planClairvoyance` + a new `Sensor` runtime entity. Scrying remains schema-only pending its "target makes a WIS save against being scryed" arm, which composes the new sensor primitive with the existing save mechanic.)
- **Recurring-rider primitive** (heal each turn from caster bonus action): `aura-of-vitality`.
- **Pure narrative / utility** (intentionally no mechanical event): `create-food-and-water`, `daylight`, `feign-death`, `meld-into-stone`, `nondetection`, `sending`, `speak-with-dead`, `speak-with-plants`, `tongues`, `water-breathing`, `water-walk`. Rituals, divination, and quality-of-life spells.

### L4: 40 / 40 (full PHB list)

**Wired (15):** blight, charm-monster, conjure-minor-elementals (summon), conjure-woodland-beings (summon), death-ward (slice-111 buff: `death-ward-active` carries the new `PreventFatalDamage` marker; every primary-damage emitter consults `interceptFatalDamage` after mitigation and clamps + removes the bearing condition; slice 114 extends the intercept to rider-emitted damage via the trigger dispatcher), fire-shield (caster-chosen 2-variant buff; warm = cold resistance + 2d8 fire retaliation, chill = fire resistance + 2d8 cold retaliation), freedom-of-movement, greater-invisibility, ice-storm, phantasmal-killer, stoneskin (slice-112 buff: `stoneskin-active` ships B/P/S `GrantResistance` entries each qualified `'nonmagical'`; SRD shape — the 2024 PHB simplified to plain B/P/S resistance), summon-aberration (summon), summon-construct (summon), summon-elemental (summon), summon-greater-demon (summon).

**Dedicated planner (2):** polymorph, arcane-eye (slice 138: 4th-level slot + action + concentration; places a mobile Sensor entity with darkvision 30 and `mobile: true`; `planMoveSensor` consumes a bonus action to update the eye's free-text location).

**Schema-only (25):** grouped by the engine primitive each one needs.

- **Area-effect spell mechanic**: `black-tentacles`, `wall-of-fire`, `guardian-of-faith`, `private-sanctum`, `compulsion`. Five area shapes / variants of the same deferred primitive.
- (Arcane Eye wired in slice 138 via `planArcaneEye` + a `mobile: true` extension to the slice-135 Sensor schema. The caster moves the eye on a bonus action via `planMoveSensor`, which emits `RemoteSensorMoved` and updates the sensor's free-text location. Locate Creature still ships schema-only; it composes the sensor primitive with a one-way directional ping (mostly narrative), and a content-only buff condition would carry the concentration without engine work.)
- **Aura primitive (sub-effects beyond simple condition projection)**: `aura-of-life` (sub-HP-floor mechanic + auto-revive at 0 HP), `aura-of-purity` (multi-effect resistance + condition immunities).
- **Cross-plane travel / banishment**: `banishment` (CHA save → other plane; return on concentration end).
- **Multi-target movement-restriction**: `resilient-sphere`, `watery-sphere`. Force-cage variants needing per-target restraint with sphere-shaped lifetime.
- **Terrain / shaping utilities**: `control-water`, `hallucinatory-terrain`, `stone-shape`, `fabricate`. Terrain primitive not modeled.
- **Targeted teleport (planner)**: `dimension-door` — same shape as Misty Step but multi-target; a `planDimensionDoor` is the obvious follow-up.
- **DM-resolution ritual**: `divination`.
- **Action-table riser**: `confusion` — the end-of-turn save and spell-ends-on-success branch are wired in slice 93 via the `recurringSave.onSuccess: 'removeCondition'` variant; the random-action table itself still has no planner-level action overrider, so the bearer's behavior during the spell remains narrative.
- **Domination semantics**: `dominate-beast` — distinct from Charmed (full control); not modeled.
- **Caster-chosen damage type + on-attack output**: `elemental-bane`.
- **Alarm + delayed-attack pattern**: `faithful-hound`.
- (AddDamageToAttacker wired in slice 100 — Fire Shield ships as a caster-chosen 2-variant buff: 'warm' grants Cold resistance + 2d8 fire retaliation, 'chill' grants Fire resistance + 2d8 cold retaliation. Crits on the triggering attack don't double the retaliation dice per RAW. The "creature within 5 ft" and "melee attack" RAW gates aren't enforced. Retaliation damage now flows through `mitigateDamage` (slice 113) and consults `interceptFatalDamage` (slice 114) on the attacker.)
- **Transformation handler for non-self targets**: `giant-insect`.
- **Extradimensional storage**: `secret-chest`.

### L5: 46 / ~46 (full PHB list)

**Wired (13):** cloudkill, cone-of-cold, conjure-elemental (summon), contagion, dominate-person, greater-restoration (remove-condition: charmed / petrified / paralyzed / stunned / poisoned / blinded / deafened), hold-monster (shares Hold Person's `held-paralyzed-active` condition; end-of-turn WIS save lifts the condition), holy-weapon (concentration buff with +2d8 radiant OnEvent rider on weapon hits), insect-plague, mass-cure-wounds, summon-celestial (summon), summon-draconic-spirit (summon), synaptic-static.

**Dedicated planner (1):** scrying (slice 136: 5th-level slot + 10-minute cast + target WIS save vs caster's spell DC + optional familiarity-tier `dcAdjustment`; on fail places a Sensor entity bound to the caster's concentration and following the target via free-text location, on success the slot is still consumed).

**Schema-only (32):** grouped by the engine primitive each one needs.

- **Area-effect spell mechanic** (often with multi-damage-type or terrain interplay): `flame-strike` (fire + radiant), `destructive-wave` (thunder + radiant or necrotic + condition), `wall-of-force`, `wall-of-light`, `wall-of-stone`, `passwall`, `hallow`.
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

**Wired (8):** dominate-monster, feeblemind (INT save → stunned + 4d6 psychic, approximating the int/cha-score reduction), holy-aura (multi-effect concentration buff: per-ability save advantage, universal ImposeDisadvantageOnAttackers, plus an OnEvent rider gated on the attacker being Fiend or Undead emitting `ApplyConditionToAttacker { blinded }`; the RAW CON-save gate on the blind and the "melee attack" gate aren't enforced today — the dispatcher has no save action and no attackKind fact), incendiary-cloud, maddening-darkness, mind-blank (Charmed immunity + psychic-damage immunity; thought-reading / scrying-detection clauses stay narrative), sunburst, tsunami.

**Schema-only (11):** the big-shape transformations and rituals — antimagic-field (magic suppression), antipathy-sympathy (type-conditional buff), clone (resurrection-on-death), demiplane / maze (extradimensional / single-target plane shift), control-weather (environment primitive), earthquake (multi-stage terrain area), power-word-stun (HP-threshold tier effect), animal-shapes (mass transformation), glibness / telepathy (narrative).

### L9: 21 / ~21 (full PHB list)

**Wired (5):** foresight (multi-effect buff: advantage on attack/check/save plus attackers have disadvantage; the "can't be surprised" clause stays narrative), invulnerability (GrantImmunity all damage), mass-heal (flat 70 HP — RAW is a 700-HP pool but the existing heal mechanic doesn't carry a pool; approximation per target), psychic-scream (INT save with 14d6 psychic + stunned on fail), weird (WIS save with 4d10 psychic area + frightened on fail).

**Schema-only (16):** the legendary effects — astral-projection / gate (cross-plane), imprisonment (6-variant utility), mass-polymorph (multi-target transformation), meteor-swarm (multi-AoE multi-damage), power-word-heal (full heal + multi-condition remove), power-word-kill (HP-threshold), prismatic-wall (multi-layer wall), ravenous-void (forced-movement AoE), shapechange (transformation handler), storm-of-vengeance (multi-stage area), time-ravage (multi-effect single-target), time-stop (turn-economy), true-polymorph + true-resurrection + wish (each with a dedicated planner already shipped: polymorph, future resurrection, wish).

Not in pack.

