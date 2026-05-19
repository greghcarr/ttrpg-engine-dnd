# Changelog archive: slices 201-216 (post-alpha.5, class-feature wirings)

Originally in the `## Unreleased` section of [../../CHANGELOG.md](../../CHANGELOG.md). Moved here in slice 248 to keep the live CHANGELOG under the single-Read ceiling.

This window covers slices 201-216, dominated by class-feature wiring slices (Sorcerer Innate Sorcery, Monk Self-Restoration / Disciplined Survivor / Superior Defense / Empowered Strikes, Paladin's Smite, Hunter L7 Escape the Horde, Life Domain Supreme Healing, Elemental Affinity, Aura Expansion, GrantSpell, subclass spell-list wiring, Divine Order, Primal Order, Bard L20 Words of Creation, Warlock L9 Contact Patron, the deferred-feature inventory).

Order: most-recent first (slice 216 at top, slice 201 at bottom). For more recent slices, see [archive-slices-217-234.md](archive-slices-217-234.md). For older, see [archive-slices-196-200.md](archive-slices-196-200.md).

---

**Docs: deferred-feature inventory (slice 217)**

Docs-only sweep marking the three remaining missing-main-class-features in the SRD 5.2.1 classes audit as deferred-with-reason. Each has a multi-slice prerequisite that needs to ship first; documenting the blockers so future slices know what unblocks them.

- **Cleric L20 Greater Divine Intervention**: needs base Divine Intervention (Cleric L10) as a dedicated planner. RAW L20 just adds Wish to the spell-selection list, so there's nothing to wire on top of an empty base. Prerequisite: ship `planDivineIntervention` (resource consume, optional spell selection from cleric list, 2d4-LR cooldown on success per RAW), then L20 becomes a marker primitive adding Wish to the selectable set.
- **Monk L10 Heightened Focus**: needs Flurry of Blows / Patient Defense / Step of the Wind wired as dedicated planners. All three are content stubs today; Heightened Focus's RAW benefit ("each gains the following benefits") has nothing to extend until they ship.
- **Ranger L17 Precise Hunter**: needs Hunter's Mark (Ranger L1 spell) as a dedicated planner. The spell currently has `mechanicalEffects: []`; no `hunters-mark-active` condition exists on targets with a source link. Precise Hunter's RAW needs a 3-way join (bearer-marker, target-condition, condition.sourceCharacterId === attacker.id). Prerequisite: ship `planHuntersMark`, then add a `GrantAdvantageVsBearersOfMyCondition { conditionId }` marker primitive that the attack planner consults.

Cumulative session-progress: **14 of 17 originally-missing main-class features closed across slices 199-216**. The audit doc reads in full at [docs/srd-5.2.1-audit-classes.md](../../docs/srd-5.2.1-audit-classes.md).

**Content: Bard L20 Words of Creation + Warlock L9 Contact Patron (slice 216)**

Two pure-content GrantSpell wires cashing in slice 212's engine consumer:

- **Bard L20 Words of Creation**: `GrantSpell spellId=power-word-heal preparation=always-prepared`. RAW: "You always have the Power Word Heal spell prepared. When you cast that spell, you can target a second creature with it, if that creature is within 60 feet of the first target." The first arm wires here; the second-target arm stays consumer-driven (the spell planner already accepts multi-target `targetIds: string[]`).
- **Warlock L9 Contact Patron**: `GrantSpell spellId=contact-other-plane preparation=oncePerLongRest`. RAW: "you can cast the Contact Other Plane spell, requiring no spell slot, and you automatically succeed on the spell's saving throw. Once you do so, you can't cast the spell in this way again until you finish a Long Rest." The slot-free cast wires via the `oncePerLongRest` preparation; the auto-succeed-on-save arm stays consumer-driven (the engine doesn't currently force-pass saves keyed on specific feature sources).

Closes two more main-class features. No engine changes; both rely on slice 212's GrantSpell consumer.

Tests: 4-case derive test in [tests/unit/engine/grant-spell-extra-features.test.ts](../../tests/unit/engine/grant-spell-extra-features.test.ts) verifying L20 bard / L19 baseline + L9 warlock / L8 baseline.

**Content: Druid L1 Primal Order (slice 215)**

Mirror of slice 214's Cleric Divine Order, scoped to the druid. 2-option `OfferChoice`:

- **Magician**: `GrantSpell spellId=druidcraft preparation=always-prepared` + two `AddModifier` entries on Arcana / Nature with `max(1, abilityMod WIS)` value. RAW: "You know one extra cantrip from the Druid spell list. In addition, your mystical connection to nature gives you a bonus to your Intelligence (Arcana or Nature) checks. The bonus equals your Wisdom modifier (minimum bonus of +1)."
- **Warden**: `GrantProficiency target=weapon id=martial` + `GrantProficiency target=armor id=medium`. RAW: "Trained for battle, you gain proficiency with Martial weapons and training with Medium armor."

Same Thaumaturge-style compromise on the Magician cantrip — RAW lets the player pick any druid cantrip; the pack hardcodes Druidcraft for simplicity. Future content can swap.

Closes another missing main-class feature in the audit. Pure-content slice; no engine changes.

Tests: 2-case planner test verifying each variant's effect-stack contribution; the Magician test runs end-to-end ability-check showing INT (Arcana / Nature) = 0 + 3 (WIS-mod bonus) = 3 for an INT-10 / WIS-16 druid.

**Content: Cleric L1 Divine Order (slice 214)**

Wires Cleric L1 Divine Order as a 2-option `OfferChoice`:

- **Protector**: `GrantProficiency target=weapon id=martial` + `GrantProficiency target=armor id=heavy`. RAW: "Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor."
- **Thaumaturge**: `GrantSpell spellId=guidance preparation=always-prepared` + two `AddModifier` entries giving `max(1, abilityMod WIS)` on skill checks for Arcana and Religion. RAW: "You know one extra cantrip from the Cleric spell list. In addition, your mystical connection to the divine gives you a bonus to your Intelligence (Arcana or Religion) checks. The bonus equals your Wisdom modifier (minimum of +1)."

Pragmatic compromise on the Thaumaturge "extra cantrip" arm: RAW lets the player pick any cleric cantrip, but the pack hardcodes Guidance for simplicity (avoids a nested OfferChoice pattern that hasn't been verified yet). Future content can swap the cantrip via a follow-up slice that introduces nested choices.

Closes another missing main-class feature in the SRD 5.2.1 classes audit. Pure-content slice; no engine changes. Relies on slice 212's GrantSpell engine consumer (Thaumaturge cantrip) and existing skill-modifier predicate path.

Tests: 2-case planner test in [tests/unit/engine/cleric-divine-order.test.ts](../../tests/unit/engine/cleric-divine-order.test.ts) verifying the resolved Protector and Thaumaturge variants each fold the correct effects into the bearer's effect stack; the Thaumaturge test exercises end-to-end ability-check computation showing INT (Arcana) total = 0 + 3 (WIS mod) = 3 for an INT-10 / WIS-16 cleric.

**Content: subclass spell-list wiring sweep (slice 213)**

Pure-content slice cashing in slice 212's `GrantSpell` consumer. Wires two more subclass L3 spell-list features that had been schema-only:

- **Draconic Sorcery L3 Draconic Spells**: Alter Self, Chromatic Orb, Command, Dragon's Breath (all always-prepared).
- **Fiend Patron L3 Fiend Spells**: Burning Hands, Command, Scorching Ray, Suggestion (all always-prepared).

RAW per-cleric/sorcerer/warlock-level higher tiers (L5+ Sorcerer / L5+ Warlock for these subclasses) are content follow-ups — each tier adds 2 more `GrantSpell` entries at the corresponding subclass `levelGrants[<level>]` row.

Closes 2 more subclass features deferred by subclass batch 1.4 / 1.6.

Tests: 3-case derive test in [tests/unit/engine/subclass-spell-lists.test.ts](../../tests/unit/engine/subclass-spell-lists.test.ts) verifying the accumulator returns the expected spell ids for L3 Draconic Sorcery sorcerer, L3 Fiend Patron warlock, and the no-subclass baseline.

No engine changes; no schema changes.

**Engine: GrantSpell consumer + Life Domain L3 Spells (slice 212)**

Closes one of Lane B's highest-leverage engine gaps: the `GrantSpell` effect primitive existed in the schema but had no engine consumer, so every subclass domain-spell entry was schema-only — Life Domain Spells, Circle of the Land Spells, Draconic Spells, Fiend Spells, Devotion Spells, plus single-spell grants like Bard L20 Words of Creation all sat at `effects: []`.

Plumbing:

- New accumulator collector in [src/effects/builder.ts](../../src/effects/builder.ts): `EffectAccumulator.grantedSpells()` returns the list of `{ spellId, preparation, spellcastingAbility? }` entries from every `GrantSpell` effect on the bearer's effect stack. The builder dispatch case replaces the prior fall-through.
- New derive helper [src/derive/effective-spell-list.ts](../../src/derive/effective-spell-list.ts): `effectiveSpellList(input)` returns the union of `character.preparedSpells`, `character.knownSpells`, and every granted spell id.
- [src/engine/plan/cast-spell.ts](../../src/engine/plan/cast-spell.ts)'s `characterKnowsSpell` now consults `effectiveSpellList` after the direct-list check, so granted spells pass the "does the character know this spell?" gate.

Canonical user wired: Life Domain L3 Life Domain Spells, now shipping 4 always-prepared `GrantSpell` entries (Bless, Cure Wounds, Healing Word, Sanctuary). Closes the L3 Life Domain Spells deferred-stub that subclass batch 1.8 left in the audit doc. The full RAW per-cleric-level list (L5 Aid + Lesser Restoration, L7 Mass Healing Word + Revivify, L9 Aura of Life + Death Ward, L11 Greater Restoration + Mass Cure Wounds) is a follow-up content-only sweep — each higher tier just adds more `GrantSpell` entries at the corresponding cleric-level row.

Future content unlocked at zero engine cost: every other "X Spells" subclass feature (Circle of the Land, Draconic, Fiend, Devotion), Bard L20 Words of Creation (always-prepared Power Word Heal), Cleric L1 Divine Order Thaumaturge cantrip grant, Druid L1 Primal Order Magician cantrip grant, magic-item always-prepared spell lists (Ring of Spell Storing-like patterns), and warlock invocations that grant at-will spell casts.

Tests: 4-case planner test in [tests/unit/engine/grant-spell-consumer.test.ts](../../tests/unit/engine/grant-spell-consumer.test.ts) (accumulator collection, derive union behavior, an L3 Life Domain cleric can cast Cure Wounds without it being in `preparedSpells`, a no-subclass cleric still throws). No new effect kind. EFFECT_KINDS stays at 46.

**Engine: ExpandAuraRange + Paladin L18 Aura Expansion (slice 211)**

Adds the `ExpandAuraRange { addFeet: number }` effect primitive (45 to 46 EFFECT_KINDS). Each entry contributes additively to `EffectAccumulator.auraRangeBonus()`. The engine doesn't auto-project auras (positions are consumer territory), so the primitive is purely a surfaced accumulator value — consumers (dndbnb, VTTs) read it alongside the bearer's `GrantAura` effects to compute effective aura range as `GrantAura.rangeFeet + auraRangeBonus()`.

Canonical user: Paladin L18 Aura Expansion. The L18 entry in [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json) now ships as a single `aura-expansion` feature with `{ kind: 'ExpandAuraRange', addFeet: 20 }`, replacing the prior approach that re-declared `aura-of-protection` and `aura-of-courage` at L18 with `rangeFeet: 30` (relying on `dedupeFeaturesByLatestLevel` to supersede the L6/L10 entries).

**Consumer-visible behavior change**: an L18 paladin's `GrantAura` entries now report `rangeFeet: 10` (the L6/L10 base) rather than 30. Consumers that currently read `aura.rangeFeet` directly need to add `effects.auraRangeBonus()` for the effective range. The mechanical outcome is unchanged (effective range 30 ft); only the surfacing shape moves. Refactor justification: aura definitions stay self-describing about their base range, and future content (DMG magic items, multiclass features, etc.) can layer additional aura-range bonuses for free.

Tests: existing `tests/unit/engine/aura-improvements.test.ts` rewritten to assert the new shape — L6/L10/L18 paladins all see `rangeFeet: 10` on their auras, with `auraRangeBonus()` returning 0 / 0 / 20. New accumulator test in [tests/unit/effects/builder.test.ts](../../tests/unit/effects/builder.test.ts) verifies additive stacking across multiple `ExpandAuraRange` entries.

**Engine: planPaladinsSmite + Paladin L2 Paladin's Smite (slice 210)**

Adds a dedicated planner for Paladin's Smite (the 2024 reframing of Divine Smite as a class feature, not a spell). RAW: "When you hit a creature with a melee weapon or an Unarmed Strike, you can use a Bonus Action to expend a Paladin spell slot to deal Radiant damage to the target, in addition to the weapon's damage. The extra damage is 2d8 plus 1d8 for each spell slot level higher than 1st. The damage increases by 1d8 if the target is an Undead or a Fiend."

The planner ([src/engine/plan/paladins-smite.ts](../../src/engine/plan/paladins-smite.ts)) is invoked by the consumer after a confirmed melee hit. Inputs: `paladinId`, `targetId`, `slotLevel` (1-5, the paladin slot range), `triggeringAttackEventId` (the AttackRolled that landed; the smite's emitted DamageApplied carries this as `causedByEventId`), `targetIsUndeadOrFiend?` (true adds +1d8). Slot availability is computed via `computeAvailableSpellSlots`; bonus action is consumed when invoked on the paladin's turn in an active encounter. The radiant damage is sourced as magical so resistance-qualifier checks (Stoneskin, etc.) treat it correctly. The triggering attack's own damage chain is unaffected; the smite stacks on top via a second DamageApplied event.

Canonical user: Paladin L2 Paladin's Smite, added to [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json) with `{ kind: 'Custom', handlerId: 'paladins-smite' }` to point consumers at the planner.

Tests: 5-case planner test in [tests/unit/engine/plan-paladins-smite.test.ts](../../tests/unit/engine/plan-paladins-smite.test.ts) (slot 1 = 2d8, slot 2 = 3d8, Undead/Fiend +1d8, slot-range throw, no-slot throw). Golden scenario with transcript at [tests/golden/s210-paladins-smite.test.ts](../../tests/golden/s210-paladins-smite.test.ts) walks the hit + smite-on-Undead flow.

No new effect kind; EFFECT_KINDS stays at 45.

**Engine: planSuperiorDefense + Monk L18 Superior Defense (slice 209)**

Adds a dedicated planner for the Monk L18 capstone-tier defensive cooldown. RAW: "As a Bonus Action, you can spend 3 Focus Points to give yourself Resistance to all damage except Force damage for 1 minute."

The planner ([src/engine/plan/superior-defense.ts](../../src/engine/plan/superior-defense.ts)) consumes 3 `ki` (the engine's name for Focus Points), consumes a bonus action when invoked on the actor's turn inside an encounter, and applies the new `superior-defense-active` condition with `expiresOnRound = currentRound + 10` (1 minute = 10 rounds) so the slice-102 turn-end sweep lifts it automatically. Out of encounter the condition stays consumer-managed until commit.

The active condition lives in [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json) and ships 12 `GrantResistance` entries — one per non-Force damage type (acid, bludgeoning, cold, fire, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder). The existing `GrantResistance` primitive composes naturally; no new schema. Conditions count moves from 98 to 99.

Monk L18 Superior Defense in the pack now uses `{ kind: 'Custom', handlerId: 'superior-defense' }` to point consumers at the planner, matching the existing Custom-handler conventions (Stunning Strike, Sacred Weapon, Frenzy, etc.).

Tests: 4-case planner test in [tests/unit/engine/plan-superior-defense.test.ts](../../tests/unit/engine/plan-superior-defense.test.ts) (happy path, insufficient-ki throw, mitigation spot-check against fire / thunder / psychic / force, non-Monk throws via no-ki). Golden scenario with transcript at [tests/golden/s209-superior-defense.test.ts](../../tests/golden/s209-superior-defense.test.ts).

No new effect kind. EFFECT_KINDS stays at 45.

**Content: Ranger L9 Expertise (slice 208)**

Pure-content slice. Wires Ranger L9 Expertise as an `OfferChoice` with 2 selections from the Ranger skill list (animal-handling, athletics, insight, investigation, nature, perception, stealth, survival), each option granting `GrantProficiency { target: 'skill', level: 'expertise' }`. Mirrors the existing Rogue L1 / L6 Expertise pattern.

Closes one of the remaining missing main-class features in [docs/srd-5.2.1-audit-classes.md](../../docs/srd-5.2.1-audit-classes.md) without engine surface (the slice-203 save-derivation fix is what made `GrantProficiency` effects actually compose; skill-side proficiency was already wired).

Tests: 2-case derive test in [tests/unit/derive/ranger-expertise.test.ts](../../tests/unit/derive/ranger-expertise.test.ts) (L8 baseline has no expertise; L9 with resolved choice folds expertise on the two selected skills via the effect stack). No new event, no new primitive, no schema change.

**Engine: GrantUnarmedAsMagical + Monk L6 Empowered Strikes (slice 207)**

Adds the `GrantUnarmedAsMagical` marker primitive (44 to 45 EFFECT_KINDS). RAW Monk L6 Empowered Strikes: "Your Unarmed Strikes count as magical for the purposes of overcoming Resistance and Immunity to nonmagical damage."

Plumbing: `isMagicWeaponAttack` in [src/derive/magicality.ts](../../src/derive/magicality.ts) gains an optional `attackerHasUnarmedAsMagical: boolean` parameter (default false). When the weapon is the synthetic `unarmed-strike` item AND the attacker carries the marker, the helper returns `true`, threading `sourceIsMagical: true` into `mitigateDamage`. Three call sites updated: [src/engine/plan/attack.ts](../../src/engine/plan/attack.ts) and [src/engine/plan/offhand-attack.ts](../../src/engine/plan/offhand-attack.ts) pass the attacker's `effects.hasUnarmedAsMagical()`; [src/engine/triggers/dispatch.ts](../../src/engine/triggers/dispatch.ts)'s `isRiderMagical` builds a thin effect-stack query when the triggering weapon is unarmed-strike so rider damage (e.g. Stunning Strike's poison rider, future class-feature riders) also pierces. weapon-mastery.ts's `isMagicWeaponAttack` call stays default-false (Mastery activations don't apply to unarmed strikes).

Canonical user: Monk L6 Empowered Strikes, added to [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json) with a single `GrantUnarmedAsMagical` effect.

Tests: 2-case planner test in [tests/unit/engine/plan-empowered-strikes.test.ts](../../tests/unit/engine/plan-empowered-strikes.test.ts) (L6 Monk unarmed strike on stoneskinned target: no resistance mitigation; L5 Monk control: damage halved as expected); accumulator marker test in [tests/unit/effects/builder.test.ts](../../tests/unit/effects/builder.test.ts); golden scenario with transcript at [tests/golden/s207-empowered-strikes.test.ts](../../tests/golden/s207-empowered-strikes.test.ts).

**Engine: AttackRolled.isOpportunityAttack flag + Hunter L7 Escape the Horde (slice 206)**

Adds an optional `isOpportunityAttack` boolean to [src/schemas/events/attack.ts](../../src/schemas/events/attack.ts)'s `AttackRolledEvent`. The field is stamped `true` only when the attack flows through `planOpportunityAttack`; regular attacks omit it (treated as `false` by predicates). The flag is also threaded into:

- [src/engine/plan/attack.ts](../../src/engine/plan/attack.ts)'s `attackerFacts` map (so `ImposeDisadvantageOnAttackers` entries with a predicate can gate on OA-ness at attack-roll time).
- [src/engine/triggers/dispatch.ts](../../src/engine/triggers/dispatch.ts)'s `buildEventFacts` (so OnEvent riders can filter triggers on `event.isOpportunityAttack`).

`resolveAttack` gains an optional `isOpportunityAttack?: boolean` input; `planOpportunityAttack` passes `true` when calling `resolveAttack` so the flag flows through one path.

Canonical user: Hunter L7 Defensive Tactics, Escape the Horde arm. The L7 feature now ships as a 2-option OfferChoice. Escape the Horde wires fully via `ImposeDisadvantageOnAttackers` gated on `{ kind: 'eq', path: 'event.isOpportunityAttack', value: true }`. The Multiattack Defense arm remains a deferred-stub (needs a per-attacker turn-bound `multiattack-defense-active` condition + the slice-103 attacker-side condition-applied flow; would unblock as a follow-up slice).

Tests: 4-case planner test in [tests/unit/engine/plan-opportunity-attack-flag.test.ts](../../tests/unit/engine/plan-opportunity-attack-flag.test.ts) (OA stamps the flag; regular attacks don't; Hunter with Escape the Horde rolls OA disadvantage; Hunter with Escape the Horde does NOT impose disadvantage on regular attacks). Golden scenario with transcript at [tests/golden/s206-escape-the-horde.test.ts](../../tests/golden/s206-escape-the-horde.test.ts) walks the OA flow showing the `[disadvantage]` tag on the AttackRolled event.

Pure event-field + predicate-fact slice; no new effect kind. EFFECT_KINDS stays at 44.

**Engine: GrantMaxHealingDice + Life Domain L17 Supreme Healing (slice 205)**

Adds the `GrantMaxHealingDice` marker primitive (43 to 44 EFFECT_KINDS). RAW (SRD 5.2.1): "When you would normally roll one or more dice to restore HP with a spell or Channel Divinity, you don't roll those dice; you use the highest possible value instead."

Wiring lives in cast-spell.ts's heal-mechanic branch: builds the caster's effect stack (already done for `BoostHealing`), checks `hasMaxHealingDice()`, and when true skips `rollDamage` for the healing dice and computes `(parsed.count + bonusDice) * parsed.die + parsed.modifier + castingAbilityMod` directly. Flat modifiers (WIS / CHA mod, Disciple of Life's `+2 + slotLevel`, per-slot upcast scaling) layer on unchanged.

Canonical user: Life Domain L17 Supreme Healing, added to [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json). Closes the third Life Domain deferral that subclass batch 1.8 left in the audit doc (after the `GrantSpell` engine consumer for L3 Life Domain Spells + the Channel-Divinity planner for L3 Preserve Life). Blessed Healer (L6) remains deferred pending HealedEvent.casterId + slot-level surfacing.

Tests: 3-case planner test in [tests/unit/engine/plan-cast-spell-max-healing.test.ts](../../tests/unit/engine/plan-cast-spell-max-healing.test.ts) (L17 cleric heals 23 deterministically at slot 1, 57 at slot 3, L16 cleric without the feature produces sub-max amounts across seeds); accumulator marker test in [tests/unit/effects/builder.test.ts](../../tests/unit/effects/builder.test.ts); golden scenario with transcript at [tests/golden/s205-supreme-healing.test.ts](../../tests/golden/s205-supreme-healing.test.ts) walks the deterministic-max heal.

**Engine: cast-spell damage-modifier effect-stack fold + Elemental Affinity CHA rider (slice 204)**

Threads `EffectAccumulator.modifierSum('damage', {event.damageType})` into both cast-spell paths so `AddModifier { target: 'damage' }` effects on the caster now compose with spell damage. Pre-slice 204 the call existed only in [src/engine/plan/attack.ts](../../src/engine/plan/attack.ts) for weapon attacks; spell damage silently dropped any effect-stack contributions, which is why Draconic Sorcery's Elemental Affinity rider was the canonical "partial-wire, CHA-mod-not-yet-firing" gap recorded in [docs/srd-5.2.1-audit-classes.md](../../docs/srd-5.2.1-audit-classes.md) by subclass batch 1.4.

Two cast-spell branches changed:

- Attack-mechanic path ([src/engine/plan/cast-spell.ts](../../src/engine/plan/cast-spell.ts) `planAttackMechanic`): builds the caster's effect stack once before the per-target loop, queries `modifierSum('damage', new Map([['event.damageType', damageType]]))`, folds the bonus into each target's damage total and surfaces it on the `DamageRoll.modifier` field for transcript readability.
- Save-mechanic path (`planSaveMechanic`): same query, applied once to the spell-wide `rawDamage` since 2024 RAW rolls AOE damage once per spell (not per target).

A consistency touch in [src/engine/plan/attack.ts](../../src/engine/plan/attack.ts) added `event.damageType` (sourced from `weaponDef.damageType`) to the existing damageFacts map so future content that wants per-weapon-damage-type predicates on weapon attacks wires for free; no canonical user today.

Canonical user wired: Draconic Sorcery L6 Elemental Affinity. Each of the 5 OfferChoice options (Acid / Cold / Fire / Lightning / Poison) now ships with both the existing `GrantResistance` for the chosen type AND an `AddModifier { target: 'damage', value: { kind: 'abilityMod', ability: 'CHA' }, condition: { kind: 'eq', path: 'event.damageType', value: <type> } }`. Closes the "partial-wire" annotation in the classes-audit doc.

Future content unlocked at zero engine cost: Evoker L10 Empowered Evocation (+INT-mod to one evocation-damage roll), Tempest Cleric's Wrath of the Storm (+CHA-mod to lightning), Bear / Wolf totem riders, any per-damage-type bonus rider on the caster.

Tests: 3-case planner test in [tests/unit/engine/plan-cast-spell-damage-modifier.test.ts](../../tests/unit/engine/plan-cast-spell-damage-modifier.test.ts) (matching-type attack mechanic adds CHA; mismatched-type does NOT; save-mechanic rolls once with CHA folded in). Golden scenario with transcript at [tests/golden/s204-elemental-affinity.test.ts](../../tests/golden/s204-elemental-affinity.test.ts) walks the choose-fire + cast fire-bolt flow and snapshots the `+4` modifier on the DamageRoll. tsc --noEmit clean.

**Engine: Monk L14 Disciplined Survivor + save-proficiency effect-stack fix (slice 203)**

Ships Monk L14 Disciplined Survivor as four `GrantProficiency { target: 'save' }` effects (CON, INT, WIS, CHA — Monk has STR + DEX from the class baseline). RAW (SRD 5.2.1): "Your physical and mental discipline grant you proficiency in all saving throws."

Wiring the feature surfaced a pre-existing bug: [src/derive/save.ts](../../src/derive/save.ts)'s `isSaveProficient` only consulted the class's baseline `savingThrowProficiencies` and never queried the effect stack. So `GrantProficiency { target: 'save' }` effects were silently dropped on every save resolution. The Rogue L15 Slippery Mind feature (slice 60, WIS + CHA save grant) and any other content using the same shape have been quietly inert since they shipped. Slice 203 fixes `computeSavingThrow` to honor effect-stack proficiency contributions in addition to the class baseline; Slippery Mind now actually grants the WIS + CHA proficiency the pack always claimed it did.

Tests: [tests/unit/derive/disciplined-survivor.test.ts](../../tests/unit/derive/disciplined-survivor.test.ts) carries 4 cases: a Monk L13 baseline check (STR + DEX only proficient), the Monk L14 all-six-proficient check, and a Rogue L14-vs-L15 pair pinning Slippery Mind's WIS + CHA grant so the regression can't return.

Closes another of the missing main-class features in [docs/srd-5.2.1-audit-classes.md](../../docs/srd-5.2.1-audit-classes.md) (~12 remaining after slices 199-203). Pure-content slice + one bug-fix line in the derive layer; no new primitives, no new events.

**Engine: planSelfRestoration + Monk L10 Self-Restoration (slice 202)**

Adds `engine.plan.selfRestoration` for the Monk L10 condition-shed ability plus a `GrantSelfRestoration` marker primitive (42 to 43 EFFECT_KINDS). RAW (SRD 5.2.1): "Through sheer force of will, you can remove one of the following conditions from yourself at the end of each of your turns: Charmed, Frightened, or Poisoned."

The planner enforces the fixed three-condition set (any other id throws), gates on the marker, verifies the bearer currently carries the named condition, then emits a single `ConditionRemoved`. No resource cost, no action cost, no save. The "forgoing food and drink doesn't give Exhaustion" arm of the same feature is consumer-side narrative state (the engine doesn't model food / water).

Canonical user: Monk L10 Self-Restoration, added to [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json). Closes another of the missing main-class features in [docs/srd-5.2.1-audit-classes.md](../../docs/srd-5.2.1-audit-classes.md) (~13 remaining after slices 199-202).

Tests: 5-case planner test in [tests/unit/engine/plan-self-restoration.test.ts](../../tests/unit/engine/plan-self-restoration.test.ts) (charmed-remove, frightened+poisoned-double, out-of-set-throw, not-currently-affected-throw, no-feature-throw); accumulator marker test in [tests/unit/effects/builder.test.ts](../../tests/unit/effects/builder.test.ts); golden scenario with transcript at [tests/golden/s202-self-restoration.test.ts](../../tests/golden/s202-self-restoration.test.ts).

**Engine: planInnateSorcery + Sorcerer L7 Sorcery Incarnate (slice 201)**

Adds an `engine.plan.innateSorcery` planner for activating Innate Sorcery, plus a `GrantInnateSorcerySpendAlternative` marker primitive (41 to 42 EFFECT_KINDS) and a new `innate-sorcery-active` condition. The planner accepts either of two cost paths:

1. **Default**: consume one `innate-sorcery` resource use. Throws when the bearer is out of uses.
2. **Sorcery Incarnate alternative (Sorcerer L7+)**: pass `useSorceryPoints: true`. Gated on the new marker; consumes 2 Sorcery Points instead. Throws on missing marker or insufficient SP.

Both paths consume a bonus action when the planner is invoked inside an active encounter and apply the `innate-sorcery-active` condition, which contributes a static `+1 spell save DC` modifier per RAW.

Two arms of the full Innate Sorcery / Sorcery Incarnate spec are deferred:

- **Advantage on Sorcerer spell attack rolls** (the other half of Innate Sorcery's L1 benefit). Needs an `event.spellSourceClassId` fact in `AttackRolled` events so a predicate-gated SetAdvantage can scope to "attacks from Sorcerer spells." Not blocked by anything else; punted to keep slice 201 focused.
- **Doubled Metamagic options per spell while active** (the second half of Sorcery Incarnate). The current `planMetamagic` records the resource spend but doesn't enforce a once-per-spell limit, so there's no cap for Sorcery Incarnate to lift. A follow-up slice can wire per-spell metamagic tracking and have this condition halve / lift that gate accordingly.

Canonical user: Sorcerer L7 Sorcery Incarnate, added to [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json). Closes another of the missing main-class features in [docs/srd-5.2.1-audit-classes.md](../../docs/srd-5.2.1-audit-classes.md) (~15 to ~14 remaining after slices 199 and 200 closed Elusive and Uncanny Dodge).

Tests: 7-case planner test in [tests/unit/engine/plan-innate-sorcery.test.ts](../../tests/unit/engine/plan-innate-sorcery.test.ts) (default-path, exhausted-throw, SP-path, missing-marker throw, insufficient-SP throw, in / out of encounter); accumulator marker test alongside slices 199 + 200 in [tests/unit/effects/builder.test.ts](../../tests/unit/effects/builder.test.ts); golden scenario with transcript at [tests/golden/s201-sorcery-incarnate.test.ts](../../tests/golden/s201-sorcery-incarnate.test.ts) walks the SP-alternative-cost activation. tsc --noEmit clean.

