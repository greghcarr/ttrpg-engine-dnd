# Changelog archive: slices 235-240 (post-alpha.5, ConsumeItem + UseItem era)

These entries were originally in the `## Unreleased` section of [../../CHANGELOG.md](../../CHANGELOG.md). They were moved here in slice 248 to keep the live CHANGELOG under the single-Read ceiling.

This window covers the ConsumeItem / UseItem planner introduction and the consumable-wiring sweep that followed it (slice 235 introduced `ConsumeItem`; slice 240 introduced `UseItem`).

Order: most-recent first (slice 240 at top, slice 235 at bottom). For more recent slices (241+), see the live [CHANGELOG.md](../../CHANGELOG.md). For older slices, see the sibling archives in this directory.

---

**Engine: `UseItem` planner + Wings of Flying canonical user (slice 240)**

Adds the magic-item activate-as-action sibling of slice 235's `ConsumeItem`. Where ConsumeItem retires the instance (potions, scrolls), UseItem persists the instance and consumes 1 charge from the definition's existing `charges` shape. Canonical user: Wings of Flying (rare wondrous, attunement; 1/dawn charge; activates `flying-active`).

**Plumbing**:

- New `UseAction` discriminated union in [src/schemas/content/item.ts](../../src/schemas/content/item.ts) — `ApplyCondition { conditionId }` for slice 240; future slices add `CastSpell` (for Hat of Disguise / Helm of Telepathy / Decanter of Endless Water) and `Toggle` (for Boots of Speed's click-on / click-off shape).
- New `onUse: UseAction[]` field on `MagicItemSchema`, parallel to `onConsume` on `ConsumableSchema`.
- New `ItemUsed` event in [src/schemas/events/inventory.ts](../../src/schemas/events/inventory.ts): `{ characterId, instanceId, definitionId, targetId }`. Mirrors `ItemConsumed`'s shape; reducer just sanity-checks (the actual state changes — charge decrement, condition application — are emitted by separate events ahead of this one).
- `applyItemUsed` reducer in [src/engine/reducers/inventory.ts](../../src/engine/reducers/inventory.ts). Wired into [src/engine/apply.ts](../../src/engine/apply.ts).
- New [src/engine/plan/use-item.ts](../../src/engine/plan/use-item.ts) with `planUseItem`. Validates the instance + inventory + magic-item kind, emits `ItemChargeConsumed` if the definition has charges (gating on `chargesRemaining >= 1`), walks the `onUse` action list emitting the corresponding effects (`ConditionApplied` for `ApplyCondition` variants), then emits `ItemUsed`.
- `engine.plan.useItem(state, intent)` on the [Engine](../../src/engine/index.ts) interface, parallel to `engine.plan.consumeItem`.

**Content wired (1 magic item)**:

- **Wings of Flying** — `charges: { max: 1, recharge: 'dawn' }` + `onUse: [{ kind: 'ApplyCondition', conditionId: 'flying-active' }]`. RAW shape: bonus action → gain fly speed for 1 hour, once per dawn. The fly speed mechanic itself rides on the existing `flying-active` condition (60 ft fixed; same condition the Fly spell + Potion of Flying use).

**RAW deviations to be tightened later**:

- No action-economy cost (the planner doesn't model the bonus-action consumption — same shape as ConsumeItem's lack of Magic-action consumption).
- No attunement gate (Wings of Flying RAW requires attunement; the engine has attunement state but the planner doesn't check it).
- Duration consumer-managed (RAW: 1 hour; the engine's auto-expiry is round-based, so the consumer removes `flying-active` when the in-fiction hour passes — same shape as the slice-236 / 239 ApplyCondition wires).
- Fly speed uses the fixed-60-ft `flying-active`, not the RAW per-creature walking-speed. Same condition the Fly spell + Potion of Flying use; same approximation.
- Wings of Flying RAW says "If you're still flying when the duration expires, you descend at a rate of 30 feet per round until you land." Not modeled — the engine doesn't track height.

**Future SRD users this unblocks** (each one shipping as a pure-JSON wiring once the matching `UseAction` variant lands):

- **Boots of Speed** — needs a `Toggle` variant for the click-on / click-off shape, plus a cumulative time-budget mechanic that doesn't exist today.
- **Boots of Levitation** — needs `CastSpell` variant (item casts Levitate on the wearer at will).
- **Cloak of the Bat** — needs `CastSpell` + the deferred light-level predicate (see slice 227 deferred backlog row).
- **Hat of Disguise**, **Helm of Telepathy**, **Decanter of Endless Water** — `CastSpell` variant for at-will / charged spell-grant items.
- **Pearl of Power**, **Pipes of Haunting**, **Wind Fan**, **Circlet of Blasting** — `CastSpell` plus the existing `charges` shape (already in-pack).

Pre-commit Uncle Bob audit:
- Names: `UseAction` / `planUseItem` / `ItemUsed` mirror `ConsumeAction` / `planConsumeItem` / `ItemConsumed`. The split is deliberate: consume retires, use persists.
- DRY: `ApplyCondition`'s emit shape (`ConditionApplied` with `sourceCharacterId = user`) is identical to the slice-236 consume path. The schemas are separated because the future variant sets diverge (Heal makes sense on consume, not on use; Toggle makes sense on use, not on consume).
- SRP: planner does one thing per action kind; reducer just sanity-checks (the actual state mutation is in the upstream ItemChargeConsumed + ConditionApplied reducers).
- Magic numbers: charges-cost is hardcoded to 1 per use. Items with per-use cost > 1 (e.g. Gem of Brightness's 5-charge cone) will need a per-action `chargesCost?: number` extension later; deferred until a real second user lands.
- `at`-timestamp threading: single `at = intent.at ?? nowIso()` resolved once, passed through to every emitted event in the chain (same pattern as planConsumeItem).
- Tests: 6 unit cases asserting the resolution chain shape, charge spend, instance persistence after commit, charges-out error path, non-inventory error path, non-magic-item error path, and the multi-target seam (use-on-ally). No RNG → no RNG-capture test needed; no golden scenario added (matches the slice-235 ConsumeItem precedent for deterministic-planner slices).

**Content: consumable-pack wiring sweep on existing ConsumeAction variants (slice 239)**

Pure content sweep with no engine changes. Walks the 33 still-empty `onConsume` arrays on consumables in [src/content/packs/starter-pack.json](../../src/content/packs/starter-pack.json) and wires the 14 that map cleanly onto the existing three `ConsumeAction` variants (`Heal` from slice 235, `ApplyCondition` from slice 236, `CastSpell` from slice 237). 6 new content-side conditions added (Giant Strength potion family) — each wraps the slice-229 `OverrideAbilityScore` floor-semantic primitive in a temporary condition for use via `ApplyCondition`.

**Content wired (14 consumables)**:

ApplyCondition (existing conditions, no new content):

- **Potion of Growth** → `enlarged-active`
- **Potion of Diminution** → `reduced-active`
- **Potion of Invisibility** → `invisible` (the RAW condition)
- **Potion of Flying** → `flying-active`
- **Potion of Speed** → `hasted-active`
- **Oil of Slipperiness** → `freedom-of-movement-active`

ApplyCondition (six new conditions added in this slice, each carrying `OverrideAbilityScore { ability: 'STR', value: N }`):

- **Potion of Hill Giant Strength** → `hill-giant-strength-potion-active` (STR 21)
- **Potion of Stone Giant Strength** → `stone-giant-strength-potion-active` (STR 23)
- **Potion of Frost Giant Strength** → `frost-giant-strength-potion-active` (STR 23)
- **Potion of Fire Giant Strength** → `fire-giant-strength-potion-active` (STR 25)
- **Potion of Cloud Giant Strength** → `cloud-giant-strength-potion-active` (STR 27)
- **Potion of Storm Giant Strength** → `storm-giant-strength-potion-active` (STR 29)

CastSpell (schema-only target spells; the cast records `SpellCastDeclared` for journal / replay but no mechanical chain fires):

- **Potion of Animal Friendship** → `CastSpell animal-friendship 1 wizard`
- **Potion of Mind Reading** → `CastSpell detect-thoughts 2 wizard`

**RAW deviations documented on the wired entries**:

- Duration always consumer-managed (engine's auto-expiry is round-based; potion durations are minute / hour-based per RAW). Same shape as the slice-236 wires.
- Potion of Flying uses the fixed-60-ft `flying-active` condition, but RAW gives flying speed equal to the consumer's walking speed. Same condition as the `fly` spell.
- Potion of Invisibility doesn't enforce the RAW "ends on attack or spell" clause. Same deferral as the `invisibility` spell.
- CastSpell potions use `castingClassId: 'wizard'` for parity with scroll wirings; the engine computes DC / attack from the consumer's INT, not the RAW fixed DC 13. Same deferral as scrolls.
- Giant Strength potions apply the same `OverrideAbilityScore` floor as the matching Belt items: when the consumer's STR is already at or above the target, the condition is still applied (RAW says "no effect") but the floor < base means the base wins — no functional change.

**Deferred (need a primitive or shape this slice doesn't add)**:

- **Potion of Heroism** — needs a flat-temp-HP `ConsumeAction` variant + a Bless-style condition; partial wire via `heroic-active` would over-grant the recurring temp HP from slice 79.
- **Potion of Resistance** — needs the chooser-at-creation variant pattern (already in the deferred-primitives backlog).
- **Potion of Fire Breath** — needs an Attack / AoE `ConsumeAction` variant.
- **Potion of Poison** — needs a save + damage + condition combined action.
- **Potion of Vitality** — needs a multi-condition-remove `ConsumeAction` variant.
- **Antitoxin** — needs a per-source `SetAdvantage` predicate (advantage on saves vs Poisoned), same shape as the deferred Mantle of Spell Resistance row.
- **Oil of Sharpness** — needs an ItemBuff `ConsumeAction` variant (parallel to `planElementalWeapon`'s item-buff mechanic).
- **Holy Water**, **Acid**, **Alchemist's Fire** — need a thrown-attack `ConsumeAction` variant.
- **Ball Bearings**, **Caltrops** — need a terrain-placement action.
- **Oil** — multi-use item (thrown, poured), not a single onConsume action.
- **Poison Basic** — ItemBuff + on-hit rider (apply-poison-to-weapon).
- **Perfume** — needs a skill-discriminated `SetAdvantage` (advantage on Persuasion checks specifically).
- **Spell Scroll of Misty Step**, **Spell Scroll of Wish** — already documented in slice 237 (dedicated-planner spells need a scroll-to-planner dispatch layer).

**Future SRD users this unblocks**: any future consumable whose effect maps to a single existing condition or a CastSpell. The slice-235/236/237 plumbing handles them as pure JSON edits.

Pre-commit Uncle Bob audit:
- No engine code touched. Pure JSON sweep + new content-side conditions reusing the slice-229 primitive.
- Names: Giant Strength conditions follow the `{type}-giant-strength-potion-active` convention to disambiguate from the permanent Belt items.
- DRY: each Giant Strength condition wraps a single `OverrideAbilityScore` effect, the same primitive that Belt of X Giant Strength uses on its permanent `effects` array. No new effect kinds.
- SRP: each new condition carries exactly one ability override.
- Magic numbers: STR values (21 / 23 / 23 / 25 / 27 / 29) are SRD-derived (the matching Giant CR ladder).
- Mechanical outcomes asserted: condition lands on the consumer, OverrideAbilityScore floor folds through `buildEffectStack`, RAW "no effect if already higher" preserved via the floor semantics.

Tests: 4 new cases in [tests/unit/engine/plan-consume-item.test.ts](../../tests/unit/engine/plan-consume-item.test.ts) — Potion of Hill Giant Strength applies the STR floor through `buildEffectStack`; a consumer with STR 22 sees no functional change; Potion of Invisibility lands the `invisible` condition; Potion of Mind Reading emits SpellCastDeclared for the schema-only Detect Thoughts spell. 14 total cases in the file.

**Content: `CastSpell` consume-action + spell-scroll wires (slice 237)**

Extends slice 235's ConsumeAction union with `CastSpell { spellId, slotLevel, castingClassId? }`. The planner branch delegates to `planCastSpell` with slice-219's `noSlotCost: true` + slice-220's `ignorePreparation: true` — the scroll supplies the slot, the scroll-knowledge bypasses the prepared-spells gate. Single small primitive that builds entirely on existing foundations.

**Content wired (6 scrolls)**:

- **Spell Scroll of Fire Bolt** (Cantrip, Common) → `CastSpell fire-bolt 0 wizard`
- **Spell Scroll of Magic Missile** (L1, Common) → `CastSpell magic-missile 1 wizard`
- **Spell Scroll of Fireball** (L3, Uncommon) → `CastSpell fireball 3 wizard`
- **Spell Scroll of Greater Invisibility** (L4, Rare) → `CastSpell greater-invisibility 4 wizard`
- **Spell Scroll of Cone of Cold** (L5, Rare) → `CastSpell cone-of-cold 5 wizard`
- **Spell Scroll of Disintegrate** (L6, Very Rare) → `CastSpell disintegrate 6 wizard`

The `castingClassId: 'wizard'` field lets non-caster classes (Barbarian, Fighter, Rogue) actually use scrolls — without it, planCastSpell's `findCastingClass` throws since the consumer has no spellcasting class.

**Deferred (dedicated-planner scrolls)**:

- **Spell Scroll of Misty Step** — Misty Step has a dedicated `planMistyStep` (action-economy + slot-source-prefer + teleport-occupancy validation). The CastSpell action delegates to planCastSpell, which doesn't route to dedicated planners. Would need a scroll-to-planner dispatch layer.
- **Spell Scroll of Wish** — same shape; planWish is dedicated.

**RAW deviations to be tightened later**:

- Scroll's pre-baked DC / attack-bonus not used (the engine uses the consumer's stats, not the scroll's printed +5 / DC 13 / etc.).
- Non-class-list reader check (DC 10 + spell level INT/WIS) not enforced — any character with the scroll in inventory can read it.

**Future SRD users this unblocks**: any future spell scrolls that aren't dedicated-planner spells. Author-time it's just `[{ kind: 'CastSpell', spellId, slotLevel, castingClassId }]`.

Pre-commit Uncle Bob audit:
- Names: `CastSpell` mirrors slice 235/236's ConsumeAction shape.
- DRY: planner delegates to the existing `planCastSpell` with established flags from slices 219 + 220. No new code paths.
- SRP: one new branch in the per-action loop. Schema entry. Content wires. Each does one thing.
- Magic numbers: spell IDs + slot levels are SRD-derived (the scroll's printed level).
- `castingClassId` field added when the test exposed the non-caster gap; documented in schema. Not added speculatively.
- Mechanical outcomes asserted: `SpellCastDeclared` fires, no `SpellSlotConsumed`, Barbarian (non-caster) doesn't throw.

Tests: 2 new cases in [tests/unit/engine/plan-consume-item.test.ts](../../tests/unit/engine/plan-consume-item.test.ts) covering Magic Missile scroll happy path + Fireball scroll usable by a non-caster Barbarian. 1622 pass, 208 skipped. tsc clean.

**Content: `ApplyCondition` consume-action + buff-potion wires (slice 236)**

Extends slice 235's `ConsumeAction` union with `ApplyCondition { conditionId }`. The planner now dispatches on the new kind by emitting `ConditionApplied` (with `sourceCharacterId` set to the consumer so the condition can be traced back to who drank or fed the potion). Unblocks the buff-potion cohort.

**Plumbing**:

- New `ApplyCondition` variant on `ConsumeActionSchema` in [src/schemas/content/item.ts](../../src/schemas/content/item.ts).
- `planConsumeItem` extended with the `ApplyCondition` branch — emits ConditionApplied per action, ends with ItemConsumed.

**Content wired**:

- **Potion of Climbing** → `ApplyCondition spider-climbing-active` (reuses the existing condition's `ModifySpeed climb set 30`).
- **Potion of Water Breathing** → `ApplyCondition water-breathing-active` (new narrative-only condition; engine doesn't model breathing mechanics so the condition is a tag).
- **Water Breathing spell** (L3 Transmutation) — same condition, wired with the existing `buff` spell mechanic. The spell had been schema-only since alpha.5; now applies the same condition the potion does.

**Future SRD users this unblocks** (content-only follow-ups, no engine work needed): Potion of Speed (existing `haste` condition), Potion of Heroism (compose `heroic-active` + temp HP), Potion of Invisibility (existing `invisible` condition), Potion of Flying (needs a `flying-active` condition similar to Spider Climbing).

**Documented deferrals**: minute/hour potion durations are still consumer-managed (engine's auto-expiry primitive from slices 102/109 is round-based and source-keyed; doesn't fit potion timing today).

Pre-commit Uncle Bob audit:
- Names: `ApplyCondition` mirrors the existing TriggerAction shape but lives in a separate union (different semantic, different unions).
- DRY: condition definitions are reused — Potion of Climbing piggybacks on `spider-climbing-active` (same effect set as Spider Climb the spell). Water Breathing spell + potion share the new `water-breathing-active`.
- SRP: planner branch is one if-else case in the same per-action loop.
- Magic numbers: none added.

Tests: 2 new cases in [tests/unit/engine/plan-consume-item.test.ts](../../tests/unit/engine/plan-consume-item.test.ts) — Potion of Climbing applies `spider-climbing-active` with consumer as source; Potion of Water Breathing applies `water-breathing-active` after commit. Updated spell-coverage expectations for Water Breathing from `'skip'` to `'buff'`. 1620 pass, 208 skipped. tsc clean.

**Engine: `ConsumeItem` planner + Potions of Healing wired (slice 235)**

The single biggest single-slice leverage move for SRD mechanical depth: consumables now consume. The engine had heal / save / buff effects implemented but no mechanism to actually fire them from inventory. This slice adds the missing primitive.

**Plumbing**:

- New `ConsumeAction` discriminated union in [src/schemas/content/item.ts](../../src/schemas/content/item.ts). Distinct from `Effect` (passive grants) and `TriggerAction` (event-fired): consumption is a deliberate consumer-initiated act with its own semantic. Starts with one action kind, `Heal { dice?, flatAmount? }`. Future entries will add `ApplyCondition` (buff potions: Climbing, Resistance, Heroism) and `CastSpell` (spell scrolls, spell-storing potions).
- `ConsumableSchema.onConsume` retyped from `EffectSchema[]` to `ConsumeActionSchema[]`. No existing pack entries had non-empty arrays so no migration needed.
- New `ItemConsumed` event in [src/schemas/events/inventory.ts](../../src/schemas/events/inventory.ts) carrying `characterId / instanceId / definitionId / targetId`.
- New `applyItemConsumed` reducer: removes the instance from the consumer's inventory and from `state.itemInstances`. Wired into [src/engine/apply.ts](../../src/engine/apply.ts).
- New `planConsumeItem` planner in [src/engine/plan/consume-item.ts](../../src/engine/plan/consume-item.ts). Validates the instance is in inventory + the definition is `itemKind: 'consumable'`, walks `onConsume` actions emitting one event per action (Healed for Heal), ends with the ItemConsumed event. Exposed via `engine.plan.consumeItem({ characterId, instanceId, targetId? })`.
- Transcript formatter extended with an `ItemConsumed` case.

**Content wired (4 canonical users — Potions of Healing table)**:

| Item | Rarity | onConsume |
|---|---|---|
| Potion of Healing | Common | `Heal 2d4+2` |
| Potion of Greater Healing | Uncommon | `Heal 4d4+4` |
| Potion of Superior Healing | Rare | `Heal 8d4+8` |
| Potion of Supreme Healing | Very Rare | `Heal 10d4+20` (also retyped from `magic` to `consumable`) |

**Side cleanup (Belt of *Giant Strength rarity drift)**: closes the slice-229 backlog row. Pack rarities now match SRD 5.2.1 exactly:

- Belt of Hill Giant Strength: rare → **uncommon**
- Belt of Stone / Frost Giant Strength: very-rare → **rare**
- Belt of Fire Giant Strength: very-rare → **rare**
- Belt of Cloud Giant Strength: legendary → **very-rare**
- Belt of Storm Giant Strength: legendary (unchanged)

The drift audit's name-lookup logic doesn't catch variant-unrolled entries that don't match the SRD parent name; flagged in the backlog under "Audit: variant-unroll rarity validation."

**RAW deviations to be tightened later**:

- No action-economy cost (RAW: drinking a potion is a Magic action in combat).
- No range check when `targetId !== characterId` (engine doesn't model position).

**Future SRD users this unblocks**: every consumable in the pack that has a heal mechanic. The next slice can extend `ConsumeAction` with `ApplyCondition` to wire Potion of Climbing / Heroism / Resistance / Speed / etc., and again with `CastSpell` to wire the spell-scroll family.

Pre-commit Uncle Bob audit:
- Names: ConsumeItem / ConsumeAction / planConsumeItem / ItemConsumed all descriptive.
- DRY: `onConsume` action shape is purpose-built (not overloading Effect or TriggerAction). Different semantic, different union.
- SRP: schema / event / reducer / planner / engine surface — each does one thing.
- Magic numbers: heal dice all SRD-derived (Potions of Healing table).
- Tests assert mechanical outcomes (heal amount in expected range, instance retirement, throw conditions).

Tests: 6-case planner test in [tests/unit/engine/plan-consume-item.test.ts](../../tests/unit/engine/plan-consume-item.test.ts) covering Healing potion happy path, Supreme variant range, instance retirement post-commit, feed-to-ally targeting, inventory-validation throw, wrong-kind-rejection throw. 1617 pass, 209 skipped. tsc clean.

