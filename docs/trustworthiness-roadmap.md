# Trustworthiness Roadmap

What it would take for `ttrpg-engine-dnd` to be safely usable for an unsupervised tabletop session against 5.5e (2024) rules. This is a planning doc, not a marketing one — it's intentionally pessimistic about the current state so the prioritization stays honest.

The doc is structured as four tiers. Each tier is a precondition for the next. The current state of the engine sits **inside Tier 1** (some Tier-1 work is done, most isn't).

Last calibrated: 2026-05-14, against working-tree commit on the `web-demo` line of work, post-`0.1.0-alpha.4`.

---

## What "trustworthy" means here

A working definition, in three sentences. **The engine is trustworthy** when (a) every rule it claims to enforce, it actually enforces; (b) every content entry in the shipped pack has matching engine behavior; (c) a DM who knows 5e/5.5e can run a session without watching the engine for rules cheats. None of those are true today.

The corresponding non-goals: this doc does not target homebrew system support, optional variant rules (sanity / mass combat / hero points are out unless explicitly toggled on), or third-party content packs.

---

## Current state honest summary

- **17 known RAW violations**, 10 🔴 / 4 🟡 / 3 ⚪. Documented in [README.md](../README.md) under "Known gaps → Engine gaps." Audit file: [tests/audit/raw-compliance.test.ts](../tests/audit/raw-compliance.test.ts).
- **The audit covers 17 rules out of hundreds.** Every adversarial probe we've run so far has found at least one bug. There's no reason to believe that pattern stops at the current floor.
- **Content slice ≪ SRD.** 36 of 48 class features at L1–5 are wired (12 stubs), 12 of ~50 subclasses, ~26 of ~370 spells, 9 of hundreds of magic items, 6 of hundreds of monster statblocks. Documented in [README.md](../README.md) under "Content gaps."
- **"Wired" has meant content-side wiring, not RAW-side enforcement.** The Paralyzed condition is wired (effect stack reads it for advantage on attackers); but no planner stops a paralyzed actor from swinging a longsword. Same pattern likely lurks in other "wired" entries we haven't probed.

The takeaway: alpha is alpha for these reasons, not just for API instability.

---

## Tier 1: Close every documented RAW gap

**Goal:** every row in [README.md](../README.md) "Engine gaps" tables either fixed or explicitly marked as deferred. Audit at [tests/audit/raw-compliance.test.ts](../tests/audit/raw-compliance.test.ts) runs all green.

**Why this is first:** these are violations a player notices in their first session. Fixing them is the absolute precondition for "alpha is usable for play, with adult supervision."

**Scope (17 items):**

| Cluster | Severity | Item count | Fix shape |
|---|---|---|---|
| Conditions inert on actor | 🔴 | 9 | `assertActorCanAct(state, combatantId)` helper threaded through `planAttack`, `planMove`, `planDodge`, `planDash`, `planCastSpell`, `planOffHandAttack`. Treats `unconscious` / `incapacitated` / `stunned` / `paralyzed` / `petrified` as full action blocks. `Restrained` / `Grappled` zero out speed in `planMove`. |
| Movement-driven OAs | 🔴 | 1 | Either richer return shape on `planMove` (`{ events, opportunities: OpportunityAvailable[] }`) or an additional event type the demo + tests can subscribe to. Consumers then dispatch `planOpportunityAttack` per opportunity. |
| Concentration on HP=0 | 🔴 | 1 | `DamageApplied` reducer inline-calls the concentration-clear path when `character.hp.current` lands at 0. Removes the need for the consumer to call `planCheckConcentration` for the obvious case. |
| Reaction cap | 🟡 | 1 | `planShield`, `planCounterspell`, and any other reactive-spell planner check `turnUsage.reactionUsedThisRound` and emit `ActionEconomyConsumed('reaction')`. |
| Stand-from-prone | 🟡 | 1 | Clearing the `prone` condition during the actor's turn drains `turnUsage.feetMovedThisTurn` by `floor(speed / 2)`. |
| Misty Step occupancy | 🟡 | 1 | Drop the `// consumer's responsibility` comment in `planMistyStep`; add the same blocker scan `planMove` got. |
| Ranged in melee disadvantage | 🟡 | 1 | `planAttack` checks: if `attackKind === 'ranged'` AND there's a living, non-incapacitated hostile within 5 ft of attacker, force disadvantage. |
| Variant rules (deferred) | ⚪ | 2 | `CampaignSettings.sanity` and `CampaignSettings.massCombat` stay inert until their dedicated slices land (Slice 46). Document as known. |

Each fix lands with a regression test that lifts the corresponding `it()` in [tests/audit/raw-compliance.test.ts](../tests/audit/raw-compliance.test.ts) from ✗ to ✓.

**Cluster A is the single highest-leverage piece of work in the entire engine right now.** One helper closes nine 🔴s.

**Definition of done for Tier 1:**
- All 17 audit rows pass.
- Every fix has a paired regression test outside the audit file (the audit is the high-level check; per-fix tests pin behavior).
- README "Engine gaps" tables are emptied (or rows marked "✓ fixed in commit ###").
- CHANGELOG entry summarizing the sweep.

---

## Tier 2: Extend the audit until it actually probes RAW

**Goal:** the audit goes from "17 curated probes" to "categorical coverage of the rules an engine of this scope claims to enforce."

**Why this is second:** Tier 1 closes what we know about. The audit's current 17-rule scope was *me* picking the most likely-broken targets. The reason a Tier 1 sweep alone isn't enough is that we have no statistical reason to believe other categories are clean.

**Categories named but not yet probed:**

| Category | Probe shape | Expected outcome | Effort |
|---|---|---|---|
| Frightened can't willingly move closer to source | Apply Frightened with a recorded source; attempt `planMove` toward that source; expect reject | Likely broken — engine doesn't model condition-source attribution per source-id | Medium (needs source-tracking on conditions) |
| Charmed can't attack the charmer | Apply Charmed with charmer-id; attempt `planAttack` against charmer; expect reject | Likely broken — same source-tracking story | Medium |
| Two-weapon fighting: light + light only | Equip non-light off-hand; attempt `planOffHandAttack`; expect reject | Unknown — `planOffHandAttack` exists but I haven't read its weapon-property check | Small |
| Multiattack target legality | At L5+ Fighter, attempt sequential attacks across mixed targets and types; verify per-RAW restrictions | Likely some gaps | Medium |
| Heavy weapon Small disadvantage | Build a Small character, equip a heavy weapon, attack; expect disadvantage flag | Likely broken | Small |
| Loading property | Use a crossbow in multiattack; expect at most one shot per Attack action | Likely broken (engine doesn't track per-weapon loading state) | Small |
| Cover bonuses | Position attacker with target behind half / three-quarters cover; expect +2 / +5 AC on the resolution | Likely not modeled at all (no cover field in encounter geometry) | Large (schema change) |
| Difficult terrain 2× cost | Build encounter map with difficult-terrain cells; `planMove` through them; expect doubled cost | `movementCostFor` exists; `planMove` likely doesn't consult it | Medium |
| Death save nat-1 = 2 fails | Force RNG to roll a 1 on a death save; expect failure count +2 | Probably wired (the reducer code path is well-tested in isolation); needs an `it()` for catastrophic regression catch | Small |
| Auto-crit within 5 ft of Unconscious | Same as paralyzed-auto-crit probe, but with `unconscious` condition | Likely correct (Unconscious includes Paralyzed-equivalent attack-side effects) | Small |
| Cast a spell (action) then Attack | Confirm `actionUsed` check fires the same way Dodge → Attack does | Probably correct (same `actionUsed` flag) | Small |
| Concentration CON save on damage | Damage a concentrating caster; expect a `SaveRolled` event for the CON save | Likely the consumer is supposed to call `planCheckConcentration` themselves; verify | Medium |
| Movement totalling > speed without Dash | Sequential `planMove` calls that together exceed speed; expect second to reject | Probably correct (the `feetMovedThisTurn` flag) | Small |
| Spell range enforcement | Cast a spell at a target beyond `spell.range`; expect reject | Spotty — `planMistyStep` checks; `planCastSpell` for arbitrary spells likely doesn't | Medium |
| Spellcaster ability rules at multiclass boundaries | Multi-class wizard + cleric; verify spell-attack mod is per-class | Probably correct (`computeSpellAttackBonus` takes classId); needs `it()` for regression | Small |
| Slot consumption matches level cast | Cast Magic Missile at slot level 1, then again with no slots available; expect reject | Probably correct (planCastSpell guards); needs `it()` | Small |
| Concurrent concentration ends prior one | Cast Bless, then Hold Person; expect Bless to end with `ConcentrationBroken(replaced)` | Probably correct (`planCastSpell` clears prior); needs `it()` | Small |
| Attunement cap (3 items max) | Attune a 4th item; expect reject | Probably correct (`MAX_ATTUNED_ITEMS = 3` constant exists); needs `it()` | Small |
| Exhaustion progression and effects | Apply exhaustion 1–6 sequentially; verify d20-test penalty and HP-max halve at level 4 | 2024 exhaustion math is unique; engine likely partial | Medium |
| Encumbrance thresholds | Load a character past their carry capacity; verify speed-reduced flag | Unknown — `carryCapacity` derivation exists, encumbrance enforcement does not | Medium |
| Death save threshold (HP > 0 prevents) | Heal a dying actor mid-turn; expect death-save chain to stop | Probably correct; needs `it()` | Small |
| Massive damage instant death | Damage a 12 HP actor for 36 in one event; expect `dead` flag set, not just unconscious | Probably correct (`hp.maxBonus` was a fix related to this); needs `it()` | Small |
| Two-handed conflicts with shield | Equip a versatile two-handed weapon while shield is equipped; verify hand state | Probably broken (no hand-arbitration logic that I've seen) | Medium |
| Sneak Attack eligibility | Roll Sneak Attack damage with no advantage AND no adjacent ally; expect rejection | Almost certainly broken — content sets `effects: [...]` but I doubt eligibility is gated | Medium |
| Reckless Attack timing | Activate at start of Barbarian turn; verify mutual advantage/disadvantage on attacks for the turn | Stub per content table; out of scope until that's wired | Out of scope |
| Stunning Strike trigger | Activate after a Monk hit; verify save chain | Stub; out of scope | Out of scope |

**Effort tier roughly:** ~30 new probes, ~3-5 lines each plus some shared setup helpers. Expect 30-50% to expose new bugs based on Tier 1 hit rate.

**Definition of done for Tier 2:**
- Every category in the table above either has a probe (✓ or ✗) or is explicitly marked "out of scope, content stub."
- The audit's "scope of audit" caveat in the README narrows substantially.
- Newly-discovered ✗ items get added to README "Engine gaps" *and* fixed (Tier 1 sweep applied again).

---

## Tier 3: Fill the content stubs

**Goal:** every "stub" row in [README.md](../README.md) "Content gaps" → Classes table → "Stubs (engine work not yet done)" gets engine support, and the content entries get full effect lists.

**The named stubs (all closed):**

- ~~Druidic~~ ✓ wired — `GrantProficiency target:'language' id:'druidic'` + `computeKnownLanguages` derivation
- ~~Improved Critical~~ ✓ wired — new `ExpandCritRange { threshold }` primitive; `resolveAttack` consults attacker's effect stack
- ~~Slow Fall~~ ✓ wired — `FallingIntent.useSlowFall` flag; `planFalling` reduces by 5×monk-level, consumes reaction in encounters
- ~~Martial Arts die scaling~~ ✓ wired — `applyMartialArtsDieScaling` helper; new `unarmed-strike` weapon; main + off-hand attack paths swap to MA die when larger
- ~~Jack of All Trades~~ ✓ wired — new `GrantHalfProficiencyBonusFloor` primitive; `computeAbilityCheck` applies floor(profBonus/2) when no explicit prof contribution lands
- ~~Sacred Weapon~~ ✓ wired — new `engine.plan.sacredWeapon` planner; spends Channel Divinity charge + applies `sacred-weapon-active` condition (+3 attack bonus, static)
- ~~Disciple of Life~~ ✓ wired — new `BoostHealing` primitive; `planHealMechanic` adds `flat + perSpellLevel * slotLevel` to heals at slot 1+
- ~~Reckless Attack timing~~ ✓ wired — `engine.plan.recklessAttack` planner + `RecklessAttackActivated` event; turnUsage flag persists until next TurnStarted
- ~~Stunning Strike~~ ✓ wired — `engine.plan.stunningStrike` + new `StunningStrikeAttempted` event; CON save vs DC 8+WIS+prof, stunned-on-fail, once per turn
- ~~Frenzy~~ ✓ wired (minimal) — `engine.plan.frenzy` spends Rage charge + applies `frenzied` condition; bonus-action attack grant + end-of-rage exhaustion are consumer-driven until Rage gets a planner slice
- ~~Evasion~~ ✓ wired — new `GrantEvasion` primitive; `planCastSpell` save-mechanic path flips to (success → 0, fail → half) on DEX saves vs halves-on-success spells
- ~~Cutting Words~~ ✓ wired — `engine.plan.cuttingWords` returns `{events, dieRoll, preventedHit}`; consumer adjudicates trailing chain (same pattern as Shield)
- ~~Metamagic~~ ✓ wired (resource economy) — `engine.plan.metamagic` spends the right sorcery-point cost per option; per-option spell modifications are deferred
- ~~Fighting Style choice~~ ✓ wired — Fighter L1 / Paladin L2 / Ranger L2 ship `OfferChoice` with style options; Archery/Defense/Dueling have effects, GWF/Protection/Two-Weapon remain placeholders

Some of these need new effect primitives (Cutting Words needs reactive-debuff, Stunning Strike needs save-DC-on-hit, Reckless Attack needs symmetric-advantage flag). Others need only the `OfferChoice` plumbing finished. The README has more detail per item.

**Effort:** medium per item, large in aggregate. Each one is a focused mini-slice with its own tests and regression coverage.

**Why this is Tier 3:** these features only matter once players are choosing them. A campaign of L1–4 fighters and wizards using only generic actions doesn't hit any of these. But a Rogue at L7 (Evasion) or a Monk at L5 (Stunning Strike) does, and shipping with these as stubs would be embarrassing.

**Definition of done for Tier 3:**
- All 14 named class-feature stubs wired with effects + tests.
- Class-features matrix is **48 wired / 0 stub** at L1–7. The 14 named Tier 3 stubs PLUS the three remaining class-feature placeholders (Feral Instinct, Deft Explorer, Wild Companion) are all closed.
- The feature-coverage matrix in [tests/coverage/features.test.ts](../tests/coverage/features.test.ts) asserts no stubs remain.

---

## Tier 4: Replace the starter pack with the actual SRD

**Goal:** ship `ttrpg-engine-dnd-srd-2024` (Slice 31 from the original plan, never done) as a separate package that supersedes the starter pack.

**What that means:**

- All 12 classes at L1–20 with full feature progression (currently L1–5 only).
- Subclasses: 3–4 per class (currently 1).
- Spells: ~370 (currently ~33).
- Magic items: the DMG curated list (currently 9).
- Monster statblocks: the MM curated list (currently 6).
- Backgrounds, feats, species: full PHB 2024 inventories.
- Bastions (the 2024 stronghold system; Slice 44 from Phase E).
- Epic boons past L20.

This is **mostly content authoring, not engine work** — assuming Tiers 1–3 are in place. The engine has the schemas and primitives; the work is JSON.

**Effort:** the largest tier by raw volume. Months of disciplined authoring work, or significant content reuse from the official SRD 5.5e release once Wizards publishes it.

**Why this is Tier 4:** consumers can ship apps before Tier 4 if they bring their own content. A family-DM tool like `dndbnb` doesn't need the full DMG magic item list to start. But "the engine is SRD-compliant" requires this tier.

**Definition of done for Tier 4:**
- `ttrpg-engine-dnd-srd-2024` published to npm with full PHB / DMG / MM 2024 coverage (or as close as legal-cleared content allows).
- Engine starter pack stays as a "demo" pack; SRD pack is the canonical one.
- A real campaign at L1–L20 can be loaded and played without engine-side feature gaps.

---

## Minimum-viable-trust subset

For a kitchen-table game with a DM watching (the dndbnb use case), the minimum is:

- **All Tier 1.** Non-negotiable. The current 17 violations are session-breakers.
- **Tier 2 categories that affect basic combat:** ranged-in-melee disadvantage (already in Tier 1), cover bonuses, difficult terrain, sneak attack eligibility, two-weapon fighting eligibility, multiattack target legality.
- **Tier 3 features actually in use by the playing party.** If nobody is playing a Monk, Stunning Strike can stay stub.
- **Tier 4 not required.** Bring-your-own-content is fine; the family-DM authoring custom content is a legitimate path.

That's the realistic "alpha-but-actually-usable" target. Estimated work: weeks, not months — but only if Tier 1 happens first as a single sweep.

---

## Risks and caveats

- **Per-fix scope creep.** It is tempting to bundle a fix with adjacent cleanup. Don't — Tier 1 sweep should be tight, one cluster per commit, with tests that pin the exact behavior.
- **Audit blind spots.** The audit catches what its `it()`s probe. Categories nobody thinks to write a probe for stay broken silently. The "scope of audit" caveat in the README is the lasting record; resist the urge to declare the audit "complete."
- **Demo / engine seam.** Some Tier 1 fixes change the planner contract (OAs in `planMove`'s return). Web demo + any existing consumer will need matching changes. Coordinate the seam break with an explicit CHANGELOG note and a version bump.
- **2024 rule churn.** The 2024 rules are still bedding in (third-party errata, ruling clarifications). What looks like a RAW violation today may be a clarification target tomorrow. Pin sources where possible (PHB page / errata version).

---

## How to use this doc

If you're prioritizing a session of work:

1. Open [tests/audit/raw-compliance.test.ts](../tests/audit/raw-compliance.test.ts).
2. Pick a failing `it()`.
3. Find the fix shape in this doc's Tier 1 table.
4. Implement + paired regression test.
5. Lift the audit row from ✗ to ✓.
6. Update [README.md](../README.md)'s "Engine gaps" tables to either remove the row or mark it ✓ with a commit hash.

Tier 2 work proceeds the same way, against the audit-extension table.

Tier 3 work is README-driven: pick a stub row from the class-features inventory, wire it, write tests, flip the matrix.

Tier 4 is its own package; defer until Tier 3 is closed.
