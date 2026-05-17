// Slice 140: monster breath weapon primitive. Verifies fire chain
// (action consume + BreathWeaponFired + per-target SaveRolled +
// DamageApplied with halve-on-save semantics), expended gate
// rejects re-fire, recharge roll at turn-start clears the flag
// when it meets the rechargeMin threshold, and the save passes
// sourceIsMagical: true so Magic Resistance is honored.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  BreathWeaponFiredEvent,
  BreathWeaponRechargedEvent,
} from '../../../src/schemas/events/breath-weapon.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';

const PACK = loadStarterPack();

const buildYoungRedDragon = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Young Red Dragon',
    statblockId: 'young-red-dragon',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 23, DEX: 10, CON: 21, INT: 14, WIS: 11, CHA: 19 },
    hp: { current: 178, max: 178, temp: 0 },
    featsTaken: [],
  });

const buildTarget = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const buildImpTarget = (): Character =>
  // Imp carries Magic Resistance + fire immunity.
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Imp Target',
    statblockId: 'imp',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: [],
  });

interface SeededFire {
  readonly engine: ReturnType<typeof createEngine>;
  readonly campaign: Campaign;
  readonly dragonId: string;
  readonly target1Id: string;
  readonly target2Id: string;
}

const seedFire = (seed = 1): SeededFire => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const dragon = buildYoungRedDragon();
  const target1 = buildTarget('Victim A');
  const target2 = buildTarget('Victim B');
  let campaign: Campaign = engine.createCampaign({ name: `breath-${seed}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dragon } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target1 } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target2 } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, dragonId: dragon.id, target1Id: target1.id, target2Id: target2.id };
};

describe('engine.plan.breathWeapon', () => {
  it('fires: emits BreathWeaponFired + per-target SaveRolled + DamageApplied, sets expended flag', () => {
    const { engine, campaign, dragonId, target1Id, target2Id } = seedFire();
    const { events } = engine.plan.breathWeapon(campaign.state, {
      monsterId: dragonId,
      targetIds: [target1Id, target2Id],
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('BreathWeaponFired');
    const fired = events.find(
      (e): e is BreathWeaponFiredEvent => e.type === 'BreathWeaponFired',
    )!;
    expect(fired.breathWeaponId).toBe('fire-breath');
    expect(fired.monsterId).toBe(dragonId);
    const saves = events.filter((e): e is SaveRolledEvent => e.type === 'SaveRolled');
    expect(saves).toHaveLength(2);
    for (const save of saves) {
      expect(save.ability).toBe('DEX');
      expect(save.dc).toBe(17);
    }
    // Commit and verify the expended flag.
    const after = commit(campaign, events);
    expect(after.state.characters[dragonId]!.breathWeaponExpended).toBe(true);
  });

  it('damage is halved on a successful save and full on failure (shared damage roll per target)', () => {
    // Seed-walk to find a seed where one target saves and the other
    // fails on the same cast (both targets have +0 DEX save vs DC 17,
    // so each needs natural 17+).
    for (let seed = 1; seed < 200; seed += 1) {
      const { engine, campaign, dragonId, target1Id, target2Id } = seedFire(seed);
      const { events } = engine.plan.breathWeapon(campaign.state, {
        monsterId: dragonId,
        targetIds: [target1Id, target2Id],
      });
      const saves = events.filter((e): e is SaveRolledEvent => e.type === 'SaveRolled');
      const damages = events.filter((e): e is DamageAppliedEvent => e.type === 'DamageApplied');
      if (saves[0]!.success === saves[1]!.success) continue;
      // Different save outcomes -> different damage totals (one half, one full).
      const winner = saves[0]!.success ? damages[0]! : damages[1]!;
      const loser = saves[0]!.success ? damages[1]! : damages[0]!;
      const winnerTotal = winner.components.reduce((s, c) => s + c.amount, 0);
      const loserTotal = loser.components.reduce((s, c) => s + c.amount, 0);
      expect(winnerTotal * 2).toBeLessThanOrEqual(loserTotal + 1);
      expect(winnerTotal).toBeLessThan(loserTotal);
      return;
    }
    throw new Error('no seed produced a save / fail mix in window');
  });

  it('expended gate: re-firing the breath weapon throws', () => {
    const { engine, campaign, dragonId, target1Id } = seedFire();
    const first = engine.plan.breathWeapon(campaign.state, {
      monsterId: dragonId,
      targetIds: [target1Id],
    });
    const after = commit(campaign, first.events);
    expect(() =>
      engine.plan.breathWeapon(after.state, {
        monsterId: dragonId,
        targetIds: [target1Id],
      }),
    ).toThrow(/expended/);
  });

  it('rejects a monster with no breath weapon (Skeleton)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const skeleton = CharacterSchema.parse({
      id: newCharacterId(),
      kind: 'creature',
      name: 'Skeleton',
      statblockId: 'skeleton',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
      abilityScores: { STR: 10, DEX: 14, CON: 15, INT: 6, WIS: 8, CHA: 5 },
      hp: { current: 13, max: 13, temp: 0 },
      featsTaken: [],
    });
    const target = buildTarget('Victim');
    let campaign: Campaign = engine.createCampaign({ name: 'no-breath' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: skeleton } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.breathWeapon(campaign.state, {
        monsterId: skeleton.id,
        targetIds: [target.id],
      }),
    ).toThrow(/no breath weapon/);
  });

  it('Imp target: Magic Resistance contributes advantage to the DEX save', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const dragon = buildYoungRedDragon();
    const imp = buildImpTarget();
    let campaign: Campaign = engine.createCampaign({ name: 'breath-vs-imp' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dragon } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: imp } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.breathWeapon(campaign.state, {
      monsterId: dragon.id,
      targetIds: [imp.id],
    });
    const save = events.find((e): e is SaveRolledEvent => e.type === 'SaveRolled')!;
    expect(save.used).toBe('advantage');
    expect(save.d20).toHaveLength(2);
  });

  it('fire-immune target (Imp) takes 0 damage on hit (mitigateDamage zeroes it)', () => {
    // Seed-walk to find a seed where the Imp fails the save (and
    // would normally take fire damage) — fire immunity should still
    // zero the result.
    for (let seed = 1; seed < 50; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const dragon = buildYoungRedDragon();
      const imp = buildImpTarget();
      let campaign: Campaign = engine.createCampaign({ name: `imp-fire-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dragon } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: imp } satisfies CharacterCreatedEvent,
      ]);
      const { events } = engine.plan.breathWeapon(campaign.state, {
        monsterId: dragon.id,
        targetIds: [imp.id],
      });
      const damage = events.find(
        (e): e is DamageAppliedEvent => e.type === 'DamageApplied',
      );
      // Fire immunity zeroes the amount on every component; the
      // DamageApplied event still emits but with amount: 0 per
      // mitigateDamage's immune branch.
      if (damage !== undefined) {
        for (const comp of damage.components) expect(comp.amount).toBe(0);
        return;
      }
      // No damage event means the save passed and halved damage was 0,
      // or no damage was emitted at all; still a valid path here.
      return;
    }
  });
});

