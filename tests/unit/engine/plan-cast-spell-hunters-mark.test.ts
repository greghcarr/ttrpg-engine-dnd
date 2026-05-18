import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

// Slice 222: Hunter's Mark damage-rider wire. The spell installs a
// `hunters-mark-active` condition on the target with the caster as
// `sourceCharacterId`. The condition carries an OnEvent + AddDamage
// rider that fires +1d6 Force damage when `event.targetIsSelf &&
// event.hit && event.attackerIsSource` (same shape as Hex). Other
// Hunter's Mark arms (Advantage on WIS Perception / Survival to find
// the target, bonus-action remark on target death, upcast-driven
// duration extension) are deferred.

const PACK = loadStarterPack();

const buildRanger = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Cassian',
    speciesId: 'human',
    backgroundId: 'outlander',
    classes: [{ classId: 'ranger', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    preparedSpells: ['hunters-mark'],
  });

const buildBystander = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bystander Fighter',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 12, CON: 10, INT: 8, WIS: 8, CHA: 8 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

describe('Hunter\'s Mark damage-rider (slice 222)', () => {
  it("installs the hunters-mark-active condition on the target with the caster as source", () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(222) });
    const ranger = buildRanger();
    const target = buildTarget();
    let campaign: Campaign = engine.createCampaign({ name: 'hm-install' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: ranger.id,
        spellId: 'hunters-mark',
        slotLevel: 1,
        targetIds: [target.id],
      }).events,
    );
    const mark = campaign.state.characters[target.id]
      ?.appliedConditions.find((c) => c.conditionId === 'hunters-mark-active');
    expect(mark).toBeDefined();
    expect(mark!.sourceCharacterId).toBe(ranger.id);
  });

  it("the marking ranger's hit fires +1d6 Force damage", () => {
    for (let seed = 1; seed < 100; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const longsword = makeItemInstance('longsword');
      const ranger = buildRanger();
      const target = buildTarget();
      let campaign: Campaign = engine.createCampaign({ name: `hm-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      campaign = commit(
        campaign,
        engine.plan.castSpell(campaign.state, {
          characterId: ranger.id,
          spellId: 'hunters-mark',
          slotLevel: 1,
          targetIds: [target.id],
        }).events,
      );

      const attack = engine.plan.attack(campaign.state, {
        attackerId: ranger.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const attackRolled = attack.find((e) => e.type === 'AttackRolled') as AttackRolledEvent | undefined;
      if (attackRolled?.hit !== true) continue;

      const forceDamage = attack.find(
        (e) =>
          e.type === 'DamageApplied'
          && (e as DamageAppliedEvent).components.some((c) => c.type === 'force'),
      ) as DamageAppliedEvent | undefined;
      expect(forceDamage, 'expected a force DamageApplied from the Hunter\'s Mark rider').toBeDefined();
      const forceAmount = forceDamage!.components
        .filter((c) => c.type === 'force')
        .reduce((sum, c) => sum + c.amount, 0);
      expect(forceAmount).toBeGreaterThanOrEqual(1);
      expect(forceAmount).toBeLessThanOrEqual(attackRolled.critical ? 12 : 6);
      return;
    }
    throw new Error('no seed produced a hit for the marking ranger');
  });

  it("an attack by a non-caster does NOT fire the Hunter's Mark rider", () => {
    for (let seed = 1; seed < 100; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const swordA = makeItemInstance('longsword');
      const swordB = makeItemInstance('longsword');
      const ranger = buildRanger();
      const bystander = buildBystander();
      const target = buildTarget();
      let campaign: Campaign = engine.createCampaign({ name: `hm-bystander-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: swordA },
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: swordB },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bystander } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      campaign = commit(
        campaign,
        engine.plan.castSpell(campaign.state, {
          characterId: ranger.id,
          spellId: 'hunters-mark',
          slotLevel: 1,
          targetIds: [target.id],
        }).events,
      );

      const attack = engine.plan.attack(campaign.state, {
        attackerId: bystander.id,
        targetId: target.id,
        weaponInstanceId: swordB.id,
      }).events;
      const attackRolled = attack.find((e) => e.type === 'AttackRolled') as AttackRolledEvent | undefined;
      if (attackRolled?.hit !== true) continue;

      const forceDamage = attack.find(
        (e) =>
          e.type === 'DamageApplied'
          && (e as DamageAppliedEvent).components.some((c) => c.type === 'force'),
      );
      expect(forceDamage, "bystander's hit should NOT fire the Hunter's Mark rider").toBeUndefined();
      return;
    }
    throw new Error('no seed produced a hit for the bystander');
  });
});
