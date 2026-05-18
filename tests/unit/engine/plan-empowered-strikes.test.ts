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
import {
  newCharacterId,
  newItemInstanceId,
  newAppliedConditionId,
} from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ConditionAppliedEvent,
  DamageAppliedEvent,
} from '../../../src/schemas/events/combat.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 207: Monk L6 Empowered Strikes. RAW: "Your Unarmed Strikes
// count as magical for the purposes of overcoming Resistance and
// Immunity to nonmagical damage." Wired via `GrantUnarmedAsMagical`
// marker; `isMagicWeaponAttack` in src/derive/magicality.ts returns
// true for unarmed-strike attacks whose attacker carries the marker.

const PACK = loadStarterPack();

const unarmedStrike = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'unarmed-strike' });

const buildMonk = (level: number, strikeId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Kai',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level, hitDiceRemaining: level }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
    inventory: [strikeId],
    equipped: { mainHand: strikeId, attuned: [] },
  });

const buildStoneskinnedTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Warded',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 8, CON: 12, INT: 16, WIS: 12, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const seedScene = (monkLevel: number) => {
  const strike = unarmedStrike();
  const monk = buildMonk(monkLevel, strike.id);
  const target = buildStoneskinnedTarget();
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(207) });
  let campaign: Campaign = engine.createCampaign({ name: `empowered-${monkLevel}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: strike },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: monk } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: target.id,
      conditionId: 'stoneskin-active',
      appliedConditionId: newAppliedConditionId(),
    } satisfies ConditionAppliedEvent,
  ]);
  return { engine, campaign, monkId: monk.id, targetId: target.id, strikeId: strike.id };
};

const firstHit = (
  scene: ReturnType<typeof seedScene>,
): DamageAppliedEvent => {
  for (let seed = 1; seed < 80; seed += 1) {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
    const events = engine.plan.attack(scene.campaign.state, {
      attackerId: scene.monkId,
      targetId: scene.targetId,
      weaponInstanceId: scene.strikeId,
    }).events;
    const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
    if (rolled?.hit !== true) continue;
    const damage = events.find(
      (e): e is DamageAppliedEvent =>
        e.type === 'DamageApplied' && e.targetId === scene.targetId,
    );
    if (damage !== undefined) return damage;
  }
  throw new Error('no hit landed in 80 seeds');
};

describe('Empowered Strikes (Monk L6)', () => {
  it('L6 Monk unarmed strike does NOT trigger nonmagical-bludgeoning resistance', () => {
    const scene = seedScene(6);
    const damage = firstHit(scene);
    expect(damage.components[0]!.mitigation).toBeUndefined();
  });

  it('L5 Monk unarmed strike DOES trigger nonmagical-bludgeoning resistance (control)', () => {
    const scene = seedScene(5);
    const damage = firstHit(scene);
    expect(damage.components[0]!.mitigation).toBe('resisted');
  });
});
