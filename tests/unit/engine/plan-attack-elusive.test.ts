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

// Slice 199: Rogue L18 Elusive. RAW (SRD 5.2.1): "No attack roll can
// have Advantage against you unless you have the Incapacitated
// condition." Implemented via the `CancelAdvantageOnAttackers`
// primitive, predicate-gated on a `bearerHasIncapacitated` fact the
// attack planner derives from `findActorBlockingCondition`.

const PACK = loadStarterPack();

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const buildAttacker = (longswordId: string): Character =>
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

const buildElusiveRogue = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Elusive Rogue',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'rogue', level: 18, hitDiceRemaining: 18 }],
    abilityScores: { STR: 10, DEX: 18, CON: 12, INT: 14, WIS: 10, CHA: 10 },
    hp: { current: 90, max: 90, temp: 0 },
    featsTaken: [],
  });

const buildLowLevelRogue = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Apprentice Rogue',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'rogue', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 10, DEX: 16, CON: 12, INT: 14, WIS: 10, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

const setup = (seed: number, target: Character) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const sword = longsword();
  const attacker = buildAttacker(sword.id);
  let campaign: Campaign = engine.createCampaign({ name: `elusive-${seed}` });
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

describe('Rogue L18 Elusive cancels advantage against the bearer', () => {
  it('baseline: an Invisible attacker against an Apprentice Rogue rolls with advantage', () => {
    // Sanity check that without Elusive, the attacker-side advantage
    // path is live. Apprentice Rogue is L5 (no Elusive); attacker has
    // the Invisible condition (GrantAdvantageToAttackers on self via
    // SetAdvantage on attack rolls).
    const target = buildLowLevelRogue();
    const { engine, campaign, attacker, swordId } = setup(11, target);
    const cursed = applyConditionTo(campaign, attacker.id, 'invisible');
    const events = engine.plan.attack(cursed.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    expect(rolledAttack(events)!.used).toBe('advantage');
  });

  it('cancels an Invisible attacker advantage against an Elusive Rogue', () => {
    const target = buildElusiveRogue();
    const { engine, campaign, attacker, swordId } = setup(11, target);
    const cursed = applyConditionTo(campaign, attacker.id, 'invisible');
    const events = engine.plan.attack(cursed.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    const rolled = rolledAttack(events)!;
    expect(rolled.used).toBe('none');
    expect(rolled.d20).toHaveLength(1);
  });

  it('cancels caller-supplied advantage against an Elusive Rogue', () => {
    const target = buildElusiveRogue();
    const { engine, campaign, attacker, swordId } = setup(13, target);
    const events = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
      advantage: 'advantage',
    }).events;
    expect(rolledAttack(events)!.used).toBe('none');
  });

  it('does not impose disadvantage on its own — a plain attack rolls neither way', () => {
    const target = buildElusiveRogue();
    const { engine, campaign, attacker, swordId } = setup(17, target);
    const events = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    expect(rolledAttack(events)!.used).toBe('none');
  });

  it('Incapacitated bearer loses the suppression — Invisible attacker regains advantage', () => {
    const target = buildElusiveRogue();
    const { engine, campaign, attacker, swordId } = setup(19, target);
    let staged = applyConditionTo(campaign, target.id, 'incapacitated');
    staged = applyConditionTo(staged, attacker.id, 'invisible');
    const events = engine.plan.attack(staged.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    expect(rolledAttack(events)!.used).toBe('advantage');
  });

  it('Stunned bearer (a condition that RAW includes Incapacitated) also drops the suppression', () => {
    const target = buildElusiveRogue();
    const { engine, campaign, attacker, swordId } = setup(23, target);
    let staged = applyConditionTo(campaign, target.id, 'stunned');
    staged = applyConditionTo(staged, attacker.id, 'invisible');
    const events = engine.plan.attack(staged.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    expect(rolledAttack(events)!.used).toBe('advantage');
  });

  it('Poisoned attacker (disadvantage) still rolls with disadvantage — Elusive cancels only advantage', () => {
    const target = buildElusiveRogue();
    const { engine, campaign, attacker, swordId } = setup(29, target);
    const cursed = applyConditionTo(campaign, attacker.id, 'poisoned');
    const events = engine.plan.attack(cursed.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    expect(rolledAttack(events)!.used).toBe('disadvantage');
  });

  it('Invisible attacker + Poisoned attacker against Elusive: advantage suppressed, disadvantage applies', () => {
    // Without Elusive, Invisible (advantage) + Poisoned (disadvantage)
    // cancel to 'none' per 2024 RAW. With Elusive, the advantage
    // contribution is suppressed first; only the disadvantage survives.
    const target = buildElusiveRogue();
    const { engine, campaign, attacker, swordId } = setup(31, target);
    let cursed = applyConditionTo(campaign, attacker.id, 'invisible');
    cursed = applyConditionTo(cursed, attacker.id, 'poisoned');
    const events = engine.plan.attack(cursed.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    }).events;
    expect(rolledAttack(events)!.used).toBe('disadvantage');
  });
});
