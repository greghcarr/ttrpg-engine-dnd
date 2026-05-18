# Changelog archive: slices 196-200 + monster batches 5.x + subclass batches 1.x

Originally in the `## Unreleased` section of [../../CHANGELOG.md](../../CHANGELOG.md). Moved here in slice 248 to keep the live CHANGELOG under the single-Read ceiling.

This window covers slices 196-200 (planUncannyDodge, CancelAdvantageOnAttackers, SRD 5.2.1 drift audit harness, tool categorization, docs rollup, npm-publish posture) plus the parallel "Content authoring: monsters batch 5.x" and "Content authoring: subclass batch 1.x" rollups.

Order: most-recent first. For more recent slices (201+), see [archive-slices-201-216.md](archive-slices-201-216.md) and onward. For older, see [archive-slices-186-195.md](archive-slices-186-195.md).

---

**Engine: planUncannyDodge + Rogue L5 Uncanny Dodge (slice 200)**

Adds a dedicated reaction planner for Uncanny Dodge plus a `GrantUncannyDodge` marker primitive (40 to 41 EFFECT_KINDS). RAW (SRD 5.2.1): "When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack's damage against you (round down)."

Mechanism follows the existing Absorb Elements pattern, since the triggering DamageApplied has already committed by the time the consumer reacts: the planner emits a compensating `Healed` event for `floor(damageAmount / 2)`, an `ActionEconomyConsumed` (reaction) when inside an encounter, and a record-only `UncannyDodgeUsed` notification carrying the triggering DamageApplied id + the refunded amount for transcript readability. The planner gates on the bearer's effect stack carrying `GrantUncannyDodge` and on `assertReactionAvailable`; the RAW "you can see the attacker" preconditions stay consumer-side (the engine has no line-of-sight model).

New event: `UncannyDodgeUsed` ([src/schemas/events/reactive-spells.ts](src/schemas/events/reactive-spells.ts)), pure-notification dispatcher case in [src/engine/apply.ts](src/engine/apply.ts). New planner: `engine.plan.uncannyDodge(state, intent)` ([src/engine/plan/reactive-spells.ts](src/engine/plan/reactive-spells.ts)). New transcript formatter for `UncannyDodgeUsed` ([tests/transcript.ts](tests/transcript.ts)).

Canonical user: Rogue L5 Uncanny Dodge, added to [src/content/packs/starter-pack.json](src/content/packs/starter-pack.json) alongside Sneak Attack (3d6) and Cunning Strike. Closes another of the missing main-class features in the SRD 5.2.1 classes audit (~17 to ~16, with slice 199 already having closed Elusive).

Tests: 8-case planner test in [tests/unit/engine/plan-uncanny-dodge.test.ts](tests/unit/engine/plan-uncanny-dodge.test.ts) (halve, floor, zero, no-feature throw, negative throw, in / out of encounter, reaction-already-used throw); accumulator marker test alongside slice 199's tests in [tests/unit/effects/builder.test.ts](tests/unit/effects/builder.test.ts); golden scenario with transcript at [tests/golden/s200-uncanny-dodge.test.ts](tests/golden/s200-uncanny-dodge.test.ts) walks an attack-hit then reaction-halve flow. 1497 tests pass, tsc --noEmit clean.

**Engine: CancelAdvantageOnAttackers + Rogue L18 Elusive (slice 199)**

Adds the `CancelAdvantageOnAttackers` effect primitive (39 to 40 EFFECT_KINDS): a predicate-gated marker that suppresses every advantage contribution against the bearer at attack-roll time. Wired in [src/engine/plan/attack.ts](src/engine/plan/attack.ts) just before the 2024 advantage / disadvantage resolution block; an explicit `input.advantage === 'advantage'` from the caller is also nullified when the bearer carries the marker. Disadvantage contributions are unaffected, matching RAW ("no attack roll can have Advantage against you").

Canonical user: Rogue L18 Elusive, wired via:

```jsonc
{
  "kind": "CancelAdvantageOnAttackers",
  "condition": { "kind": "eq", "path": "bearerHasIncapacitated", "value": false }
}
```

The attack planner populates `bearerHasIncapacitated` from `findActorBlockingCondition` so the rule's "unless you have the Incapacitated condition" exemption picks up every action-blocking condition (incapacitated / stunned / paralyzed / petrified / unconscious, plus the HP-zero proxy) instead of just the literal `incapacitated` id. Closes one of the ~17 missing-main-class-feature entries from [docs/srd-5.2.1-audit-classes.md](docs/srd-5.2.1-audit-classes.md).

Tests: builder accumulator unit tests in [tests/unit/effects/builder.test.ts](tests/unit/effects/builder.test.ts); 8-case planner test in [tests/unit/engine/plan-attack-elusive.test.ts](tests/unit/engine/plan-attack-elusive.test.ts); golden scenario with transcript at [tests/golden/s199-elusive.test.ts](tests/golden/s199-elusive.test.ts) walks an Invisible attacker against an Elusive Rogue (advantage suppressed) and then re-runs with the bearer Stunned (advantage restored). 1488 tests pass.

**Content authoring: monsters batch 5.11 (SRD 5.2.1 closure)**

SRD 5.2.1 closure (10 entries): Gargoyle (CR 2), Ogre Zombie (CR 2), Swarm of Crawling Claws (CR 3), Guard Captain (CR 4), Tough Boss (CR 4), Half-Dragon (CR 5), Gorgon (CR 5), Spirit Naga (CR 8), Guardian Naga (CR 10), Archmage (CR 12). Closes the SRD 5.2.1 monster catalog at 234 of 235 entries (Troll Limb deferred pending Loathsome Limbs spawn primitive from batch 5.6). Broadest type-spread per-batch in the pack (7 creature types): Undead 17 to 19, Elemental 16 to 17, Construct 9 to 10, Celestial 9 to 10, Humanoid 23 to 26, Dragon 44 to 45, Fiend 28 to 29. Pack monster total 242 to 252. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB.

