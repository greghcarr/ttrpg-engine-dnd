import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { ItemInstanceSchema } from '../../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Improved Critical (Champion L3 subclass) via the starter pack.
// Bug this prevents: a Champion Fighter swinging a longsword on a nat
// 19 should crit, but engine treats only nat 20 as a crit.

const PACK = loadStarterPack();

const buildChampionFighter = (opts: { subclass: boolean }): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: opts.subclass ? 'Drago (Champion)' : 'Drago (Plain)',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [
      {
        classId: 'fighter',
        level: 3,
        hitDiceRemaining: 3,
        ...(opts.subclass ? { subclassId: 'champion' } : {}),
      },
    ],
    abilityScores: { STR: 18, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
  });

const buildTarget = (armorInstanceId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 14, DEX: 10, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
    equipped: { armor: armorInstanceId, attuned: [] },
  });

interface SeededFight {
  readonly engine: ReturnType<typeof createEngine>;
  readonly campaign: Campaign;
  readonly attackerId: string;
  readonly targetId: string;
  readonly weaponId: string;
}

const seedFight = (attacker: Character, rng = seededRNG(0)): SeededFight => {
  const engine = createEngine({ contentPacks: [PACK], rng });
  const longsword = ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });
  const armor = ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'chain-mail' });
  const target = buildTarget(armor.id);
  let campaign: Campaign = engine.createCampaign({ name: 'crit-test' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: armor },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, attackerId: attacker.id, targetId: target.id, weaponId: longsword.id };
};

// Iterate seeds, stop on the first one that rolls a nat 19 (the
// untaken d20 in advantage/disadvantage doesn't matter — we use the
// plain attack path so there's only one die).
const findNat19Seed = (build: () => SeededFight): { rolled: AttackRolledEvent } => {
  for (let seed = 0; seed < 2000; seed++) {
    const fight = seedFight(buildChampionFighter({ subclass: true }), seededRNG(seed));
    const ev = fight.engine.plan.attack(fight.campaign.state, {
      attackerId: fight.attackerId,
      targetId: fight.targetId,
      weaponInstanceId: fight.weaponId,
    }).events;
    const rolled = ev[0] as AttackRolledEvent;
    if (rolled.d20[0] === 19) return { rolled };
  }
  throw new Error('no nat-19 found in 2000 seeds');
  void build;
};

describe('Improved Critical (Champion L3)', () => {
  it('Champion fighter crits on natural 19', () => {
    const { rolled } = findNat19Seed(() => seedFight(buildChampionFighter({ subclass: true })));
    expect(rolled.d20[0]).toBe(19);
    expect(rolled.hit).toBe(true);
    expect(rolled.critical).toBe(true);
  });

  it('plain Fighter (no Champion) does NOT crit on natural 19', () => {
    // Find a seed where a nat 19 occurs; assert plain fighter is not
    // a crit.
    for (let seed = 0; seed < 2000; seed++) {
      const fight = seedFight(buildChampionFighter({ subclass: false }), seededRNG(seed));
      const ev = fight.engine.plan.attack(fight.campaign.state, {
        attackerId: fight.attackerId,
        targetId: fight.targetId,
        weaponInstanceId: fight.weaponId,
      }).events;
      const rolled = ev[0] as AttackRolledEvent;
      if (rolled.d20[0] === 19) {
        expect(rolled.critical).toBe(false);
        return;
      }
    }
    throw new Error('no nat-19 found in 2000 seeds');
  });

  it('Champion fighter still auto-hits + crits on natural 20', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const fight = seedFight(buildChampionFighter({ subclass: true }), seededRNG(seed));
      const ev = fight.engine.plan.attack(fight.campaign.state, {
        attackerId: fight.attackerId,
        targetId: fight.targetId,
        weaponInstanceId: fight.weaponId,
      }).events;
      const rolled = ev[0] as AttackRolledEvent;
      if (rolled.d20[0] === 20) {
        expect(rolled.hit).toBe(true);
        expect(rolled.critical).toBe(true);
        return;
      }
    }
    throw new Error('no nat-20 found in 2000 seeds');
  });

  it('Champion fighter does NOT crit on natural 18', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const fight = seedFight(buildChampionFighter({ subclass: true }), seededRNG(seed));
      const ev = fight.engine.plan.attack(fight.campaign.state, {
        attackerId: fight.attackerId,
        targetId: fight.targetId,
        weaponInstanceId: fight.weaponId,
      }).events;
      const rolled = ev[0] as AttackRolledEvent;
      if (rolled.d20[0] === 18) {
        expect(rolled.critical).toBe(false);
        return;
      }
    }
    throw new Error('no nat-18 found in 2000 seeds');
  });
});