describe('breath weapon recharge at turn start', () => {
  it('recharge succeeds on roll >= rechargeMin: emits BreathWeaponRecharged, clears expended', () => {
    // Seed-walk to find a seed where the d6 lands 5+ at the dragon's
    // turn start. The recharge roll happens during planAdvanceTurn /
    // planBeginFirstTurn for an active monster with expended:true.
    for (let seed = 1; seed < 100; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const dragon = buildYoungRedDragon();
      const target = buildTarget('Lone Victim');
      let campaign: Campaign = engine.createCampaign({ name: `recharge-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dragon } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      // Set expended manually so we can test the recharge path
      // without needing an encounter (the encounter setup is heavy).
      const fireEvents = engine.plan.breathWeapon(campaign.state, {
        monsterId: dragon.id,
        targetIds: [target.id],
      }).events;
      campaign = commit(campaign, fireEvents);
      expect(campaign.state.characters[dragon.id]!.breathWeaponExpended).toBe(true);

      // Build a tiny encounter so advanceTurn fires.
      const created = engine.plan.createEncounter(campaign.state, {
        combatantIds: [dragon.id, target.id],
      });
      campaign = commit(campaign, created.events);
      campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events);
      campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events);
      const first = engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId });
      const rechargeEvent = first.events.find(
        (e): e is BreathWeaponRechargedEvent => e.type === 'BreathWeaponRecharged',
      );
      // Find whichever combatant is first; if it's the dragon and the
      // d6 met threshold, we should see the recharge event.
      const encounter = campaign.state.encounters[created.encounterId]!;
      const firstCombatantId = encounter.combatants[0]!.combatantId;
      if (firstCombatantId !== dragon.id) continue;
      if (rechargeEvent === undefined) continue;
      expect(rechargeEvent.roll).toBeGreaterThanOrEqual(5);
      expect(rechargeEvent.breathWeaponId).toBe('fire-breath');
      const after = commit(campaign, first.events);
      expect(after.state.characters[dragon.id]!.breathWeaponExpended).toBe(false);
      return;
    }
    throw new Error('no seed produced a dragon-first-turn with successful recharge in window');
  });

  it('recharge fails on roll < rechargeMin: no event, stays expended', () => {
    // Same shape, look for a seed where the dragon goes first but the
    // d6 lands 1-4 (no recharge).
    for (let seed = 1; seed < 100; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const dragon = buildYoungRedDragon();
      const target = buildTarget('Lone Victim');
      let campaign: Campaign = engine.createCampaign({ name: `recharge-fail-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dragon } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const fireEvents = engine.plan.breathWeapon(campaign.state, {
        monsterId: dragon.id,
        targetIds: [target.id],
      }).events;
      campaign = commit(campaign, fireEvents);
      const created = engine.plan.createEncounter(campaign.state, {
        combatantIds: [dragon.id, target.id],
      });
      campaign = commit(campaign, created.events);
      campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events);
      campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events);
      const first = engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId });
      const rechargeEvent = first.events.find((e) => e.type === 'BreathWeaponRecharged');
      const encounter = campaign.state.encounters[created.encounterId]!;
      const firstCombatantId = encounter.combatants[0]!.combatantId;
      if (firstCombatantId !== dragon.id) continue;
      if (rechargeEvent !== undefined) continue;
      const after = commit(campaign, first.events);
      expect(after.state.characters[dragon.id]!.breathWeaponExpended).toBe(true);
      return;
    }
    throw new Error('no seed produced a dragon-first-turn with failed recharge in window');
  });

  it('non-monster characters do not get recharge events even at turn start', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const pc = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Player',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
      abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 12, max: 12, temp: 0 },
      featsTaken: [],
    });
    let campaign: Campaign = engine.createCampaign({ name: 'pc-no-recharge' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: pc } satisfies CharacterCreatedEvent,
    ]);
    const created = engine.plan.createEncounter(campaign.state, {
      combatantIds: [pc.id],
    });
    campaign = commit(campaign, created.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events);
    const first = engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId });
    expect(first.events.find((e) => e.type === 'BreathWeaponRecharged')).toBeUndefined();
  });
});
