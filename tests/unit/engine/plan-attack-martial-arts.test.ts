import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { ItemInstanceSchema, type ItemInstance } from '../../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Monk Martial Arts die scaling (Monk L1/5/11/17). Bug this
// prevents: a Monk swinging an unarmed strike rolls 1d4 (the weapon's
// natural die) instead of the Martial Arts die (1d6 → 1d12 by tier).

const PACK = loadStarterPack();

const buildMonk = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: `Monk L${level}`,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level, hitDiceRemaining: level }],
    abilityScores: { STR: 14, DEX: 16, CON: 14, INT: 10, WIS: 14, CHA: 10 },
    hp: { current: 50 + level * 6, max: 50 + level * 6, temp: 0 },
    featsTaken: [],
  });

const buildFighter = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Brawler',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Dummy',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 100, max: 100, temp: 0 },
    featsTaken: [],
  });

interface SeededFight {
  readonly engine: ReturnType<typeof createEngine>;
  readonly campaign: Campaign;
  readonly attackerId: string;
  readonly targetId: string;
  readonly fistsId: string;
}

const seedAttack = (attacker: Character, seed = 7): SeededFight => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const fists: ItemInstance = ItemInstanceSchema.parse({
    id: newItemInstanceId(),
    definitionId: 'unarmed-strike',
  });
  const target = buildTarget();
  let campaign: Campaign = engine.createCampaign({ name: 'martial-arts' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: fists },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, attackerId: attacker.id, targetId: target.id, fistsId: fists.id };
};

// Iterates seeds until the attack hits (so DamageRolled is emitted),
// then returns the dice expression used. AC 10 with STR 14 / DEX 16
// gives ~+3 to hit, so most rolls hit.
const damageDieFor = (attacker: Character): string => {
  for (let seed = 0; seed < 500; seed++) {
    const { engine, campaign, attackerId, targetId, fistsId } = seedAttack(attacker, seed);
    const events = engine.plan.attack(campaign.state, {
      attackerId,
      targetId,
      weaponInstanceId: fistsId,
    }).events;
    const damageRolled = events.find((e) => e.type === 'DamageRolled') as DamageRolledEvent | undefined;
    if (damageRolled !== undefined) {
      const expr = damageRolled.rolls[0]?.expression;
      if (expr !== undefined) return expr;
    }
  }
  throw new Error('no hit in 500 seeds — investigate');
};

describe('Martial Arts die scaling', () => {
  it('Monk L1 unarmed strike uses 1d6 (Martial Arts die replaces natural 1d4)', () => {
    expect(damageDieFor(buildMonk(1))).toBe('1d6');
  });

  it('Monk L5 unarmed strike uses 1d8', () => {
    expect(damageDieFor(buildMonk(5))).toBe('1d8');
  });

  it('Monk L11 unarmed strike uses 1d10', () => {
    expect(damageDieFor(buildMonk(11))).toBe('1d10');
  });

  it('Monk L17 unarmed strike uses 1d12', () => {
    expect(damageDieFor(buildMonk(17))).toBe('1d12');
  });

  it('Monk L4 (below L5 threshold) still uses 1d6', () => {
    expect(damageDieFor(buildMonk(4))).toBe('1d6');
  });

  it('non-Monk unarmed strike uses the weapon natural 1d4', () => {
    expect(damageDieFor(buildFighter())).toBe('1d4');
  });

  it('Monk wielding a longsword does NOT scale (only unarmed-strike scales)', () => {
    const monk = buildMonk(11);
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(3) });
    const longsword = ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });
    const target = buildTarget();
    let campaign: Campaign = engine.createCampaign({ name: 'monk-with-sword' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: monk } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    for (let seed = 0; seed < 500; seed++) {
      const engineSeeded = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const events = engineSeeded.plan.attack(campaign.state, {
        attackerId: monk.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const damageRolled = events.find((e) => e.type === 'DamageRolled') as DamageRolledEvent | undefined;
      if (damageRolled !== undefined) {
        expect(damageRolled.rolls[0]?.expression).toBe('1d8');
        return;
      }
    }
    throw new Error('no hit in 500 seeds');
  });
});
