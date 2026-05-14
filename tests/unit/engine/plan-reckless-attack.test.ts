import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { ItemInstanceSchema } from '../../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Barbarian L2 Reckless Attack: symmetric advantage. Bug this
// prevents: a Barbarian who Reckless-Attacks should get advantage on
// melee STR attack rolls AND grant advantage to attacks against them
// until their next turn start. Without wiring, the feature is inert.

const PACK = loadStarterPack();

const buildBarbarian = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Korg',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'barbarian', level: 2, hitDiceRemaining: 2 }],
    abilityScores: { STR: 18, DEX: 12, CON: 16, INT: 8, WIS: 10, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
  });

const buildEnemy = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Foe',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

interface Seeded {
  readonly engine: ReturnType<typeof createEngine>;
  readonly campaign: Campaign;
  readonly barbarianId: string;
  readonly enemyId: string;
  readonly weaponId: string;
  readonly encounterId: string;
}

const seedEncounter = (barbActive: boolean, seed = 0): Seeded => {
  const barb = buildBarbarian();
  const enemy = buildEnemy();
  const greatsword = ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'greatsword' });
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  let campaign: Campaign = engine.createCampaign({ name: 'reckless' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: greatsword },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: barb } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: enemy } satisfies CharacterCreatedEvent,
  ]);
  // Force initiative order so the Barbarian goes first (so reckless can
  // be activated as the active combatant).
  const enc = engine.plan.createEncounter(campaign.state, {
    combatantIds: barbActive ? [barb.id, enemy.id] : [enemy.id, barb.id],
  });
  campaign = commit(campaign, enc.events);
  campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
  campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
  campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);
  return {
    engine,
    campaign,
    barbarianId: barb.id,
    enemyId: enemy.id,
    weaponId: greatsword.id,
    encounterId: enc.encounterId,
  };
};

describe('Reckless Attack (Barbarian L2)', () => {
  it('sets the recklessAttackActive flag and emits RecklessAttackActivated', () => {
    const seeded = seedEncounter(true);
    // Hop to the barbarian's turn if they didn't roll first.
    let { campaign } = seeded;
    const encNow = () => campaign.state.encounters[seeded.encounterId]!;
    if (encNow().combatants[encNow().activeIndex]!.combatantId !== seeded.barbarianId) {
      campaign = commit(campaign, seeded.engine.plan.advanceTurn(campaign.state, { encounterId: seeded.encounterId }).events);
    }
    const events = seeded.engine.plan.recklessAttack(campaign.state, { combatantId: seeded.barbarianId }).events;
    expect(events.map((e) => e.type)).toEqual(['RecklessAttackActivated']);

    campaign = commit(campaign, events);
    const cb = campaign.state.encounters[seeded.encounterId]!.combatants.find(
      (c) => c.combatantId === seeded.barbarianId,
    );
    expect(cb?.turnUsage.recklessAttackActive).toBe(true);
  });

  it('Barbarian melee STR attack rolls 2 d20s after Reckless Attack', () => {
    const seeded = seedEncounter(true);
    let { campaign } = seeded;
    const encNow = () => campaign.state.encounters[seeded.encounterId]!;
    if (encNow().combatants[encNow().activeIndex]!.combatantId !== seeded.barbarianId) {
      campaign = commit(campaign, seeded.engine.plan.advanceTurn(campaign.state, { encounterId: seeded.encounterId }).events);
    }
    campaign = commit(
      campaign,
      seeded.engine.plan.recklessAttack(campaign.state, { combatantId: seeded.barbarianId }).events,
    );
    const events = seeded.engine.plan.attack(campaign.state, {
      attackerId: seeded.barbarianId,
      targetId: seeded.enemyId,
      weaponInstanceId: seeded.weaponId,
    }).events;
    const rolled = events.find((e) => e.type === 'AttackRolled') as AttackRolledEvent;
    expect(rolled).toBeDefined();
    expect(rolled.d20).toHaveLength(2);
    expect(rolled.used).toBe('advantage');
  });

  it('rejects when attacks have already been made this turn', () => {
    const seeded = seedEncounter(true);
    let { campaign } = seeded;
    const encNow = () => campaign.state.encounters[seeded.encounterId]!;
    if (encNow().combatants[encNow().activeIndex]!.combatantId !== seeded.barbarianId) {
      campaign = commit(campaign, seeded.engine.plan.advanceTurn(campaign.state, { encounterId: seeded.encounterId }).events);
    }
    campaign = commit(
      campaign,
      seeded.engine.plan.attack(campaign.state, {
        attackerId: seeded.barbarianId,
        targetId: seeded.enemyId,
        weaponInstanceId: seeded.weaponId,
      }).events,
    );
    expect(() =>
      seeded.engine.plan.recklessAttack(campaign.state, { combatantId: seeded.barbarianId }),
    ).toThrow(/before your first attack/);
  });

  it('rejects when the actor is not the active combatant', () => {
    const seeded = seedEncounter(false);
    let { campaign } = seeded;
    const encNow = () => campaign.state.encounters[seeded.encounterId]!;
    const activeId = encNow().combatants[encNow().activeIndex]!.combatantId;
    if (activeId === seeded.barbarianId) {
      // Initiative randomness placed the barbarian first anyway —
      // advance until they're not active.
      campaign = commit(campaign, seeded.engine.plan.advanceTurn(campaign.state, { encounterId: seeded.encounterId }).events);
    }
    expect(() =>
      seeded.engine.plan.recklessAttack(campaign.state, { combatantId: seeded.barbarianId }),
    ).toThrow(/own turn/);
  });

  it('attacks against the Reckless Barbarian also roll with advantage', () => {
    const seeded = seedEncounter(true);
    let { campaign } = seeded;
    const encNow = () => campaign.state.encounters[seeded.encounterId]!;
    if (encNow().combatants[encNow().activeIndex]!.combatantId !== seeded.barbarianId) {
      campaign = commit(campaign, seeded.engine.plan.advanceTurn(campaign.state, { encounterId: seeded.encounterId }).events);
    }
    campaign = commit(
      campaign,
      seeded.engine.plan.recklessAttack(campaign.state, { combatantId: seeded.barbarianId }).events,
    );
    // Advance to the enemy's turn so they can swing.
    campaign = commit(
      campaign,
      seeded.engine.plan.attack(campaign.state, {
        attackerId: seeded.barbarianId,
        targetId: seeded.enemyId,
        weaponInstanceId: seeded.weaponId,
      }).events,
    );
    campaign = commit(
      campaign,
      seeded.engine.plan.advanceTurn(campaign.state, { encounterId: seeded.encounterId }).events,
    );
    // Enemy attacks the barbarian: advantage.
    const enemyWeapon = ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: enemyWeapon },
    ]);
    const events = seeded.engine.plan.attack(campaign.state, {
      attackerId: seeded.enemyId,
      targetId: seeded.barbarianId,
      weaponInstanceId: enemyWeapon.id,
    }).events;
    const rolled = events.find((e) => e.type === 'AttackRolled') as AttackRolledEvent;
    expect(rolled).toBeDefined();
    expect(rolled.used).toBe('advantage');
  });
});
