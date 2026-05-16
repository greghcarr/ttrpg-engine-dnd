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
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { resolveContent } from '../../../src/content/pack.js';

// Slice 103 — type-conditional buff / ward primitive.
//
// 1. EffectAccumulator's `imposesDisadvantageOnAttackers(attackerFacts)`
//    honors `condition` predicates on each ImposeDisadvantageOnAttackers
//    effect, evaluating them against the supplied attacker facts.
// 2. Protection from Evil and Good's `protection-from-evil-and-good-active`
//    condition carries a type-conditional ImposeDisadvantageOnAttackers
//    whose predicate matches six creature types (aberration, celestial,
//    elemental, fey, fiend, undead). Attacks from creatures outside the
//    six types resolve without the disadvantage.
// 3. The attack planner threads the attacker's creature type into the
//    accumulator query, so the end-to-end Skeleton-attacks-buffed-cleric
//    AttackRolled event uses disadvantage (two d20s).

const PACK = loadStarterPack();
const STARTER_CONTENT = resolveContent([PACK]);

// Use the starter pack for monsters (Skeleton has the Undead type the
// PfEoG predicate matches). The TEST_PACK in tests/fixtures doesn't
// carry the skeleton statblock.

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const buildCleric = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Warded Cleric',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 10, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    armorClass: 8, // low so the seed-hunt for a hit is short
    featsTaken: [],
  });

const buildSkeleton = (sword: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Skeleton',
    statblockId: 'skeleton',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 14, CON: 15, INT: 6, WIS: 8, CHA: 5 },
    hp: { current: 13, max: 13, temp: 0 },
    featsTaken: ['savage-attacker'],
    speedFeet: 30,
    inventory: [sword],
    equipped: { mainHand: sword, attuned: [] },
  });

const buildHumanoidAttacker = (sword: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bandit',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 11, max: 11, temp: 0 },
    featsTaken: ['savage-attacker'],
    inventory: [sword],
    equipped: { mainHand: sword, attuned: [] },
  });

describe('Protection from Evil and Good: predicate-gated ImposeDisadvantageOnAttackers', () => {
  it('imposesDisadvantageOnAttackers returns true when the attacker is one of the six warded types', () => {
    const cleric: Character = {
      ...buildCleric(),
      appliedConditions: [
        {
          id: newAppliedConditionId(),
          conditionId: 'protection-from-evil-and-good-active',
          sourceEventId: 'seed-event-id' as ReturnType<typeof newAppliedConditionId>,
        },
      ],
    };
    const stack = buildEffectStack({
      character: cleric,
      content: STARTER_CONTENT,
      itemInstances: {},
      pendingChoices: {},
    });
    for (const t of ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'] as const) {
      const facts = new Map<string, unknown>([['attackerCreatureType', t]]);
      expect(stack.imposesDisadvantageOnAttackers(facts)).toBe(true);
    }
  });

  it('imposesDisadvantageOnAttackers returns false when the attacker is outside the warded types', () => {
    const cleric: Character = {
      ...buildCleric(),
      appliedConditions: [
        {
          id: newAppliedConditionId(),
          conditionId: 'protection-from-evil-and-good-active',
          sourceEventId: 'seed-event-id' as ReturnType<typeof newAppliedConditionId>,
        },
      ],
    };
    const stack = buildEffectStack({
      character: cleric,
      content: STARTER_CONTENT,
      itemInstances: {},
      pendingChoices: {},
    });
    for (const t of ['Humanoid', 'Beast', 'Construct', 'Dragon', 'Giant', 'Monstrosity', 'Ooze', 'Plant'] as const) {
      const facts = new Map<string, unknown>([['attackerCreatureType', t]]);
      expect(stack.imposesDisadvantageOnAttackers(facts)).toBe(false);
    }
  });

  it('imposesDisadvantageOnAttackers without facts returns false for an unconditional-free type-gated entry', () => {
    // PfEoG only carries the type-gated entry; with no facts supplied,
    // the predicate evaluation reads `undefined` for the path and the
    // `eq` terms all fail, so the result is false.
    const cleric: Character = {
      ...buildCleric(),
      appliedConditions: [
        {
          id: newAppliedConditionId(),
          conditionId: 'protection-from-evil-and-good-active',
          sourceEventId: 'seed-event-id' as ReturnType<typeof newAppliedConditionId>,
        },
      ],
    };
    const stack = buildEffectStack({
      character: cleric,
      content: STARTER_CONTENT,
      itemInstances: {},
      pendingChoices: {},
    });
    expect(stack.imposesDisadvantageOnAttackers()).toBe(false);
  });
});

describe('Attack planner: PfEoG-buffed target', () => {
  it('Skeleton attack against a PfEoG-buffed Cleric resolves with disadvantage', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const sword = longsword();
      const cleric = buildCleric();
      const skeleton = buildSkeleton(sword.id);
      let campaign: Campaign = engine.createCampaign({ name: `pfeg-skel-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: skeleton } satisfies CharacterCreatedEvent,
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'ConditionApplied',
          targetId: cleric.id,
          conditionId: 'protection-from-evil-and-good-active',
          appliedConditionId: newAppliedConditionId(),
        } satisfies ConditionAppliedEvent,
      ]);
      const events = engine.plan.attack(campaign.state, {
        attackerId: skeleton.id,
        targetId: cleric.id,
        weaponInstanceId: sword.id,
      }).events;
      const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (rolled === undefined) continue;
      expect(rolled.used).toBe('disadvantage');
      expect(rolled.d20.length).toBe(2);
      return;
    }
    throw new Error('no seed produced an AttackRolled for PfEoG vs Skeleton');
  });

  it('Bandit attack against a PfEoG-buffed Cleric resolves without disadvantage', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const sword = longsword();
      const cleric = buildCleric();
      const bandit = buildHumanoidAttacker(sword.id);
      let campaign: Campaign = engine.createCampaign({ name: `pfeg-bandit-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bandit } satisfies CharacterCreatedEvent,
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'ConditionApplied',
          targetId: cleric.id,
          conditionId: 'protection-from-evil-and-good-active',
          appliedConditionId: newAppliedConditionId(),
        } satisfies ConditionAppliedEvent,
      ]);
      const events = engine.plan.attack(campaign.state, {
        attackerId: bandit.id,
        targetId: cleric.id,
        weaponInstanceId: sword.id,
      }).events;
      const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (rolled === undefined) continue;
      expect(rolled.used).toBe('none');
      expect(rolled.d20.length).toBe(1);
      return;
    }
    throw new Error('no seed produced an AttackRolled for PfEoG vs Bandit');
  });
});
