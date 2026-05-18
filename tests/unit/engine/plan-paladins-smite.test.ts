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
import { newCharacterId, newItemInstanceId, newEventId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent, ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import type { SpellSlotConsumedEvent } from '../../../src/schemas/events/spellcasting.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import type { ULID } from '../../../src/engine/ids-utils.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 210: Paladin L2 Paladin's Smite. RAW: when you hit with a
// melee weapon / Unarmed Strike, as a Bonus Action expend a Paladin
// spell slot to deal 2d8 radiant + 1d8 per slot level above 1st;
// +1d8 if the target is Undead or Fiend. Implemented as a dedicated
// reaction-style planner the consumer invokes after a confirmed hit.

const PACK = loadStarterPack();

const buildPaladin = (level: number = 5): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Aria',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'paladin', level, hitDiceRemaining: level }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 12, CHA: 16 },
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

const buildScene = (paladinLevel: number = 5) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(210) });
  const paladin = buildPaladin(paladinLevel);
  const target = buildTarget();
  let campaign: Campaign = engine.createCampaign({ name: 'paladins-smite' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: paladin } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, paladinId: paladin.id, targetId: target.id };
};

const fakeAttackEventId = (): ULID => newEventId() as ULID;

describe('engine.plan.paladinsSmite', () => {
  it('slot 1 spends one level-1 slot and emits a DamageApplied with radiant', () => {
    const { engine, campaign, paladinId, targetId } = buildScene();
    const result = engine.plan.paladinsSmite(campaign.state, {
      paladinId,
      targetId,
      slotLevel: 1,
      triggeringAttackEventId: fakeAttackEventId(),
    });
    const slot = result.events.find((e): e is SpellSlotConsumedEvent => e.type === 'SpellSlotConsumed');
    expect(slot?.slotLevel).toBe(1);
    const damage = result.events.find((e): e is DamageAppliedEvent => e.type === 'DamageApplied');
    expect(damage).toBeDefined();
    expect(damage!.targetId).toBe(targetId);
    expect(damage!.source).toBe('paladins-smite');
    const radiant = damage!.components.find((c) => c.type === 'radiant');
    expect(radiant).toBeDefined();
    // 2d8 → between 2 and 16.
    expect(radiant!.amount).toBeGreaterThanOrEqual(2);
    expect(radiant!.amount).toBeLessThanOrEqual(16);
  });

  it('slot 2 rolls 3d8 base radiant damage (range 3 to 24)', () => {
    // L5 paladin (half-caster) has 2nd-level slots; level 3 slots
    // unlock at L9.
    const { engine, campaign, paladinId, targetId } = buildScene();
    const result = engine.plan.paladinsSmite(campaign.state, {
      paladinId,
      targetId,
      slotLevel: 2,
      triggeringAttackEventId: fakeAttackEventId(),
    });
    const damage = result.events.find((e): e is DamageAppliedEvent => e.type === 'DamageApplied')!;
    const radiant = damage.components.find((c) => c.type === 'radiant')!;
    // 3d8 → 3..24.
    expect(radiant.amount).toBeGreaterThanOrEqual(3);
    expect(radiant.amount).toBeLessThanOrEqual(24);
  });

  it('targetIsUndeadOrFiend adds an extra d8', () => {
    const { engine, campaign, paladinId, targetId } = buildScene();
    const result = engine.plan.paladinsSmite(campaign.state, {
      paladinId,
      targetId,
      slotLevel: 1,
      triggeringAttackEventId: fakeAttackEventId(),
      targetIsUndeadOrFiend: true,
    });
    const damage = result.events.find((e): e is DamageAppliedEvent => e.type === 'DamageApplied')!;
    const radiant = damage.components.find((c) => c.type === 'radiant')!;
    // 3d8 → 3..24.
    expect(radiant.amount).toBeGreaterThanOrEqual(3);
    expect(radiant.amount).toBeLessThanOrEqual(24);
  });

  it('throws on slotLevel < 1', () => {
    const { engine, campaign, paladinId, targetId } = buildScene();
    expect(() =>
      engine.plan.paladinsSmite(campaign.state, {
        paladinId,
        targetId,
        slotLevel: 0,
        triggeringAttackEventId: fakeAttackEventId(),
      }),
    ).toThrow(/between 1 and 5/);
  });

  it('throws when the paladin has no slot of the requested level', () => {
    // L1 paladin doesn't have a 2nd-level slot.
    const { engine, campaign, paladinId, targetId } = buildScene(1);
    expect(() =>
      engine.plan.paladinsSmite(campaign.state, {
        paladinId,
        targetId,
        slotLevel: 2,
        triggeringAttackEventId: fakeAttackEventId(),
      }),
    ).toThrow(/level-2 spell slot remaining/);
  });
});