Pack records: Swarm of Crawling Claws ships the largest condition-immunity profile in the pack (11 entries — full "swarm-of-Tiny" immunity bundle); Guardian Naga 5-save profile at CR 10 is the densest single-statblock 5-save profile outside the Tarrasque tier; Archmage's Cone of Cold level-9 cast is the highest spell-cast tier in the pack (previous high was Succubus Dominate Person level-8 from 5.8); Archmage Arcane Burst 150-ft range is the longest single-attack ranged attack in the pack; Half-Dragon ships variable-resistance + variable-breath-damage-type that the schema cannot represent (shipped as empty array + no breathWeapon field, conditional deferred).

GrantMagicResistance cohort 35 to 36 (Archmage). All ten ship `traits: []` except Archmage. Notable deferred mechanics: Swarm trait (occupy-other-creature's-space + no-regen + no-temp-HP composite), Swarm Bloodied-conditional damage decrease (first such), Ogre Zombie Undead Fortitude (save-to-survive-0-HP, first such in pack), Gorgon Petrifying Breath two-failure escalation (third user of shape), Tough Boss Warhammer push-target-10-ft (first push-on-hit primitive), Half-Dragon Draconic Origin variable-resistance + variable-breath (novel conditional primitive), Spirit Naga + Guardian Naga + Rakshasa restoration family (3 users of the per-deity-restoration auto-revive primitive), Archmage Mind Blank conditional-immunity-from-precast-spell, Archmage Misty Step bonus-action 3/Day (first per-day-spell-as-bonus-action variant).

Slice 5 closure summary: 11 batches added 71 statblocks (5.1 Aberrations 5 + 5.2 Construct/Sphinx 6 + 5.3 Undead 5 + 5.4 Goblinoid 6 + 5.5 Flying/Kraken 5 + 5.6 Plant/Misc 6 + 5.7 Aquatic/Pirate 6 + 5.8 Fiend/Salamander 7 + 5.9 Iconic/Tarrasque 7 + 5.10 Pack/Elemental 8 + 5.11 SRD closure 10). Pack now ships 252 of ~370 MM (68%) and 234 of 235 SRD 5.2.1 (99.6%; only Troll Limb deferred). Wired-breath-weapon cohort 42 to 44; GrantMagicResistance 30 to 36; Legendary Resistance 11 to 16; Legendary Actions 7 to 12; Pack Tactics 0 to 5. All 14 MM creature types now have meaningful depth in the pack.

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.10**

Pack predators + Elemental fill (8 entries): Axe Beak (CR 1/4), Grimlock (CR 1/4), Gnoll Warrior (CR 1/2), Magmin (CR 1/2), Worg (CR 1/2), Azer Sentinel (CR 2), Winter Wolf (CR 3), Xorn (CR 5). Adds the canonical pack-predator cohort (Axe Beak / Worg / Winter Wolf + Gnoll Warrior + Grimlock) plus three Elemental fills.

Monstrosity 33 to 35, Aberration 8 to 9, Fey 14 to 15, Fiend 27 to 28, Elemental 13 to 16 (densest Elemental expansion since the slice-1.9 base Elementals). Pack monster total 234 to 242. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB.

Winter Wolf Cold Breath wired via slice-140 breath weapon primitive (wired-breath cohort 43 to 44); second non-Dragon breath user this slice after Dragon Turtle (5.9). Pack Tactics cohort 4 to 5 (Winter Wolf). SRD 5.2.1 type reclassifications: Gnoll (Humanoid to Fiend), Worg (Monstrosity to Fey). Primordial sub-dialects now cover Aquan + Ignan + Terran (3 of 4); Ignan cohort 1 to 3 (Azer + Magmin + existing Salamander).

Deferred mechanics: Azer Fire Aura (8th aura-trigger user), Magmin Death Burst (first on-death-area-damage primitive), Magmin Ignited Illumination (first toggleable Illumination), Magmin Touch start-burning environmental rider, Gnoll Warrior Rampage on-damage-to-Bloodied trigger (first such), Worg Bite on-hit-grant-Advantage-to-next-attacker (novel variant of Pirate Captain Rapier shape), Xorn Earth Glide (second persistent-environment non-modification movement after Purple Worm Tunneler) + Treasure Sense (second metal-detection after Rust Monster Iron Scent). All eight ship `traits: []`. 6 of 8 are single-attack-only — densest single-attack-only batch in the pack.

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.9**

Iconic high-CR closure + Tarrasque (7 entries): Pseudodragon (CR 1/4), Centaur Trooper (CR 2), Ettercap (CR 2), Doppelganger (CR 3), Purple Worm (CR 15), Dragon Turtle (CR 17), Tarrasque (CR 30). Brings the canonical adventure-iconic high-CR set into the pack with Tarrasque as the CR 30 capstone (the SRD 5.2.1 single-highest CR statblock). Monstrosity 29 to 33, Dragon 42 to 44, Fey 13 to 14. Pack monster total 227 to 234. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB.

Pack record updates from Tarrasque: PB +9 (schema max, first such in pack), HP 697 (new pack high, +216 over Kraken), STR 30 + CON 30 (schema-max ability scores), Legendary Resistance 6/Day (new pack high, exceeding Lich + Kraken's 4/Day), AC 25 (new pack high, exceeding Ancient Red at AC 22), 150-ft Cone (largest Cone in pack), 6-target Swallow cap (largest in pack).

Dragon Turtle Steam Breath wired via slice-140 breath weapon primitive (wired-breath cohort 42 to 43; first non-color-themed Dragon with wired breath). Pseudodragon ships GrantMagicResistance (slice-131 cohort 33 to 35 with Tarrasque); Pseudodragon's CR 1/4 makes it the lowest-CR Magic Resistance user. Legendary Resistance cohort 15 to 16 (Tarrasque). Legendary Actions cohort 11 to 12 (Tarrasque).

Deferred mechanics: Tarrasque Reflective Carapace (reflect-targeting-spell primitive, first in pack), Tarrasque Siege Monster + Bite teleportation-prohibition predicate + World-Shaking Movement emanation-Concentration-loss, Purple Worm Tunneler (persistent-environment-modification movement), Pseudodragon Sting Failure-by-5-or-More escalation (third user of shape), Centaur Trooper Trampling Charge move-through-creature-spaces (novel composite), Doppelganger first-round-of-combat advantage rider + Unsettling Visage emanation + Shape-Shift bonus action + Read Thoughts action-cast, Ettercap Web Strand destructible-web-as-object (first explicit), Dragon Turtle Bite environment-conditional-damage-source-override (first such).

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.8**

Fiend ladder fill + Salamander (7 entries): Hell Hound (CR 3), Nightmare (CR 3), Incubus (CR 4), Lamia (CR 4), Succubus (CR 4), Salamander (CR 5), Rakshasa (CR 13). Adds the SRD 5.2.1 charmer / deceiver / mount Fiend roster plus the Salamander Elemental. Fiend type 21 to 27 (densest single-batch Fiend expansion in the pack); Elemental type 12 to 13. Pack monster total 220 to 227. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB. Incubus + Succubus ship as mirror statblocks (Long-Rest shape-shift between forms). Rakshasa at CR 13 / HP 221 / PB +5 carries Greater Magic Resistance (auto-succeed-on-saves-vs-spells + spell-attack-rolls-auto-miss — stronger than the existing GrantMagicResistance primitive) and Fiendish Restoration (auto-revive-in-Nine-Hells). Pirate Captain's CHA-20 cohort joins Incubus + Succubus at the highest non-Solar / non-Pit-Fiend / non-Marilith CHA tier. Salamander adds the second `damageVulnerabilities: ["cold"]` user. Deferred mechanics: Hell Hound Pack Tactics (fourth user), Incubus / Succubus Long-Rest shape-shift (novel long-rest-bound shape-shift), Incubus + Rakshasa rest-prevention curses (Short-only for Incubus, Short + Long for Rakshasa), Incubus Nightmare HP-threshold-conditional save-rider (first such), Lamia Corrupting Touch save-induced multi-condition curse (Charmed + Poisoned), Lamia Leap movement-conversion-jump, Nightmare Confer Fire Resistance per-mount-rider, Nightmare Ethereal Stride carry-up-to-3-willing-creatures cross-plane (novel), Rakshasa Baleful Command (densest emanation-save-and-multi-condition in pack), Rakshasa conditional piercing vulnerability from Bless-affected wielders (schema cannot represent the source-state predicate; shipped as empty array with deferral noted), Salamander Fire Aura (seventh aura-trigger user) + Flame Spear thrown-return + Constrict replace-attack. All seven ship `traits: []`.

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.7**

Aquatic + Pirate + Kobold roster (6 entries): Kobold Warrior (CR 1/8), Merfolk Skirmisher (CR 1/8), Sahuagin Warrior (CR 1/2), Pirate (CR 1), Merrow (CR 2), Pirate Captain (CR 6). Adds the canonical aquatic-encounter cohort (Merfolk + Merrow + Sahuagin) plus the Pirate pair plus Kobold Warrior. SRD 5.2.1 reclassifies Kobold (Dragon), Merfolk (Elemental), and Sahuagin (Fiend) — only the Pirate pair land in Humanoid. Broadest type-spread per-batch in the pack to date (5 types touched): Humanoid 21 to 23, Fiend 20 to 21, Dragon 41 to 42, Elemental 11 to 12, Monstrosity 28 to 29. Pack monster total 214 to 220. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB. Pirate Captain at CR 6 with 4 save proficiencies (STR / DEX / WIS / CHA) is the densest save profile at CR 6 in the pack. Deferred mechanics: Kobold Warrior Pack Tactics (third user) + Sunlight Sensitivity (eighth user), Merfolk Ocean Spear on-hit Speed-reduction-and-magical-return (first thrown-return primitive in pack), Sahuagin Blood Frenzy (target-HP-state-conditional-advantage primitive, first such) + Limited Amphibiousness (first time-gated environmental-survival primitive) + Shark Telepathy, Merrow Harpoon pull-Large-or-smaller-15-ft (second pull-toward-self after Roper Reel), Pirate Enthralling Panache save-induced-Charm-replacement-attack, Pirate Captain Rapier on-hit-self-advantage rider + Pistol (first firearm-range profile in pack) + Captain's Charm bonus-action + Riposte +3-AC-on-miss-Rapier-counterattack. All six ship `traits: []`.

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.6**

Plant + Giant + Misc closure (6 entries): Shrieker Fungus (CR 0), Violet Fungus (CR 1/4), Rust Monster (CR 1/2), Ettin (CR 4), Troll (CR 5), Oni (CR 7). Closes the SRD 5.2.1 Plant catalog (4 to 6 entries; both Fungus variants join the canonical Awakened Shrub / Awakened Tree / Shambling Mound / Treant cohort), expands the Giant roster (7 to 9 with Ettin + Troll), and adds Rust Monster + Oni as single-statblock additions to Monstrosity + Fiend. Plant 4 to 6, Giant 7 to 9, Monstrosity 27 to 28, Fiend 19 to 20. Pack monster total 208 to 214. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB. The two Fungus statblocks share AC 5 / Initiative -5 / blindsight-30-no-darkvision / 4-condition-immunity-fungal-sensory-absence — the new low-AC anchor for the Plant type and second blindsight-30-no-darkvision profile after Darkmantle (5.1). Oni ships hover (fourth hover user; first hover-Fiend in pack). Troll Regeneration 15/turn ties as densest regen rate; Oni Regeneration 10/turn (no suppression). Deferred mechanics: Shrieker Fungus Shriek reaction (proximity-triggered 1-minute environmental-broadcast, first such in pack), Rust Monster Antennae per-item AC-or-attack-penalty primitive (first item-damage save in pack) + Reflexive Antennae on-hit reaction, Ettin Battleaxe Prone-if-Large-or-smaller + Morningstar Disadvantage-on-next-attack rider (first explicit Disadvantage rider), Troll Loathsome Limbs spawn-on-conditional-damage-threshold (novel; Troll Limb spawn deferred), Troll Charge bonus-action targeted-movement, Oni Shape-Shift size-tier-swap (third Shape-Shift user after Mimic + Lycanthropes), Oni Spellcasting per-spell envelope (Charm Person level 2 / Darkness / Gaseous Form / Sleep 1/Day each), Oni Invisibility bonus-action self-cast (first such outside per-spell envelope), Oni Multiattack with replace-one-attack-with-Spellcasting (novel replace variant). All six ship `traits: []`.

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.5**

Flying predators + Kraken (5 entries): Hippogriff (CR 1), Harpy (CR 1), Wyvern (CR 6), Roc (CR 11), Kraken (CR 23). Closes the canonical SRD 5.2.1 flying-predator Monstrosity roster (Hippogriff / Harpy / Roc), adds Wyvern (typed Dragon in SRD 5.2.1, not Monstrosity) as the first non-color-themed Dragon in the pack, and adds Kraken (subtype Titan) as the high-CR aquatic anchor. Monstrosity type 23 to 27; Dragon type 40 to 41; pack monster total 203 to 208. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB. Kraken at CR 23 / PB +7 / HP 481 / STR 30 is the joint third-highest CR statblock (tying Ancient Blue + Ancient Silver Dragons, just below Ancient Red + Ancient Gold at CR 24) and the first non-Dragon CR-23 entry. Legendary Resistance cohort 14 to 15 (Kraken 4/Day non-lair, second 4/Day LR user after Lich). Deferred mechanics: Hippogriff Flyby (first no-OA-on-fly-out primitive in pack), Harpy Luring Song (densest single-statblock mind-control composite in pack — 300-ft Emanation Concentration with target-type predicate, Charmed-Incapacitated-forced-movement-toward-source, environmental-hazard repeat-save), Roc Swoop Recharge-5-6 grapple-relocation-drop, Roc Multiattack with attack-replacement Talons (eighth replace-one-attack-with-X user), Wyvern Sting 7d6 poison-rider (densest poison-rider in pack), Kraken Tentacle 10-tentacle 30-ft-reach auto-grapple-and-Restrain, Kraken Fling throw-Grappled-as-projectile (first such), Kraken Lightning Strike, Kraken Swallow (4-target-cap, highest in pack), Kraken Legendary Actions (Toxic Ink underwater-only environmental gate). All five ship `traits: []`.

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.4**

Goblinoid martial roster (6 entries): Goblin Minion (CR 1/8), Goblin Boss (CR 1), Hobgoblin Warrior (CR 1/2), Hobgoblin Captain (CR 3), Bugbear Warrior (CR 1), Bugbear Stalker (CR 3). Closes the canonical SRD 5.2.1 goblinoid martial trio (Goblins + Hobgoblins + Bugbears) with two tiers each, pairing with the seed Goblin Warrior. SRD 5.2.1 reclassifies all goblinoids from Humanoid to Fey with `subtype: "goblinoid"`; the goblinoid subtype cohort moves from 1 (Goblin Warrior seed) to 7 entries. Fey type total moves from 7 to 13 entries; pack monster total moves from 197 to 203. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB. All six ship `traits: []`. Deferred mechanics: Pack Tactics (Hobgoblin Warrior + Captain), Aura of Authority (Hobgoblin Captain — first non-damage / non-condition aura in pack), Nimble Escape (Goblin Minion + Boss — first bonus-action-take-known-action primitive), Redirect Attack reaction (Goblin Boss — first place-swap-on-trigger reaction in pack), poison-damage rider on weapon attacks (Hobgoblin Warrior + Captain), Multiattack with hybrid-range-disjunction Javelin (Bugbear Stalker — second user of the shape after Lich Eldritch Burst from 5.3), advantage-if-target-Grappled-by-self attack rider (Bugbear Warrior + Stalker), Quick Grapple bonus-action save-induced grapple (Bugbear Stalker), Abduct (Bugbear Warrior + Stalker — narrative).

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.3**

Undead expansion (5 entries): Ghast (CR 2), Lich (CR 21), Will-o'-Wisp (CR 2), Warhorse Skeleton (CR 1/2), Minotaur Skeleton (CR 2). Second broad Undead expansion after batch 4.9. Undead type moves from 12 to 17 entries (Vampire Familiar shipped in 4.9 is typed Humanoid in SRD 5.2.1); pack monster total moves from 192 to 197. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB. Lich at CR 21 ties Solar as joint-highest-CR; PB +7 (first non-Dragon non-Celestial PB +7 statblock). The Warhorse + Minotaur Skeleton pair joins the seed Skeleton as the canonical 3-statblock Skeleton subfamily, all carrying the `damageVulnerabilities: ["bludgeoning"]` profile (densest single-vulnerability cohort in the pack). Will-o'-Wisp ships the longest condition-immunity profile in the pack (8 entries), the broadest damage-resistance profile (7 entries), `hover: true`, and DEX 28 (the highest DEX in the pack). Lich exercises `subtype: "Wizard"` (second non-Demon / non-Devil subtype in pack after Lycanthropes). Legendary Resistance cohort moves from 13 to 14 (Lich's 4/Day non-lair variant exceeds the prior 3/Day cap on existing LR statblocks). Deferred mechanics: Ghast Stench aura, Lich Eldritch Burst hybrid-range attack (first in pack), Lich Paralyzing Touch guaranteed-condition-on-hit (first such), Lich Spellcasting 2/Day Each tier (novel), Lich Legendary Actions (Deathly Teleport AoE around departure point, Disrupt Life non-Undead-only emanation, Frightening Gaze), Will-o'-Wisp Consume Life execute-at-0-HP (first such), Will-o'-Wisp Vanish self-cancel-on-attack Invisibility, Warhorse + Minotaur Skeleton Trampling Charge (folds into existing moved-20-ft-charge family). All five ship `traits: []`.

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.2**

Construct + Sphinx cohort (6 entries): Clay Golem (CR 9), Flesh Golem (CR 5), Homunculus (CR 0); Sphinx of Wonder (CR 1), Sphinx of Lore (CR 11), Sphinx of Valor (CR 17). Closes the SRD 5.2.1 Golem family (Stone + Iron already in pack from batch 1.12) and opens the Sphinx subfamily under Celestial. Construct type moves from 6 to 9 entries; Celestial type moves from 6 to 9. Pack monster total moves from 186 to 192. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / saves / damage R/I/V / condition immunities / senses / CR / XP / PB. Magic Resistance wired on Clay Golem, Flesh Golem, and Sphinx of Wonder via `GrantMagicResistance` (slice-131 cohort moves from 30 to 33). Sphinx of Valor's PB +6 + four-save proficiency (DEX +6, CON +11, INT +9, WIS +12) is the densest non-Dragon save spread in the pack; its WIS +12 ties Solar at the top. Two Sphinxes carry Legendary Resistance (3/Day non-lair), extending the LR cohort from 11 to 13 users. Deferred mechanics: Clay / Flesh Golem Acid / Lightning Absorption (heal-on-damage-type primitive doesn't exist), Golem Berserk (Bloodied-trigger primitive doesn't exist), Sphinx of Lore + Valor Inscrutable + Legendary Resistance + spellcasting envelopes, Sphinx of Valor's three-stage Roar sequence (first new sequenced-uses-with-different-effects primitive in the pack — 500-ft Emanation is the largest AoE in the pack to date), Sphinx of Lore Mind-Rending Roar (Recharge 5-6, 300-ft Emanation, Incapacitated-rider), Homunculus Bite Failure-by-5-or-More escalation (reuses Vampire Bite shape).

Tests: pre-existing suite, no engine changes.

**Content authoring: monsters batch 5.1**

Aberration sweep (5 entries): Chuul (CR 4), Cloaker (CR 8), Darkmantle (CR 1/2), Grick (CR 2), Roper (CR 5). Closes the SRD 5.2.1 Aberration roster outside the seed Aboleth / Gibbering Mouther / Otyugh. Aberration type moves from 3 to 8 entries; pack monster total moves from 181 to 186. Every entry sourced verbatim from `references/srd-markdown/monsters-A-Z.md` on AC / HP / abilities / damage R/I/V / condition immunities / senses / CR / XP / PB. All five ship `traits: []` — Spider Climb / Amphibious / Sense Magic / Light Sensitivity have no engine primitive yet. Bestiary mechanics defer under existing gaps: Chuul Pincer + Grick Tentacles + Roper Tentacle auto-grapple-on-hit; Chuul Paralyzing Tentacles two-tier Poisoned-then-Paralyzed escalation; Cloaker Attach damage-share-on-attach (first such mechanic in the pack); Cloaker Phantasms (Recharge after Short or Long Rest spell-cast with bright-light early-end gating); Cloaker Moan 60-ft Frightened emanation with 24-hour per-target immunity tracker; Darkmantle Crush auto-attach + Blinded + suffocating composite; Darkmantle Darkness Aura (1/Day Concentration emanation magical darkness, first such in pack); Roper Reel directional-movement-on-Grappled (first such in pack); Roper destructible per-tentacle AC 20 / HP 10 composite (densest per-attack-slot destructible-component primitive in pack). Darkmantle's blindsight-60 / no-darkvision sense profile is the second such after Black Pudding.

Tests: pre-existing suite, no engine changes.

**Content authoring: subclass batch 1.8**

Extends the Life Domain (Cleric subclass) entry beyond its L3 baseline. All four remaining SRD 5.2.1 features defer because each blocks on a distinct missing engine capability; two new L3 entries also defer pending the same primitives.

- L3 Life Domain Spells: new `effects: []` entry (deferred). Per-cleric-level prepared spell list (Aid / Bless / Cure Wounds / Lesser Restoration at L3, Mass Healing Word / Revivify at L5, Aura of Life / Death Ward at L7, Greater Restoration / Mass Cure Wounds at L9 — all 10 spells exist in the pack). The `GrantSpell` primitive is schema-defined but has no engine consumer: `src/effects/builder.ts:577` falls through, and no derivation reads `GrantSpell` effects to populate a character's prepared spell list. Wiring would need an `EffectAccumulator.grantSpell` collector plus a `derivedPreparedSpells` derivation that consults it.
- L3 Preserve Life: new `effects: []` entry (deferred). RAW expends a Channel Divinity use to evoke healing equal to 5 × cleric level distributed among Bloodied creatures within 30 ft (capped at half HP max per recipient). Same shape as Sacred Weapon — a Channel Divinity action needing a dedicated planner. Every existing `Custom` handlerId in the pack (frenzy, sacred-weapon, reckless-attack, wild-companion, martial-arts, slow-fall, stunning-strike, metamagic, cutting-words) pairs with an engine planner; shipping a `preserve-life` handlerId without one would break that invariant and inflate the wired-features snapshot.
- L6 Blessed Healer: `effects: []` (deferred). RAW triggers when *you* cast a healing spell that restores HP to a creature *other than yourself*, with the heal-back amount = 2 + spell slot level. Two engine gaps: (1) `HealedEvent` payload has `targetId`, `amount`, `source` — no `casterId`, so an OnEvent rider can't confirm the bearer was the caster; (2) `buildEventFacts` in `src/engine/triggers/dispatch.ts` only generates relative facts (`event.targetIsSelf`, `event.attackerIsSelf`, etc.) for `AttackRolled` and `DamageApplied` events, so a filter referencing `event.targetIsSelf` on a Healed event sees `undefined` and never fires.
- L17 Supreme Healing: `effects: []` (deferred). RAW: "When you would normally roll one or more dice to restore HP with a spell or Channel Divinity, don't roll those dice; use the highest possible value instead." No "max-roll healing dice instead of rolling" primitive exists; `cast-spell.ts` always rolls via `rollDamage`. Closing this would need a `MaxHealingDice` flag in the effect stack plus a check in the healing branch of cast-spell.

Tests: 1466 pass, tsc --noEmit clean. No snapshot moves (all four are pure stubs).

**Content authoring: subclass batch 1.7**

Extends the Circle of the Land (Druid subclass) entry beyond its L3 row. Two of four remaining SRD 5.2.1 features wire (one partial, one near-wire); two defer. Also adds a missing L3 entry to the existing array.

- L3 Circle of the Land Spells: new `effects: []` entry (deferred). RAW grants a per-land-type prepared spell list (Arid / Polar / Temperate / Tropical) with 3-4 spells per land per druid level (L3 / L5 / L7 / L9). Wiring would need 4 OfferChoice options × 4 level rows of always-prepared `GrantSpell` entries, blocked on the same `OfferChoice when='onLongRest'` non-implementation that gates Fiendish Resilience and many other rest-swappable features.
- L6 Natural Recovery: partial wire. `GrantResource { resourceId: "natural-recovery", max: 1, recharge: "longRest" }` tracks the once-per-LR cap shared by both halves (no-slot circle-spell cast + short-rest slot recovery up to half druid level). Neither spend mechanic has a planner; the resource is bookkeeping that consumers can surface as "Natural Recovery (1/LR)" — same shape as Fighter Second Wind, Fiend Patron Dark One's Own Luck.
- L10 Nature's Ward: near wire. `GrantConditionImmunity { conditionId: "poisoned" }` covers the Poisoned-condition immunity cleanly. The damage-resistance half ships as `OfferChoice` with 4 options (Arid→Fire, Polar→Cold, Temperate→Lightning, Tropical→Poison) per the SRD Nature's Ward table. RAW divergence: the land choice happens at L10 standalone rather than inheriting from the L3 Circle of the Land Spells land choice, because L3 is currently schema-only and the engine has no way to share a single OfferChoice answer across two distinct level-grant features.
- L14 Nature's Sanctuary: `effects: []` (deferred). RAW spends a Wild Shape use to place a 15-ft cube within 120 ft for 1 min, granting Half Cover and the bearer's current Nature's Ward resistance to allies inside. Movable as a bonus action. None of the cube placement, half-cover, ally-area-resistance-share, or generic Wild Shape consumption primitives exist.

Tests: 1466 pass, tsc --noEmit clean, snapshot picks up two new wired entries (`circle-of-the-land L6 natural-recovery` and `circle-of-the-land L10 natures-ward`).

**Content authoring: subclass batch 1.6**

Extends the Fiend Patron (Warlock subclass) entry beyond its L3 row. Two of three remaining SRD 5.2.1 features wire as partials with documented caveats; one defers.

- L6 Dark One's Own Luck: partial wire. `GrantResource` with max=max(1, CHA-mod), diceSize=10, recharge=longRest tracks the per-LR counter and mirrors the Bardic Inspiration shape. The "spend to add 1d10 to a check or save after seeing the roll" spend mechanic has no dedicated planner — same as Fighter Second Wind ships today (resource tracked, no engine-side spend planner).
- L10 Fiendish Resilience: near wire. `OfferChoice` with 12 options covering every damage type except Force, each granting `GrantResistance` for the chosen type. RAW divergence: the choice fires once at acquire (when='onAcquire'). RAW says the warlock can re-pick the damage type after each short or long rest, but OfferChoice when='onLongRest' is schema-defined yet has no rest-time re-offer mechanism in the engine (level-up just excludes it from the level-up choice list, no replacement trigger fires anywhere else). Using 'onLongRest' would silently never prompt; 'onAcquire' gives a functional one-time pick.
- L14 Hurl Through Hell: `effects: []` (deferred). RAW is "once per turn when you hit, target makes a CHA save against your spell save DC; on fail, 8d10 psychic damage (unless Fiend) and Incapacitated until end of your next turn; once per long rest, restorable by spending a Pact Magic spell slot." `TriggerAction` can't express save-then-conditional-damage-then-condition (its kinds are AddDamage / Heal / ApplyCondition / SpendResource / ModifyDamageTaken / EmitEvent — none accept a save as a gate). Spend-Pact-slot-to-restore also has no recovery primitive.

Tests: 1466 pass, tsc --noEmit clean, snapshot picks up two new wired entries (`fiend-patron L6 dark-ones-own-luck` and `fiend-patron L10 fiendish-resilience`).

**Content authoring: subclass batch 1.5**

Extends the Oath of Devotion (Paladin subclass) entry beyond its L3 row. One of three remaining SRD 5.2.1 features lands as a partial wire (self-immunity only); two defer. Also cleans up one audit-script false positive (L3 Sacred Weapon was flagged as missing but is already wired in the pack as a Custom handler under feature id `sacred-weapon`).

- L7 Aura of Devotion: partial wire. `GrantConditionImmunity { conditionId: "charmed" }` on the paladin captures the self-immunity half ("You [...] have Immunity to the Charmed condition while in your Aura of Protection"). The ally-side aura half ("and your allies have Immunity to the Charmed condition while in your Aura of Protection") needs a new `aura-of-devotion-active` condition added to `conditions[]` plus a `GrantAura` marker on the paladin; the conditions[] array is outside this session's allowed-edit surface. Pattern mirrors the existing L10 Aura of Courage Paladin entry which uses GrantAura + a sibling `aura-of-courage-active` condition for Frightened.
- L15 Smite of Protection: `effects: []` (deferred). RAW triggers off casting Divine Smite, but there's no Divine-Smite-usage trigger event. The "Half Cover" benefit also has no primitive — cover is positional and the engine doesn't model spatial relationships beyond what individual planners encode.
- L20 Holy Nimbus: `effects: []` (deferred). Bonus-action toggle with 10-min duration, once per long rest, restorable by expending a 5th-level slot. Stacks an advantage-on-saves-from-fiends/undead rider, a "radiant damage to enemies starting their turn in the aura" rider, and a sunlight emission. None of these compose cleanly today.

Bonus: audit-doc cleanup. The 41 originally-flagged Layer 4 missing features included Sacred Weapon, which the audit script flagged because the pack uses feature id `sacred-weapon` rather than the name the script was searching for. Sacred Weapon ships fully wired at L3 via a Custom handler. True count corrected to 40.

Tests: 1466 pass, tsc --noEmit clean, snapshot picks up the new `oath-of-devotion L7 aura-of-devotion` wired entry.

**Content authoring: subclass batch 1.4**

Extends the Draconic Sorcery (Sorcerer subclass) entry beyond its L3 row. One of three remaining SRD 5.2.1 features lands as a partial wire (Resistance only); two defer.

- L6 Elemental Affinity: partial wire. `OfferChoice` with 5 options (Acid / Cold / Fire / Lightning / Poison), each granting `GrantResistance` for the chosen damage type. The CHA-damage rider ("when you cast a spell that deals damage of that type, add your Charisma modifier to one damage roll") doesn't wire because `cast-spell.ts` doesn't consult `modifierSum('damage', ...)` against the bearer's effect stack; that flow exists only in `attack.ts` for weapon attacks. Documented in the audit doc; closing the partial requires either extending `cast-spell.ts` to consume damage modifiers or adding a `BoostSpellDamage` primitive parallel to `BoostHealing`.
- L14 Dragon Wings: `effects: []` (deferred). RAW is a bonus-action toggle to gain Fly Speed 60 for 1 hour, once per long rest, restorable by spending 3 Sorcery Points. No fly-buff-with-duration toggle primitive exists, and the spend-other-resource-to-restore recovery shape has no primitive.
- L18 Dragon Companion: `effects: []` (deferred). The "cast Summon Dragon once per long rest without a slot" portion would partially wire via `GrantSpell { preparation: 'oncePerLongRest' }`, but `summon-dragon` isn't in the pack's spell catalog so the reference would dangle. The no-material-component and optional-concentration-removal riders have no primitive either.

Tests: 1466 pass, tsc --noEmit clean, snapshot picks up the new `draconic-sorcery L6 elemental-affinity` wired entry.

**Content authoring: subclass batch 1.3**

Extends the Hunter (Ranger subclass) entry beyond its L3 row. All three remaining SRD 5.2.1 features land as deferred stubs because no honest wire path exists in the current engine vocabulary; documents the engine-primitive gaps in the audit doc.

- L7 Defensive Tactics: `effects: []` (deferred). RAW is a choice between Escape the Horde (OAs against you have Disadvantage) and Multiattack Defense (an attacker that hits you has Disadvantage on their other attacks against you this turn). Escape the Horde needs an OA-flag on `AttackRolled` so a predicate can isolate opportunity attacks; `AttackKindSchema` is `melee | ranged` only, and the OA planner emits a vanilla `AttackRolled`. Multiattack Defense needs a new condition (`multiattack-defense-active`) plus `SetAdvantageVsSource`, but the conditions[] array is outside the subclass-session edit surface.
- L11 Superior Hunter's Prey: `effects: []` (deferred). RAW is "once per turn when you deal damage to a creature marked by your Hunter's Mark, you can also deal that spell's extra damage to a different creature within 30 ft." No predicate gates on the target being the Hunter's-Mark source (needs an "event.targetIsMyHuntersMarkTarget" path), and `TriggerAction` has no "emit damage to a second chosen target" action.
- L15 Superior Hunter's Defense: `effects: []` (deferred). RAW is a reaction granting Resistance to the damage type just taken (and any other damage of that type until end of turn). `TriggerAction` has no way to read the triggering event's damage type and pass it as a parameter to a follow-up `GrantResistance` effect.

No engine code changed; no test snapshots moved.

**Content authoring: subclass batch 1.2**

Extends the Path of the Berserker (Barbarian subclass) entry beyond its L3 row. All three remaining SRD 5.2.1 features land as deferred stubs because no honest wire path exists in the current engine vocabulary. Documents the gaps in [docs/srd-5.2.1-audit-classes.md](docs/srd-5.2.1-audit-classes.md) so future engine slices know exactly what primitives unblock these.

- L6 Mindless Rage: `effects: []` (deferred). RAW gates Charmed / Frightened immunity on "while Rage is active." Rage is currently modeled as a resource counter only, with no rage-active condition or predicate path. Unconditional `GrantConditionImmunity` would be wrong.
- L10 Retaliation: `effects: []` (deferred). RAW is a reaction to make a melee attack against a creature within 5 ft that damaged you. TriggerAction vocabulary has no "make an attack" action (kinds: AddDamage / AddDamageToAttacker / Heal / ApplyCondition / ApplyConditionToAttacker / SpendResource / ModifyDamageTaken / EmitEvent). No per-attacker range predicate either.
- L14 Intimidating Presence: `effects: []` (deferred). Bonus-action emanation-save primitive doesn't exist, and the "spend a use of Rage to restore the feature" recovery shape has no primitive.

No engine code changed; no test snapshots moved (pure-stub additions don't trip the wired-features catalog).

**Content authoring: subclass batch 1.1**

Extends the Champion (Fighter subclass) entry beyond its L3 row, adding all four remaining SRD 5.2.1 features. Two ship wired and two ship as deferred stubs with audit-doc reasons. Closes 2 of the 41 Layer 4 entries in [docs/srd-5.2.1-audit-classes.md](docs/srd-5.2.1-audit-classes.md), 2 deferred-with-reason.

- L7 Additional Fighting Style: wired via `OfferChoice` mirroring the L1 Fighter choice (six options: Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting), separate `choiceId` (`fighting-style-champion-l7`) so it doesn't collide with the L1 selection.
- L10 Heroic Warrior: ships `effects: []` (deferred). Needs a `HeroicInspiration` tracker on character state plus a turn-start trigger that grants it if absent. Not in current engine vocabulary.
- L15 Superior Critical: wired via `ExpandCritRange` with threshold 18 (same shape as L3 Improved Critical's threshold 19).
- L18 Survivor: ships `effects: []` (deferred). Defy Death needs a death-save-advantage primitive and a "natural N counts as 20" promotion primitive; Heroic Rally needs a Bloodied predicate plus a conditional recurring heal at turn start. None in current engine vocabulary.

**Distribution: drop npm-publish posture (slice 198)**

Earlier alpha versions (alpha.0 through alpha.5) were unpublished from npm in May 2026 on IP-cleanup grounds (the older starter-pack snapshots carried non-SRD monsters / spells / items that were caught and removed across slices 141-151 but still shipped in the published tarballs). The package will not be republished. Mechanical changes:

- `package.json`: added `"private": true` to gate `npm publish` from accidentally running. Removed `prepublish:check`, `prepublishOnly`, and `release` scripts plus `publishConfig`. Kept `main` / `module` / `types` / `exports` / `files` so consumers cloning the repo and depending on it via `github:greghcarr/dnd-srd-engine` get a clean resolver path.
- `README.md`: "Quick start" + "Install" sections replaced with git-clone instructions; `Slice 36` history entry rewritten ("build packaging" rather than "npm publish prep"). `npm install dnd-srd-engine@alpha` references removed.
- `CLAUDE.md`: first-paragraph "Published on npm as `dnd-srd-engine`" line replaced with a note that the package is now repo-only with `private: true`. The old "All three names aligned on 2026-05-12" line is gone (only two names — local dir + GitHub repo — apply now).
- `VERSIONING.md`: "Publish workflow" section renamed to "Release workflow" and rewritten; `npm run release` / `prepublishOnly` references replaced with a tag-and-push flow. Concrete-next-bumps table notes the alpha.0 and alpha.5 entries as originally-published-then-unpublished.
- `docs/getting-started.md`: install section switched to a `package.json` git-ref snippet.
- `docs/web-demo-plan.md`: risk table and history note no longer reference `npm install dnd-srd-engine@latest`.
- `dndbnb/README.md`: subtitle link points at GitHub instead of npmjs.com.

Tests: 1466 pass, tsc --noEmit clean, `npm run build` green.

**Docs: rollup pass (slice 197)**

Updates README + SRD-audit docs + trustworthiness roadmap to reflect the slice 177-196 sweep and the lane-B/lane-C merges. No content or engine changes; documentation only.

- README: test count 1471 to 1466, file count 203 to 205; monster row 111 to 181; weapons / armors / tools / gear row updated to current counts (39 weapons + 13 armors + 37 tools + 77 gear + 42 consumables); the SRD-compliance row references slices 177-196 and slice 195's harness; Layer 11 (SRD drift harness) added to the test infrastructure description.
- All six SRD-audit docs now carry a "Status (as of slice 196)" header pointing at slice 195's [tests/audit/srd-drift.test.ts](tests/audit/srd-drift.test.ts) harness as the canonical re-runnable replacement for the hand-built audit scripts. The classes audit doc additionally records the slice 174-176 resource-pool fixes; the character-creation audit doc records the slice 187 Epic Boon prerequisite fixes.
- Trustworthiness roadmap recalibrated from "post-slice-100" to "post-slice-196". Content-summary line updated with current counts (336 spells / 181 monsters / 330 items / 19 backgrounds / 33 feats / 97 conditions).

Tests: 1466 pass, tsc --noEmit clean.

**Content audit: tool categorization (slice 196)**

Items lane flagged two alpha.5-seed miscategorizations during batches 4.11-4.16 but couldn't fix per the content-lane "don't modify existing entries" rule. Engine session applies the fix:

- thieves-tools: category `artisan` to `other` (SRD 5.2.1 equipment.md line 760, in the "Other Tools" section, not "Artisan's Tools").
- herbalism-kit: category `artisan` to `other` (SRD 5.2.1 equipment.md line 741, also "Other Tools").

The pack's artisan's-tools catalog now matches SRD 5.2.1 exactly: 17/17 entries (Alchemist's, Brewer's, Calligrapher's, Carpenter's, Cartographer's, Cobbler's, Cook's, Glassblower's, Jeweler's, Leatherworker's, Mason's, Painter's, Potter's, Smith's, Tinker's, Weaver's, Woodcarver's). The two reassigned entries join 4 other "Other Tools" entries (Disguise Kit, Forgery Kit, Navigator's Tools, Poisoner's Kit) shipped by items batch 4.13.

Tests: 1466 pass, tsc --noEmit clean.

