// Slice 108 — on-miss trigger primitive (Fighter Studied Attacks L13).
//
// Pieces:
// 1. New `event.targetIsSource` fact in dispatch.ts (mirror of
//    `event.attackerIsSource`).
// 2. New optional `sourceFromEventTarget?: boolean` on the
//    `ApplyConditionToAttacker` TriggerAction: when true, stamps the
//    emitted ConditionApplied's `sourceCharacterId` from the
//    triggering event's `targetId` (the missed creature) rather than
//    the rider's bearer.
// 3. Fighter L13's `studied-attacks` feature wires an OnEvent rider
//    (`attackerIsSelf && hit:false`) emitting that action with
//    `studied-target-active`. The condition carries
//    `SetAdvantageVsSource(on:'attack', advantage)` and a
//    consume-on-next-attack OnEvent rider gated on
//    `attackerIsSelf && targetIsSource`.

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
import { newCharacterId, newItemInstanceId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const buildL13Fighter = (sword: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Veteran',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 13, hitDiceRemaining: 13 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 10 },
    hp: { current: 100, max: 100, temp: 0 },
    featsTaken: ['savage-attacker'],
    inventory: [sword],
    equipped: { mainHand: sword, attuned: [] },
  });

const buildTarget = (name: string, ac: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    armorClass: ac,
    featsTaken: ['savage-attacker'],
  });

describe('Studied Attacks (Fighter L13)', () => {
  it('a miss applies studied-target-active to the fighter keyed against the missed target', () => {
    // Walk seeds for a miss. Target AC is set high so misses are common.
    for (let seed = 1; seed < 40; seed += 1) {
      const sword = longsword();
      const fighter = buildL13Fighter(sword.id);
      const targetT = buildTarget('Target T', 25); // high AC to force misses
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = engine.createCampaign({ name: `studied-miss-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: targetT } satisfies CharacterCreatedEvent,
      ]);
      const events = engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: targetT.id,
        weaponInstanceId: sword.id,
      }).events;
      const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (rolled === undefined || rolled.hit) continue;
      const applied = events.find(
        (e): e is ConditionAppliedEvent =>
          e.type === 'ConditionApplied'
          && (e as ConditionAppliedEvent).conditionId === 'studied-target-active',
      );
      expect(applied).toBeDefined();
      expect(applied!.targetId).toBe(fighter.id);
      expect(applied!.sourceCharacterId).toBe(targetT.id);
      return;
    }
    throw new Error('no seed produced a miss for the Studied Attacks application test');
  });

  it('after a miss against T, the next attack against T rolls with advantage and the condition consumes', () => {
    // First produce a miss against T, commit, then attack T again and
    // verify (a) advantage applied, (b) studied-target-active consumed.
    for (let seed = 1; seed < 40; seed += 1) {
      const sword = longsword();
      const fighter = buildL13Fighter(sword.id);
      const targetT = buildTarget('Target T', 25);
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = engine.createCampaign({ name: `studied-adv-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: targetT } satisfies CharacterCreatedEvent,
      ]);
      const missEvents = engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: targetT.id,
        weaponInstanceId: sword.id,
      }).events;
      const missRoll = missEvents.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (missRoll === undefined || missRoll.hit) continue;
      campaign = commit(campaign, missEvents);

      // Confirm studied-target-active is on the fighter.
      expect(
        campaign.state.characters[fighter.id]!.appliedConditions.some(
          (c) => c.conditionId === 'studied-target-active'
            && c.sourceCharacterId === targetT.id,
        ),
      ).toBe(true);

      // Second attack against T. RNG state has advanced; the planner
      // will use advantage from the SetAdvantageVsSource entry.
      const secondEvents = engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: targetT.id,
        weaponInstanceId: sword.id,
      }).events;
      const secondRoll = secondEvents.find(
        (e): e is AttackRolledEvent => e.type === 'AttackRolled',
      );
      expect(secondRoll).toBeDefined();
      expect(secondRoll!.used).toBe('advantage');
      expect(secondRoll!.d20.length).toBe(2);

      campaign = commit(campaign, secondEvents);
      // After the second attack, the consume rider should have lifted
      // the studying condition.
      expect(
        campaign.state.characters[fighter.id]!.appliedConditions.some(
          (c) => c.conditionId === 'studied-target-active',
        ),
      ).toBe(false);
      return;
    }
    throw new Error('no seed produced a miss + subsequent attack for the Studied Attacks advantage test');
  });

  it('a miss against T does not grant advantage on attacks against a different target U', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const sword = longsword();
      const fighter = buildL13Fighter(sword.id);
      const targetT = buildTarget('Target T', 25);
      const targetU = buildTarget('Target U', 25);
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = engine.createCampaign({ name: `studied-wrong-target-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: targetT } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: targetU } satisfies CharacterCreatedEvent,
      ]);
      const missEvents = engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: targetT.id,
        weaponInstanceId: sword.id,
      }).events;
      const missRoll = missEvents.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (missRoll === undefined || missRoll.hit) continue;
      campaign = commit(campaign, missEvents);

      // Attack U. studied-target-active is keyed against T, so the
      // SetAdvantageVsSource entry doesn't match U's id.
      const otherEvents = engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: targetU.id,
        weaponInstanceId: sword.id,
      }).events;
      const otherRoll = otherEvents.find(
        (e): e is AttackRolledEvent => e.type === 'AttackRolled',
      );
      expect(otherRoll).toBeDefined();
      expect(otherRoll!.used).toBe('none');
      expect(otherRoll!.d20.length).toBe(1);
      return;
    }
    throw new Error('no seed produced a miss + cross-target attack for the wrong-target test');
  });
});
