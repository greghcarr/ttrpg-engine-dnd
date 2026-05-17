// Slice 107 — Sanctuary as a dedicated reaction-style planner.
//
// 1. `engine.plan.sanctuaryWardSave({ attackerId, wardedCharacterId })`
//    rolls the attacker's WIS save against the sanctuary caster's
//    spell DC and emits `SaveRolled` + (on failure) `SanctuaryProtected`.
// 2. The `sanctuary-active` condition lifts via an OnEvent rider
//    (consumeOnTrigger) when the bearer makes an attack roll.
// 3. The planner throws if the warded creature isn't actually warded,
//    or if the source caster is missing.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId, newAppliedConditionId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';
import type { SanctuaryProtectedEvent } from '../../../src/schemas/events/reactive-spells.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { ULID } from '../../../src/engine/ids-utils.js';

const PACK = loadStarterPack();

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const buildCleric = (wisdom = 18): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Iris',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 12, CON: 14, INT: 10, WIS: wisdom, CHA: 10 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: [],
    preparedSpells: ['sanctuary'],
  });

const buildWardedAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Warded Ally',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 10, CON: 12, INT: 16, WIS: 14, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
  });

const buildLowWisAttacker = (sword: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Brute',
    speciesId: 'human',
    backgroundId: 'soldier',
    // WIS 6 → -2 mod, biased toward failing the WIS save against a
    // cleric's DC.
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 8, WIS: 6, CHA: 8 },
    hp: { current: 44, max: 44, temp: 0 },
    featsTaken: ['savage-attacker'],
    inventory: [sword],
    equipped: { mainHand: sword, attuned: [] },
  });

const buildHighWisAttacker = (sword: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Sage Warrior',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level: 10, hitDiceRemaining: 10 }],
    abilityScores: { STR: 14, DEX: 16, CON: 14, INT: 12, WIS: 20, CHA: 10 },
    hp: { current: 70, max: 70, temp: 0 },
    featsTaken: ['savage-attacker'],
    inventory: [sword],
    equipped: { mainHand: sword, attuned: [] },
  });

const seedWardedScene = (
  cleric: Character,
  ally: Character,
  attacker: Character,
  sword: ItemInstance,
  name: string,
  seed = 1,
) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  let campaign: Campaign = engine.createCampaign({ name });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: ally.id as ULID,
      conditionId: 'sanctuary-active',
      appliedConditionId: newAppliedConditionId(),
      sourceCharacterId: cleric.id as ULID,
    } satisfies ConditionAppliedEvent,
  ]);
  return { engine, campaign };
};

describe('Sanctuary ward save', () => {
  it('low-WIS attacker fails the save: emits SaveRolled + SanctuaryProtected; prevented=true', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const sword = longsword();
      const cleric = buildCleric(18);
      const ally = buildWardedAlly();
      const attacker = buildLowWisAttacker(sword.id);
      const { engine, campaign } = seedWardedScene(cleric, ally, attacker, sword, `sanc-low-${seed}`, seed);
      const outcome = engine.plan.sanctuaryWardSave(campaign.state, {
        attackerId: attacker.id,
        wardedCharacterId: ally.id,
      });
      const save = outcome.events.find((e): e is SaveRolledEvent => e.type === 'SaveRolled');
      expect(save).toBeDefined();
      if (save!.success) continue; // walk seeds until we find a failure
      expect(outcome.prevented).toBe(true);
      const protectedEvent = outcome.events.find(
        (e): e is SanctuaryProtectedEvent => e.type === 'SanctuaryProtected',
      );
      expect(protectedEvent).toBeDefined();
      expect(protectedEvent!.attackerId).toBe(attacker.id);
      expect(protectedEvent!.wardedCharacterId).toBe(ally.id);
      expect(protectedEvent!.triggeringSaveEventId).toBe(save!.id);
      return;
    }
    throw new Error('no seed produced a failed Sanctuary save');
  });

  it('high-WIS attacker passes the save: SaveRolled only, prevented=false, no SanctuaryProtected', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const sword = longsword();
      const cleric = buildCleric(18);
      const ally = buildWardedAlly();
      const attacker = buildHighWisAttacker(sword.id);
      const { engine, campaign } = seedWardedScene(cleric, ally, attacker, sword, `sanc-high-${seed}`, seed);
      const outcome = engine.plan.sanctuaryWardSave(campaign.state, {
        attackerId: attacker.id,
        wardedCharacterId: ally.id,
      });
      const save = outcome.events.find((e): e is SaveRolledEvent => e.type === 'SaveRolled');
      expect(save).toBeDefined();
      if (!save!.success) continue; // walk seeds until we find a success
      expect(outcome.prevented).toBe(false);
      const protectedEvent = outcome.events.find((e) => e.type === 'SanctuaryProtected');
      expect(protectedEvent).toBeUndefined();
      return;
    }
    throw new Error('no seed produced a successful Sanctuary save');
  });

  it('throws when the named warded creature has no sanctuary-active condition', () => {
    const sword = longsword();
    const cleric = buildCleric();
    const ally = buildWardedAlly();
    const attacker = buildLowWisAttacker(sword.id);
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    let campaign: Campaign = engine.createCampaign({ name: 'sanc-throw' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
      // No ConditionApplied for sanctuary-active.
    ]);
    expect(() =>
      engine.plan.sanctuaryWardSave(campaign.state, {
        attackerId: attacker.id,
        wardedCharacterId: ally.id,
      }),
    ).toThrow(/Sanctuary/i);
  });
});

describe('Sanctuary self-end on bearer attack', () => {
  it('OnEvent rider lifts sanctuary-active when the bearer makes an attack roll', () => {
    // Walk seeds for any attack outcome (hit or miss) — the rider
    // fires on attackerIsSelf alone, no hit filter, since "makes an
    // attack roll" per RAW ends the spell regardless of outcome.
    for (let seed = 1; seed < 30; seed += 1) {
      const sword = longsword();
      const cleric = buildCleric();
      const wardedBearer: Character = {
        ...buildLowWisAttacker(sword.id),
        // Override name + give the bearer the sanctuary buff so we can
        // observe it lifting after they attack.
        name: 'Warded Attacker',
        appliedConditions: [
          {
            id: newAppliedConditionId(),
            conditionId: 'sanctuary-active',
            sourceEventId: 'seed-event-id' as ReturnType<typeof newAppliedConditionId>,
            sourceCharacterId: cleric.id as ReturnType<typeof newCharacterId>,
          },
        ],
      };
      const target = buildWardedAlly();
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = engine.createCampaign({ name: `sanc-self-end-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wardedBearer } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      expect(
        campaign.state.characters[wardedBearer.id]!.appliedConditions.some(
          (c) => c.conditionId === 'sanctuary-active',
        ),
      ).toBe(true);
      const attackEvents = engine.plan.attack(campaign.state, {
        attackerId: wardedBearer.id,
        targetId: target.id,
        weaponInstanceId: sword.id,
      }).events;
      const rolled = attackEvents.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (rolled === undefined) continue;
      campaign = commit(campaign, attackEvents);
      expect(
        campaign.state.characters[wardedBearer.id]!.appliedConditions.some(
          (c) => c.conditionId === 'sanctuary-active',
        ),
      ).toBe(false);
      return;
    }
    throw new Error('no seed produced an AttackRolled for sanctuary self-end test');
  });
});
