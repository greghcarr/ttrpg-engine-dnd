// Slice 114 — rider-aware on-fatal-damage intercept.
//
// dispatchTriggers now advances a runningState via applyAll between
// fired triggers, and fireAddDamage / fireAddDamageToAttacker consult
// interceptFatalDamage on their emitted DamageApplied events. The
// net effect: rider damage that would drop the bearer to 0 HP now
// correctly triggers Death Ward (and any future PreventFatalDamage
// holder), even when the rider commits before the main damage.
//
// The pre-slice-114 limitation was: Sneak Attack drops the target
// alone → rider's raw DamageApplied applies first → target.hp <= 0 →
// planner-side intercept on the main attack damage sees target
// already downed and bails as passthrough → Death Ward stays applied
// → target drops normally. After slice 114, the rider's DamageApplied
// itself triggers the intercept and Death Ward is consumed.

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
import type { Event } from '../../../src/schemas/events/index.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildRogue = (swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Sneak',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'rogue', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 18, CON: 14, INT: 10, WIS: 10, CHA: 8 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const buildAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ally',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

const buildVictim = (hp: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Victim',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 12, CON: 12, INT: 16, WIS: 12, CHA: 10 },
    hp: { current: hp, max: hp, temp: 0 },
    featsTaken: [],
  });

interface SeedResult {
  events: ReadonlyArray<Event>;
  rolled: AttackRolledEvent;
  rogueId: string;
  victimId: string;
  campaign: Campaign;
}

const seedAttack = (opts: { victimHp: number; warded: boolean }): SeedResult => {
  for (let seed = 1; seed < 200; seed += 1) {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
    const sword = makeItemInstance('longsword');
    const rogue = buildRogue(sword.id);
    const ally = buildAlly();
    const victim = buildVictim(opts.victimHp);
    let campaign: Campaign = engine.createCampaign({ name: `slice114-${seed}` });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: rogue } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: victim } satisfies CharacterCreatedEvent,
    ]);
    if (opts.warded) {
      const ward: ConditionAppliedEvent = {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: victim.id,
        conditionId: 'death-ward-active',
        appliedConditionId: newAppliedConditionId(),
      };
      campaign = commit(campaign, [ward]);
    }
    const events = engine.plan.attack(campaign.state, {
      attackerId: rogue.id,
      targetId: victim.id,
      weaponInstanceId: sword.id,
    }).events;
    const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
    if (rolled?.hit !== true) continue;
    return { events, rolled, rogueId: rogue.id, victimId: victim.id, campaign };
  }
  throw new Error('no hit landed in 200 seeds');
};

const damageEventsTargeting = (
  events: ReadonlyArray<Event>,
  targetId: string,
): DamageAppliedEvent[] =>
  events.filter(
    (e): e is DamageAppliedEvent => e.type === 'DamageApplied' && e.targetId === targetId,
  );

describe('rider-aware fatal-damage intercept', () => {
  it('rider damage that would drop a death-warded target triggers the ward', () => {
    // Victim HP 2: even the minimum Sneak Attack rider (3 piercing)
    // would drop them. Death-warded → the rider's DamageApplied is
    // scaled so HP lands at 1 and the ward is consumed before the
    // main damage applies.
    const scene = seedAttack({ victimHp: 2, warded: true });
    const removed = scene.events.find(
      (e): e is ConditionRemovedEvent =>
        e.type === 'ConditionRemoved'
        && e.targetId === scene.victimId
        && (e as ConditionRemovedEvent).conditionId === 'death-ward-active',
    );
    expect(removed).toBeDefined();

    const damages = damageEventsTargeting(scene.events, scene.victimId);
    expect(damages.length).toBeGreaterThanOrEqual(1);
    // The first damage event that would drop HP to 0 should be
    // clamped. Pre-slice-114 it would be raw.
    const firstDamageTotal = damages[0]!.components.reduce((s, c) => s + c.amount, 0);
    expect(firstDamageTotal).toBe(1); // current(2) - 1 + temp(0).

    // After commit, the ward is gone. The follow-up main damage
    // applies on top with no ward → victim downed; that's RAW.
    const after = commit(scene.campaign, scene.events);
    expect(
      after.state.characters[scene.victimId]!.appliedConditions.some(
        (c) => c.conditionId === 'death-ward-active',
      ),
    ).toBe(false);
  });

  it('non-warded target takes rider damage unmodified', () => {
    const scene = seedAttack({ victimHp: 2, warded: false });
    const removed = scene.events.find((e) => e.type === 'ConditionRemoved');
    expect(removed).toBeUndefined();
    const damages = damageEventsTargeting(scene.events, scene.victimId);
    expect(damages.length).toBeGreaterThanOrEqual(1);
    const firstTotal = damages[0]!.components.reduce((s, c) => s + c.amount, 0);
    // First damage event hits with full (unclamped) sneak-attack
    // damage. Should be at least 3 (minimum 3d6).
    expect(firstTotal).toBeGreaterThanOrEqual(3);
  });

  it('non-fatal rider damage leaves the ward intact', () => {
    // Victim HP 100: neither sneak attack (max 18) nor main damage
    // (max ~12) drops them. No intercept fires; ward stays applied.
    const scene = seedAttack({ victimHp: 100, warded: true });
    const removed = scene.events.find(
      (e) => e.type === 'ConditionRemoved'
        && (e as ConditionRemovedEvent).conditionId === 'death-ward-active',
    );
    expect(removed).toBeUndefined();
    const after = commit(scene.campaign, scene.events);
    expect(
      after.state.characters[scene.victimId]!.appliedConditions.some(
        (c) => c.conditionId === 'death-ward-active',
      ),
    ).toBe(true);
  });
});
