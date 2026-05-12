# dnd-engine

[![CI](https://github.com/greghcarr/dnd-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/greghcarr/dnd-engine/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange)](README.md#status)

A standalone, event-sourced TypeScript domain engine for Dungeons & Dragons 5.5e (the 2024 rules update).

If you are building a D&D character sheet, encounter tracker, virtual tabletop, automation tool, or AI dungeon master and you do not want to reimplement the rules engine from scratch, this is for you.

## Why this engine

- **Built for accuracy first.** Full mechanical coverage of the 2024 Player's Handbook, Dungeon Master's Guide, and Monster Manual is the explicit goal. Every printed class, subclass, species, background, feat, spell, weapon, armor, magic item, condition, and monster statblock can be expressed.
- **No content, no IP problems.** The library ships schemas and an engine. It does not ship any rulebook text or statblocks. You bring your own content packs (built from the SRD 5.2 or your own homebrew), and the engine validates and runs them.
- **Event-sourced, fully deterministic replay.** Every state change is an event. A captured event log replays to byte-identical state across machines. Undo and redo are free.
- **Plan/commit split.** All randomness is consumed inside `engine.plan(intent)` and baked into resolution events. `apply()` is pure and replay never re-rolls dice. This is the architectural foundation that makes multiplayer sync, save files, and audit logs work correctly.
- **Effect-primitive vocabulary plus escape hatch.** About 25 declarative primitives express the bulk of 5.5e features as pure data; a `CustomEffect` code-handler hook covers genuinely-procedural exotica (Wild Shape, Wish, Simulacrum) and table-specific houserules.
- **Library-quality.** TypeScript strict mode. Zod validation at boundaries. Immer-backed reducers, immutable externally. ESM and CJS builds. Zero peer-dependency conflicts.
- **Living transcripts.** Every golden test emits a human-readable markdown transcript of its event log, checked into [tests/golden/transcripts/](tests/golden/transcripts/). Every PR that changes engine behavior shows the transcript diff alongside the code. See [the showcase transcript](tests/golden/transcripts/showcase.transcript.md) for a representative narrative: a three-PC party fights two goblins, one drops to 0, a death save lands, a paladin heals, fight ends, party rests.

## Architecture

- **Event-sourced.** State changes are events. `apply(state, event) -> state` is pure. Replay any campaign from its event log.
- **Plan/commit split.** RNG is consumed only inside `engine.plan(intent)`. Resolution events carry baked rolls, so `apply()` is deterministic. Replay never re-rolls.
- **Effect-primitive vocabulary.** Features (class features, feats, magic item powers, conditions) are described via a fixed vocabulary of about 25 effect primitives. Wild Shape, Polymorph, Wish, Simulacrum and a handful of others drop to code handlers.
- **Schema-only.** The library ships shapes (`Character`, `Spell`, `MagicItem`, `MonsterStatblock`, etc.) and the engine that operates on them. Consumers load rules content from their own JSON content packs.
- **Branded IDs + ULIDs.** `CharacterId`, `SpellId`, `ItemDefinitionId` versus `ItemInstanceId`, etc. Backed by ULIDs (lexicographically sortable by time).
- **PendingChoice protocol.** Deferred player decisions (ASI vs feat, fighting style selection, spell target selection) are first-class events in the log.
- **Zod for validation, Immer for clean reducers, Vitest for tests.**

## Architecture

- **Event-sourced.** State changes are events. `apply(state, event) -> state` is pure. Replay any campaign from its event log.
- **Plan/commit split.** RNG is consumed only inside `engine.plan(intent)`. Resolution events carry baked rolls, so `apply()` is deterministic. Replay never re-rolls.
- **Effect-primitive vocabulary.** Features (class features, feats, magic item powers, conditions) are described via a fixed vocabulary of about 25 effect primitives. Wild Shape, Polymorph, Wish, Simulacrum and a handful of others drop to code handlers.
- **Schema-only.** The library ships shapes (`Character`, `Spell`, `MagicItem`, `MonsterStatblock`, etc.) and the engine that operates on them. Consumers load rules content from their own JSON content packs. This keeps the IP story clean.
- **Branded IDs + ULIDs.** `CharacterId`, `SpellId`, `ItemDefinitionId` versus `ItemInstanceId`, etc. Backed by ULIDs (lexicographically sortable by time).
- **Zod for validation, Immer for clean reducers, Vitest for tests.**

## Status

**Pre-alpha.** Foundation plus eight slices complete, about 61% of the full mechanical coverage goal. Engine compiles, builds (ESM + CJS + `.d.ts`), and ships 339 tests across 48 files.

Completed:

- **Slice 1.** Character creation, HP, damage, healing, temp HP, hit dice, short / long rest, exhaustion, conditions, death saves, stabilize.
- **Slice 2.** Combat resolution chain (`AttackDeclared` -> `AttackRolled` -> `DamageRolled` -> `DamageApplied`) with RNG-captured d20 + damage dice, advantage / disadvantage, critical hits, full encounter lifecycle (create, roll initiative, start, turn / round, end), item acquisition.
- **Slice 3.** Level-up flow with RNG-captured HP rolls (roll or average strategy), `PendingChoice` resolution protocol for deferred decisions (ASI vs feat, fighting style, subclass selection, spell selection). Resolved-choice effects feed into derivations.
- **Slice 4.** `plan.save`, `plan.abilityCheck` (with optional skill), record-only `SaveRolled` / `AbilityCheckRolled` resolution events. Honors caller-supplied advantage or derives it from the effect stack. Skill checks apply half / proficient / expertise multipliers. `computeAbilityCheck` + `computePassiveScore` derivations.
- **Slice 5.** Spellcasting. `plan.castSpell` handles cantrips and leveled spells; dispatches per-target attack / save / heal mechanics through the existing resolution chains; consumes standard or pact slots (auto-picks pact when both apply); upcasting via `extraDicePerSlotLevel`. `SpellCastDeclared`, `SpellSlotConsumed`, `PactSlotConsumed` events. Long rest restores all slots, short rest restores pact slots only. `computeAvailableSpellSlots` derivation.
- **Slice 6.** Concentration enforcement. `EffectInstance` table tracks active spell effects with their applied conditions; concentration spells emit `ConcentrationStarted` and set `Character.concentrationEffectId`. `plan.checkConcentration(characterId, damage)` rolls a CON save with DC `max(10, floor(damage/2))`, emits `ConcentrationBroken` on failure which auto-removes every condition the effect installed. Casting a new concentration spell while already concentrating evicts the prior effect. `formatEvent` covers the new events so transcripts narrate concentration lifecycle.
- **Slice 7.** OnEvent trigger system. The dispatcher walks every character's effect stack after each triggering event, evaluates the `Predicate` filter against event facts (`event.attackerIsSelf`, `event.hit`, `event.used`, `event.critical`), checks cadence (`oncePer: 'turn' | 'round' | 'shortRest' | 'longRest'`), and fires `AddDamage` actions producing rider events. `TriggerFired` event marks usage; `Character.triggerCounters` tracks per-cadence state. `TurnStarted` / `RoundEnded` / `ShortRestEnded` / `LongRestEnded` reducers reset the appropriate counters. Wired into `planAttack`. Test pack now has a Rogue with Sneak Attack as the canonical OnEvent feature.
- **Slice 8.** Action economy. `Combatant.turnUsage: { actionUsed, bonusActionUsed, attacksMadeThisTurn, reactionUsedThisRound }` tracks per-turn usage. `ActionEconomyConsumed` event marks consumption; reducer enforces "can't double-use the Action" / "can't double-use the Bonus Action" / "can't double-use the Reaction this round" invariants. `TurnStarted` resets per-turn fields for the active combatant; `RoundEnded` resets `reactionUsedThisRound` for everyone. `computeActionEconomyBudget` derivation reads `ModifyActionEconomy` effects to determine `maxAttacksPerAction` (Extra Attack), `extraActionsPerTurn` (Action Surge), `extraBonusActionsPerTurn`. `planAttack` enforces the attack budget when the attacker is the active combatant in an active encounter; out-of-combat attacks are unmetered. Golden scenario demonstrates Fighter L1 throwing on a second attack and Fighter L5 attacking twice per Action.

## Roadmap

Three phases, 22 slices total. About 15 to 25 hours of focused execution time.

### Phase A: Engine mechanics (12 slices, 8 done)

Each slice lands a load-bearing combat or rules mechanic. Order is dependency-driven. Slices 1 to 8 listed under Status above; the rest below.
- 8. **Action economy.** Action / bonus action / reaction tracking. Extra Attack enforcement. Multiattack. Action Surge. Two-weapon fighting.
- 9. **Reactions protocol** (next). Reaction-window events that pause turn flow. Opportunity attacks, Counterspell, Shield, Hellish Rebuke. Action Surge and two-weapon fighting follow.
- 10. **Movement and positioning.** Speed in feet, difficult terrain, dash / disengage / hide, jumping, climbing, swimming, distance tracking for reach and ranged.
- 11. **Damage mitigation order of operations.** Vulnerability -> resistance -> immunity layered correctly. Absorb Elements, Heavy Armor Master, Uncanny Dodge integration.
- 12. **Inventory mechanics.** Attunement enforcement (max 3), carrying capacity, encumbrance, donning / doffing armor, weapon draw / stow, two-handed grip.
- 13. **NPC / Creature as first-class combatants.** `Creature` distinct from PC `Character`: multiattack, legendary actions, lair actions, regional effects.
- 14. **Environmental hazards.** Falling, suffocation, drowning, poison and disease tracks, lighting effects (disadvantage in dim, etc.), cover (half, three-quarters, total).
- 15. **Conditions library.** Full mechanical implementation of all 15 2024 conditions (blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, plus the 2024 single-track exhaustion).
- 16. **Spellcasting polish.** Area shapes (cone / cube / line / sphere / cylinder) for spell targeting. Ritual casting path. Cantrip damage scaling at character levels 5 / 11 / 17. Always-prepared spells from class features (Cleric domains, Warlock patron spells).

### Phase B: Full state schemas (4 slices)

- 17. **Party + currency + shared inventory + treasure ledger.**
- 18. **Session + journal + DM notes + in-game time.**
- 19. **Quest + objectives + rewards.**
- 20. **Location + NPC + travel + foraging.**

### Phase C: 2024 content pack (6 slices)

These are heavy on data, light on engine code. Each class slice stress-tests Phase A.

- 21. **Classes group 1.** Barbarian, Bard, Cleric, Druid (1-20, all subclasses).
- 22. **Classes group 2.** Fighter, Monk, Paladin, Ranger.
- 23. **Classes group 3.** Rogue, Sorcerer, Warlock, Wizard.
- 24. **All ~370 spells** (primitives where possible, code handlers for Wish / Simulacrum / Polymorph / etc.).
- 25. **Species + backgrounds + feats + fighting styles + equipment + tools.**
- 26. **Magic items (DMG) + monster statblocks (MM, full or curated subset).**

### What "perfect" cannot mean

5.5e explicitly delegates some rulings to the DM: improvised actions, narrative consequences, table houserules, ambiguous spell interactions that even Sage Advice has issued multiple clarifications on. A rules engine cannot adjudicate these. The `CustomEffect` code-handler escape hatch is the explicit spot for table-specific rulings. After Phase A + B + C the engine covers ~95% of the printed mechanics by surface area; the rest is documented as DM-discretion territory.

## Install

```
npm install dnd-engine
```

Or, while pre-alpha, link from a sibling directory:

```jsonc
// in your consumer's package.json
"dependencies": {
  "dnd-engine": "file:../dnd-engine"
}
```

## Usage (preview)

```ts
import {
  createEngine,
  loadContentPack,
  seededRNG,
} from 'dnd-engine';
import myContent from './my-content-pack.json';

const engine = createEngine({
  contentPacks: [loadContentPack(myContent)],
  rng: seededRNG(42),
});

let campaign = engine.createCampaign({ name: 'home game' });
// commit CharacterCreated + ItemAcquired events, then:

// melee attack
campaign = engine.commit(campaign, engine.plan.attack(campaign.state, {
  attackerId: alyx.id,
  targetId: goblin.id,
  weaponInstanceId: longsword.id,
}).events);

// cast a spell
campaign = engine.commit(campaign, engine.plan.castSpell(campaign.state, {
  characterId: wizard.id,
  spellId: 'fireball',
  slotLevel: 3,
  targetIds: [goblin1.id, goblin2.id, goblin3.id],
}).events);

// level up with a rolled HP gain
campaign = engine.commit(campaign, engine.plan.levelUp(campaign.state, {
  characterId: alyx.id,
  classId: 'fighter',
  hpStrategy: 'roll',
}).events);

// derive a character sheet (effective AC, saves, spell slots, etc.)
const sheet = engine.derive.character(campaign.state, alyx.id);
// sheet.ac, sheet.savingThrows, sheet.spellSlots, etc.
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for the dev workflow and [CLAUDE.md](CLAUDE.md) for conventions.

## Intellectual property

This library is original work. It contains zero text, statblocks, or content from the Wizards of the Coast D&D 5.5e rulebooks. The schemas describe the *shape* of D&D content (a spell has a level, a school, a list of mechanical effects) but no copyrighted content.

D&D content is published by Wizards of the Coast. The 2024 SRD (System Reference Document) is released under Creative Commons CC BY 4.0; portions of older 5e content are available under the OGL 1.0a. If you build a content pack to load into this engine, your pack is subject to those licenses, not this library's license. This library does not ship, distribute, or endorse any specific content pack.

Dungeons & Dragons is a trademark of Wizards of the Coast LLC. This project is not affiliated with or endorsed by Wizards of the Coast.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The architecture is locked (see [CLAUDE.md](CLAUDE.md)); contributions that fit within it are very welcome. Open an issue before a large change.

## License

[MIT](LICENSE). Copyright (c) 2026 Greg Carr.
