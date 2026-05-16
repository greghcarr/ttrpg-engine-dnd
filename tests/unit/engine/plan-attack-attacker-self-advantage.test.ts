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

// Slice 97: the attack planner now consults
// `attackerEffects.advantageFor('attack')`, so the attacker's own
// SetAdvantage-on-attack effects (Blinded / Poisoned / Frightened /
// Restrained / Prone disadvantage; Invisible advantage) actually
// affect the d20 roll instead of dropping silently.

const PACK = loadStarterPack();

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const buildWarrior = (longswordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Attacker',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [longswordId],
    equipped: { mainHand: longswordId, attuned: [] },
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 10, CON: 12, INT: 18, WIS: 14, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

const setupScene = (seed: number) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const sword = longsword();
  const attacker = buildWarrior(sword.id);
  const target = buildTarget();
  let campaign: Campaign = engine.createCampaign({ name: `self-adv-${seed}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, attacker, target, swordId: sword.id };
};

const applyConditionTo = (
  campaign: Campaign,
  bearerId: string,
  conditionId: string,
): Campaign => {
  const event: ConditionAppliedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'ConditionApplied',
    targetId: bearerId,
    conditionId,
    appliedConditionId: newAppliedConditionId(),
  };
  return commit(campaign, [event]);
};

const rolledAttack = (events: ReadonlyArray<unknown>): AttackRolledEvent | undefined =>
  events.find(
    (e): e is AttackRolledEvent =>
      typeof e === 'object' && e !== null && (e as { type?: string }).type === 'AttackRolled',
  );

describe("attacker's own SetAdvantage on attack rolls is consulted", () => {
  it('Blinded attacker rolls with disadvantage', () => {
    const { engine, campaign, attacker, target, swordId } = setupScene(11);
    const cursed = applyConditionTo(campaign, attacker.id, 'blinded');
    const events = engine.plan.attack(cursed.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    const rolled = rolledAttack(events)!;
    expect(rolled.used).toBe('disadvantage');
    expect(rolled.d20).toHaveLength(2);
  });

  it('Poisoned attacker rolls with disadvantage', () => {
    const { engine, campaign, attacker, target, swordId } = setupScene(13);
    const cursed = applyConditionTo(campaign, attacker.id, 'poisoned');
    const events = engine.plan.attack(cursed.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    expect(rolledAttack(events)!.used).toBe('disadvantage');
  });

  it('Invisible attacker rolls with advantage', () => {
    const { engine, campaign, attacker, target, swordId } = setupScene(17);
    const cursed = applyConditionTo(campaign, attacker.id, 'invisible');
    const events = engine.plan.attack(cursed.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    expect(rolledAttack(events)!.used).toBe('advantage');
  });

  it('Invisible + Blinded cancel per 2024 RAW (no advantage either way)', () => {
    const { engine, campaign, attacker, target, swordId } = setupScene(19);
    let cursed = applyConditionTo(campaign, attacker.id, 'invisible');
    cursed = applyConditionTo(cursed, attacker.id, 'blinded');
    const events = engine.plan.attack(cursed.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    const rolled = rolledAttack(events)!;
    expect(rolled.used).toBe('none');
    expect(rolled.d20).toHaveLength(1);
  });
});
