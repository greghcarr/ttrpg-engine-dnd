// Slice 111 — on-fatal-damage trigger primitive (Death Ward).
//
// PreventFatalDamage marker effect on a condition; primary-damage
// planners consult `interceptFatalDamage` after mitigation. When
// incoming damage would drop the bearer's HP to 0 or below, the
// helper scales the damage components proportionally so HP lands at
// 1 and emits a paired ConditionRemoved that clears the bearing
// condition. Tested through Death Ward as canonical user.

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
import { eventId, isoTimestamp } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildCleric = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Warder',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level: 7, hitDiceRemaining: 7 }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 42, max: 42, temp: 0 },
    featsTaken: [],
    preparedSpells: ['death-ward', 'sacred-flame', 'inflict-wounds'],
  });

const buildVictim = (hp: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Victim',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 12, DEX: 10, CON: 12, INT: 8, WIS: 8, CHA: 8 },
    hp: { current: hp, max: hp, temp: 0 },
    featsTaken: [],
  });

const seedDeathWarded = (victimHp: number): {
  campaign: Campaign;
  engine: ReturnType<typeof createEngine>;
  casterId: string;
  victimId: string;
} => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
  const caster = buildCleric();
  const victim = buildVictim(victimHp);
  let campaign: Campaign = engine.createCampaign({ name: 'death-ward' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: victim } satisfies CharacterCreatedEvent,
  ]);
  // Seed death-ward-active directly so the test is independent of
  // cast-spell mechanics. The buff branch is exercised separately by
  // the buff smoke test in spell-coverage.test.ts.
  const ward: ConditionAppliedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'ConditionApplied',
    targetId: victim.id,
    conditionId: 'death-ward-active',
    appliedConditionId: newAppliedConditionId(),
    sourceCharacterId: caster.id,
  };
  campaign = commit(campaign, [ward]);
  return { campaign, engine, casterId: caster.id, victimId: victim.id };
};

describe('Death Ward on-fatal-damage intercept', () => {
  it('clamps a would-be-fatal spell hit so HP lands at 1 and removes the condition', () => {
    const { campaign, engine, casterId, victimId } = seedDeathWarded(8);
    // Inflict Wounds is melee-spell-attack 3d10 necrotic at L1 — well
    // over 8 HP on most rolls. We don't need the attack to crit; even
    // a low roll on 3d10 averages 16.5, way past the threshold.
    let outcome: { events: ReadonlyArray<DamageAppliedEvent | ConditionRemovedEvent | unknown> } | undefined;
    for (let seed = 1; seed < 80; seed += 1) {
      const e = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const events = e.plan.castSpell(campaign.state, {
        characterId: casterId,
        spellId: 'inflict-wounds',
        slotLevel: 1,
        targetIds: [victimId],
      }).events;
      const dmg = events.find((ev): ev is DamageAppliedEvent => ev.type === 'DamageApplied');
      // Find a seed that produced enough damage to be fatal pre-intercept.
      if (dmg !== undefined && dmg.components.reduce((s, c) => s + c.amount, 0) > 0) {
        outcome = { events };
        break;
      }
    }
    if (outcome === undefined) throw new Error('no seed produced damage');

    const damageApplied = outcome.events.find(
      (e): e is DamageAppliedEvent => (e as DamageAppliedEvent).type === 'DamageApplied',
    );
    expect(damageApplied).toBeDefined();
    const total = damageApplied!.components.reduce((s, c) => s + c.amount, 0);
    // After intercept, total = current(8) - 1 + temp(0) = 7.
    expect(total).toBe(7);

    const removed = outcome.events.find(
      (e): e is ConditionRemovedEvent =>
        (e as ConditionRemovedEvent).type === 'ConditionRemoved'
        && (e as ConditionRemovedEvent).conditionId === 'death-ward-active'
        && (e as ConditionRemovedEvent).targetId === victimId,
    );
    expect(removed).toBeDefined();

    const after = commit(campaign, outcome.events);
    expect(after.state.characters[victimId]!.hp.current).toBe(1);
    expect(
      after.state.characters[victimId]!.appliedConditions.some(
        (c) => c.conditionId === 'death-ward-active',
      ),
    ).toBe(false);
  });

  it('non-fatal damage leaves the condition intact', () => {
    const { campaign, engine, casterId, victimId } = seedDeathWarded(40);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: casterId,
      spellId: 'sacred-flame',
      slotLevel: 0,
      targetIds: [victimId],
    }).events;
    const removed = events.find(
      (e) => e.type === 'ConditionRemoved'
        && (e as ConditionRemovedEvent).conditionId === 'death-ward-active',
    );
    expect(removed).toBeUndefined();
    const after = commit(campaign, events);
    expect(
      after.state.characters[victimId]!.appliedConditions.some(
        (c) => c.conditionId === 'death-ward-active',
      ),
    ).toBe(true);
  });

  it('falling damage that would drop the bearer triggers the intercept', () => {
    const { campaign, engine, victimId } = seedDeathWarded(5);
    const events = engine.plan.falling(campaign.state, {
      characterId: victimId,
      distanceFeet: 100,
    }).events;
    const damageApplied = events.find(
      (e): e is DamageAppliedEvent => e.type === 'DamageApplied',
    );
    expect(damageApplied).toBeDefined();
    const total = damageApplied!.components.reduce((s, c) => s + c.amount, 0);
    expect(total).toBe(4); // current(5) - 1 + temp(0)
    const removed = events.find(
      (e): e is ConditionRemovedEvent =>
        e.type === 'ConditionRemoved'
        && (e as ConditionRemovedEvent).conditionId === 'death-ward-active',
    );
    expect(removed).toBeDefined();
    const after = commit(campaign, events);
    expect(after.state.characters[victimId]!.hp.current).toBe(1);
  });

  it('damage to a target without the condition is passthrough', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(7) });
    const caster = buildCleric();
    const victim = buildVictim(8);
    let campaign: Campaign = engine.createCampaign({ name: 'no-ward' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: victim } satisfies CharacterCreatedEvent,
    ]);
    const events = engine.plan.falling(campaign.state, {
      characterId: victim.id,
      distanceFeet: 100,
    }).events;
    const damageApplied = events.find(
      (e): e is DamageAppliedEvent => e.type === 'DamageApplied',
    );
    expect(damageApplied).toBeDefined();
    // No intercept: 100 ft fall is 10d6 capped at 20d6 = 100 ft → 10d6.
    // Total should be at least 10 (min 1 per die). The point is it's
    // not clamped to (current - 1).
    const total = damageApplied!.components.reduce((s, c) => s + c.amount, 0);
    expect(total).toBeGreaterThanOrEqual(10);
    const removed = events.find((e) => e.type === 'ConditionRemoved');
    expect(removed).toBeUndefined();
  });
});
