import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId, newAppliedConditionId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const buildWarrior = (name: string, longswordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [longswordId],
    equipped: { mainHand: longswordId, attuned: [] },
  });

const buildSoftTarget = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 10, CON: 12, INT: 18, WIS: 14, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

const setupCursedScene = (seed: number) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const sword = longsword();
  const cursor = buildSoftTarget('Cursor');
  const warrior = buildWarrior('Bearer', sword.id);
  const bystander = buildSoftTarget('Bystander');
  let campaign: Campaign = engine.createCampaign({ name: `vs-source-${seed}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cursor } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: warrior } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bystander } satisfies CharacterCreatedEvent,
  ]);
  const enc = engine.plan.createEncounter(campaign.state, {
    combatantIds: [cursor.id, warrior.id, bystander.id],
  });
  campaign = commit(campaign, enc.events);
  campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
  campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
  campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);
  return { engine, campaign, cursor, warrior, bystander, swordId: sword.id };
};

const applyAttacksCurse = (
  campaign: Campaign,
  warriorId: string,
  cursorId: string,
  sourcePresent: boolean,
): Campaign => {
  const event: ConditionAppliedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'ConditionApplied',
    targetId: warriorId,
    conditionId: 'cursed-attacks-active',
    appliedConditionId: newAppliedConditionId(),
    ...(sourcePresent ? { sourceCharacterId: cursorId } : {}),
  };
  return commit(campaign, [event]);
};

describe('SetAdvantageVsSource via cursed-attacks-active', () => {
  it("warrior's attack against the cursor uses disadvantage", () => {
    const { engine, campaign, cursor, warrior, swordId } = setupCursedScene(11);
    const cursed = applyAttacksCurse(campaign, warrior.id, cursor.id, true);
    const events = engine.plan.attack(cursed.state, {
      attackerId: warrior.id,
      targetId: cursor.id,
      weaponInstanceId: swordId,
    }).events;
    const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
    expect(rolled).toBeDefined();
    expect(rolled!.used).toBe('disadvantage');
    expect(rolled!.d20).toHaveLength(2);
  });

  it("warrior's attack against a bystander uses no advantage modifier", () => {
    const { engine, campaign, cursor, warrior, bystander, swordId } = setupCursedScene(11);
    const cursed = applyAttacksCurse(campaign, warrior.id, cursor.id, true);
    const events = engine.plan.attack(cursed.state, {
      attackerId: warrior.id,
      targetId: bystander.id,
      weaponInstanceId: swordId,
    }).events;
    const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
    expect(rolled).toBeDefined();
    expect(rolled!.used).toBe('none');
    expect(rolled!.d20).toHaveLength(1);
  });

  it("the effect drops silently when the condition has no sourceCharacterId", () => {
    const { engine, campaign, cursor, warrior, swordId } = setupCursedScene(11);
    const cursed = applyAttacksCurse(campaign, warrior.id, cursor.id, false);
    const events = engine.plan.attack(cursed.state, {
      attackerId: warrior.id,
      targetId: cursor.id,
      weaponInstanceId: swordId,
    }).events;
    const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
    expect(rolled).toBeDefined();
    expect(rolled!.used).toBe('none');
  });
});
