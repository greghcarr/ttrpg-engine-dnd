import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import {
  TEST_PACK,
  buildFighter,
  eventId,
  isoTimestamp,
  makeItemInstance,
} from '../../fixtures/index.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';

const buildRogue = (overrides: Partial<{ level: number; DEX: number; name: string }> = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: overrides.name ?? 'Vex',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [
      { classId: 'rogue', level: overrides.level ?? 1, hitDiceRemaining: overrides.level ?? 1 },
    ],
    abilityScores: { STR: 10, DEX: overrides.DEX ?? 18, CON: 12, INT: 12, WIS: 10, CHA: 10 },
    hp: { current: 14, max: 14, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

interface RogueSetup {
  readonly engine: ReturnType<typeof createEngine>;
  readonly campaign: ReturnType<ReturnType<typeof createEngine>['createCampaign']>;
  readonly rogueId: string;
  readonly targetId: string;
  readonly weaponId: string;
}

const seedRogueVsTarget = (rng = seededRNG(1)): RogueSetup => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng });
  const rapier = makeItemInstance('rapier');
  const rogue = buildRogue();
  const target = buildFighter({ name: 'Target', hpMax: 30, hpCurrent: 30 });
  let campaign = engine.createCampaign({ name: 'sneak' });
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemAcquired',
      instance: rapier,
    },
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: rogue,
    } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: target,
    } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, rogueId: rogue.id, targetId: target.id, weaponId: rapier.id };
};

describe('OnEvent trigger system', () => {
  it('Sneak Attack fires on advantage hit', () => {
    let { engine, campaign, rogueId, targetId, weaponId } = seedRogueVsTarget(seededRNG(1));
    let found = false;
    for (let seed = 1; seed < 60; seed++) {
      ({ engine, campaign, rogueId, targetId, weaponId } = seedRogueVsTarget(seededRNG(seed)));
      const events = engine.plan.attack(campaign.state, {
        attackerId: rogueId,
        targetId,
        weaponInstanceId: weaponId,
        advantage: 'advantage',
      }).events;
      const attackRolled = events.find((e) => e.type === 'AttackRolled') as
        | AttackRolledEvent
        | undefined;
      if (attackRolled?.hit !== true) continue;
      const triggerFired = events.find(
        (e) => e.type === 'TriggerFired' && e.triggerId.endsWith('sneak-attack'),
      );
      expect(triggerFired).toBeDefined();
      found = true;
      break;
    }
    expect(found).toBe(true);
  });

  it('Sneak Attack does not fire on miss', () => {
    let { engine, campaign, rogueId, targetId, weaponId } = seedRogueVsTarget(seededRNG(1));
    let testedAMiss = false;
    for (let seed = 1; seed < 80; seed++) {
      ({ engine, campaign, rogueId, targetId, weaponId } = seedRogueVsTarget(seededRNG(seed)));
      const events = engine.plan.attack(campaign.state, {
        attackerId: rogueId,
        targetId,
        weaponInstanceId: weaponId,
        advantage: 'advantage',
      }).events;
      const attackRolled = events.find((e) => e.type === 'AttackRolled') as
        | AttackRolledEvent
        | undefined;
      if (attackRolled?.hit === false) {
        testedAMiss = true;
        const triggerFired = events.find((e) => e.type === 'TriggerFired');
        expect(triggerFired).toBeUndefined();
        break;
      }
    }
    expect(testedAMiss).toBe(true);
  });

  it('Sneak Attack does not fire on regular (non-advantage) hit', () => {
    let { engine, campaign, rogueId, targetId, weaponId } = seedRogueVsTarget(seededRNG(1));
    let testedAHit = false;
    for (let seed = 1; seed < 80; seed++) {
      ({ engine, campaign, rogueId, targetId, weaponId } = seedRogueVsTarget(seededRNG(seed)));
      const events = engine.plan.attack(campaign.state, {
        attackerId: rogueId,
        targetId,
        weaponInstanceId: weaponId,
      }).events;
      const attackRolled = events.find((e) => e.type === 'AttackRolled') as
        | AttackRolledEvent
        | undefined;
      if (attackRolled?.hit === true) {
        testedAHit = true;
        const triggerFired = events.find((e) => e.type === 'TriggerFired');
        expect(triggerFired).toBeUndefined();
        break;
      }
    }
    expect(testedAHit).toBe(true);
  });

  it('Sneak Attack fires only once per turn even with multiple advantage hits', () => {
    let { engine, campaign, rogueId, targetId, weaponId } = seedRogueVsTarget(seededRNG(1));
    let found = false;
    for (let seed = 1; seed < 80; seed++) {
      ({ engine, campaign, rogueId, targetId, weaponId } = seedRogueVsTarget(seededRNG(seed)));
      const firstAttack = engine.plan.attack(campaign.state, {
        attackerId: rogueId,
        targetId,
        weaponInstanceId: weaponId,
        advantage: 'advantage',
      }).events;
      const firstHit = firstAttack.find((e) => e.type === 'AttackRolled') as
        | AttackRolledEvent
        | undefined;
      if (firstHit?.hit !== true) continue;
      campaign = commit(campaign, firstAttack);
      const secondAttack = engine.plan.attack(campaign.state, {
        attackerId: rogueId,
        targetId,
        weaponInstanceId: weaponId,
        advantage: 'advantage',
      }).events;
      const secondHit = secondAttack.find((e) => e.type === 'AttackRolled') as
        | AttackRolledEvent
        | undefined;
      if (secondHit?.hit !== true) continue;
      const secondTrigger = secondAttack.find((e) => e.type === 'TriggerFired');
      expect(secondTrigger).toBeUndefined();
      found = true;
      break;
    }
    expect(found).toBe(true);
  });
});
