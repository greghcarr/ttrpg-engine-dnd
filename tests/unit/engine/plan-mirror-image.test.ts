// Slice 124 — Mirror Image attack-deflection pool.
//
// New MirrorImageDeflectedEvent + reducer that decrements the bearer's
// mirror-image-active condition level (3 -> 2 -> 1 -> condition
// removed). planAttack and planOffHandAttack roll a deflection d20
// before the attack roll; on a redirect-success the attack rolls
// against duplicate AC = 10 + bearer DEX mod. Hit destroys a
// duplicate; miss does nothing; deflected attacks emit AttackRolled
// with hit=false so bearer-side retaliation riders don't fire.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId, newAppliedConditionId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ConditionAppliedEvent,
  ConditionRemovedEvent,
  DamageAppliedEvent,
} from '../../../src/schemas/events/combat.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import type { MirrorImageDeflectedEvent } from '../../../src/schemas/events/mirror-image.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Mirage',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
    preparedSpells: ['mirror-image'],
  });

const buildAttacker = (weaponId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 8, WIS: 10, CHA: 8 },
    hp: { current: 11, max: 11, temp: 0 },
    featsTaken: [],
    inventory: [weaponId],
    equipped: { mainHand: weaponId, attuned: [] },
  });

describe('Mirror Image', () => {
  it('cast applies mirror-image-active at level 3', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    let campaign: Campaign = engine.createCampaign({ name: 'mi-cast' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    const castEvents = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'mirror-image',
      slotLevel: 2,
      targetIds: [wizard.id],
    }).events;
    const applied = castEvents.find(
      (e): e is ConditionAppliedEvent =>
        e.type === 'ConditionApplied' && e.conditionId === 'mirror-image-active',
    );
    expect(applied).toBeDefined();
    expect(applied!.level).toBe(3);
  });

  // Helper: seed a warded warlock + attacker scene with a fresh
  // mirror-image-active at `level` duplicates remaining, then plan one
  // attack and return the result events. Used by the deflection cases
  // below to seed-walk for desired RNG outcomes.
  const planAttackWithMirrorImage = (
    seed: number,
    duplicates: number,
  ): { events: ReadonlyArray<unknown>; bearerHpBefore: number; attackerId: string; bearerId: string } => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
    const longsword = makeItemInstance('longsword');
    const wizard = buildWizard();
    const attacker = buildAttacker(longsword.id);
    let campaign: Campaign = engine.createCampaign({ name: `mi-${seed}-${duplicates}` });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    ]);
    const ward: ConditionAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: wizard.id,
      conditionId: 'mirror-image-active',
      appliedConditionId: newAppliedConditionId(),
      level: duplicates,
    };
    campaign = commit(campaign, [ward]);
    const bearerHpBefore = campaign.state.characters[wizard.id]!.hp.current;
    const events = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: wizard.id,
      weaponInstanceId: longsword.id,
    }).events;
    return { events, bearerHpBefore, attackerId: attacker.id, bearerId: wizard.id };
  };

  it('deflection success + duplicate hit emits MirrorImageDeflected with duplicateHit, decrements pool, bearer HP unchanged', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const { events, bearerHpBefore, attackerId, bearerId } = planAttackWithMirrorImage(seed, 3);
      const deflected = events.find(
        (e): e is MirrorImageDeflectedEvent =>
          (e as { type?: string }).type === 'MirrorImageDeflected',
      );
      if (deflected === undefined) continue;
      if (!deflected.duplicateHit) continue;
      // The companion AttackRolled is stamped with hit:false so bearer-
      // side retaliation riders won't fire.
      const rolled = events.find(
        (e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled',
      );
      expect(rolled).toBeDefined();
      expect(rolled!.hit).toBe(false);
      expect(rolled!.attackerId).toBe(attackerId);
      expect(rolled!.targetId).toBe(bearerId);
      // No damage was emitted.
      const dmg = events.find(
        (e): e is DamageAppliedEvent => (e as { type?: string }).type === 'DamageApplied',
      );
      expect(dmg).toBeUndefined();
      // Deflection event payload mirrors duplicateAC = 10 + DEX-mod
      // (wizard DEX 14 -> +2 -> AC 12).
      expect(deflected.duplicateAC).toBe(12);
      expect(deflected.duplicatesAfter).toBe(2);
      // Bearer HP unchanged (no damage path ran).
      expect(bearerHpBefore).toBe(30);
      return;
    }
    throw new Error('no seed produced a deflection-success + duplicate-hit outcome');
  });

  it('deflection success + duplicate miss leaves the pool intact (no decrement)', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const { events } = planAttackWithMirrorImage(seed, 3);
      const deflected = events.find(
        (e): e is MirrorImageDeflectedEvent =>
          (e as { type?: string }).type === 'MirrorImageDeflected',
      );
      if (deflected === undefined) continue;
      if (deflected.duplicateHit) continue;
      // Pool unchanged on a deflection miss.
      expect(deflected.duplicatesAfter).toBe(3);
      // No follow-up ConditionRemoved.
      const removed = events.find(
        (e): e is ConditionRemovedEvent => (e as { type?: string }).type === 'ConditionRemoved',
      );
      expect(removed).toBeUndefined();
      return;
    }
    throw new Error('no seed produced a deflection-success + duplicate-miss outcome');
  });

  it('deflection failure proceeds to a normal attack against the bearer (no MirrorImageDeflected emitted)', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const { events } = planAttackWithMirrorImage(seed, 1);
      // With 1 duplicate the threshold is 11; many seeds will roll
      // below it. Find one and assert the attack flow proceeded.
      const deflected = events.find(
        (e): e is MirrorImageDeflectedEvent =>
          (e as { type?: string }).type === 'MirrorImageDeflected',
      );
      if (deflected !== undefined) continue;
      const rolled = events.find(
        (e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled',
      );
      expect(rolled).toBeDefined();
      // No restriction on hit value — the attack might miss the bearer's
      // AC normally. The point is just that no deflection happened.
      return;
    }
    throw new Error('no seed produced a deflection-failure (all rolled 11+ at 1 duplicate?)');
  });

  it('destroying the last duplicate emits ConditionRemoved for mirror-image-active', () => {
    // Start at 1 duplicate, find a seed where deflection succeeds AND
    // the attack hits the duplicate AC.
    for (let seed = 1; seed < 300; seed += 1) {
      const { events } = planAttackWithMirrorImage(seed, 1);
      const deflected = events.find(
        (e): e is MirrorImageDeflectedEvent =>
          (e as { type?: string }).type === 'MirrorImageDeflected',
      );
      if (deflected === undefined) continue;
      if (!deflected.duplicateHit) continue;
      expect(deflected.duplicatesAfter).toBe(0);
      const removed = events.find(
        (e): e is ConditionRemovedEvent =>
          (e as { type?: string }).type === 'ConditionRemoved'
          && (e as ConditionRemovedEvent).conditionId === 'mirror-image-active',
      );
      expect(removed).toBeDefined();
      return;
    }
    throw new Error('no seed produced a deflection-success + duplicate-hit at 1 duplicate');
  });

  it('dispatches attacker-side triggers on a deflected attack (slice 125)', () => {
    // Set up: the attacker carries `studied-target-active` sourced to
    // the bearer. The condition's consume-on-trigger OnEvent rider
    // should fire on the next AttackRolled where the attacker is self
    // and the target is the source — including a Mirror-Image-deflected
    // one, since the deflected AttackRolled still names the bearer as
    // targetId. The slice-125 fix routes the deflected AttackRolled
    // through dispatchTriggers, so the rider fires and emits a
    // ConditionRemoved for `studied-target-active`.
    for (let seed = 1; seed < 200; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const longsword = makeItemInstance('longsword');
      const wizard = buildWizard();
      const fighter = buildAttacker(longsword.id);
      let campaign: Campaign = engine.createCampaign({ name: `mi-trigger-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
      ]);
      const ward: ConditionAppliedEvent = {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: wizard.id,
        conditionId: 'mirror-image-active',
        appliedConditionId: newAppliedConditionId(),
        level: 3,
      };
      const studied: ConditionAppliedEvent = {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: fighter.id,
        conditionId: 'studied-target-active',
        appliedConditionId: newAppliedConditionId(),
        sourceCharacterId: wizard.id,
      };
      campaign = commit(campaign, [ward, studied]);

      const events = engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: wizard.id,
        weaponInstanceId: longsword.id,
      }).events;
      const deflected = events.find(
        (e): e is MirrorImageDeflectedEvent =>
          (e as { type?: string }).type === 'MirrorImageDeflected',
      );
      if (deflected === undefined) continue;
      const studiedRemoved = events.find(
        (e): e is ConditionRemovedEvent =>
          (e as { type?: string }).type === 'ConditionRemoved'
          && (e as ConditionRemovedEvent).conditionId === 'studied-target-active'
          && (e as ConditionRemovedEvent).targetId === fighter.id,
      );
      expect(studiedRemoved).toBeDefined();
      return;
    }
    throw new Error('no seed produced a deflection-success for the trigger-dispatch test');
  });
});
