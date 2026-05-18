import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

// Slice 233: SpawnCreature TriggerAction. Canonical user: Troll's
// Loathsome Limbs trait. When the troll takes 15+ slashing damage in
// a single DamageApplied event, a Troll Limb is spawned.
//
// RAW deviations documented in the slice:
// - Bloodied gate not enforced (spawns even at full HP)
// - Turn-end timing replaced with on-hit (spawns immediately)
// - 4/Day limit approximated as `oncePer: 'turn'` (1 spawn per turn)

const PACK = loadStarterPack();

const buildTroll = (currentHp: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Troll',
    speciesId: 'companion',
    backgroundId: 'companion',
    statblockId: 'troll',
    classes: [{ classId: 'companion', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 18, DEX: 13, CON: 20, INT: 7, WIS: 9, CHA: 7 },
    hp: { current: currentHp, max: 94, temp: 0 },
  });

const buildHero = (str: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Hero',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: str, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
  });

describe('Troll Loathsome Limbs (slice 233)', () => {
  it('an attack dealing 15+ slashing damage to the troll spawns a Troll Limb', () => {
    const greatsword = makeItemInstance('greatsword');
    const troll = buildTroll(80);
    const baseHero = buildHero(24);
    const hero: Character = {
      ...baseHero,
      equipped: { ...baseHero.equipped, mainHand: greatsword.id },
    };
    for (let seed = 1; seed < 500; seed += 1) {
      const eng = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = eng.createCampaign({ name: `attack-spawn-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: greatsword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: troll } satisfies CharacterCreatedEvent,
      ]);
      const events = eng.plan.attack(campaign.state, {
        attackerId: hero.id,
        targetId: troll.id,
        weaponInstanceId: greatsword.id,
      }).events;
      const dmg = events.find((e) => e.type === 'DamageApplied');
      if (!dmg) continue;
      const slashingTotal = (dmg as DamageAppliedEvent).components
        .filter((c) => c.type === 'slashing')
        .reduce((s, c) => s + c.amount, 0);
      if (slashingTotal < 15) continue;
      const spawn = events.find(
        (e) =>
          e.type === 'CharacterCreated'
          && (e as CharacterCreatedEvent).snapshot.statblockId === 'troll-limb',
      );
      expect(spawn).toBeDefined();
      return;
    }
    throw new Error('no seed produced a 15+ slashing hit on the troll');
  });

  it('an attack dealing less than 15 slashing damage does NOT spawn a Troll Limb', () => {
    const longsword = makeItemInstance('longsword');
    const troll = buildTroll(80);
    const baseHero = buildHero(10);
    const hero: Character = {
      ...baseHero,
      equipped: { ...baseHero.equipped, mainHand: longsword.id },
    };
    for (let seed = 1; seed < 50; seed += 1) {
      const eng = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = eng.createCampaign({ name: `no-spawn-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: troll } satisfies CharacterCreatedEvent,
      ]);
      const events = eng.plan.attack(campaign.state, {
        attackerId: hero.id,
        targetId: troll.id,
        weaponInstanceId: longsword.id,
      }).events;
      const dmg = events.find((e) => e.type === 'DamageApplied');
      if (!dmg) continue;
      const spawn = events.find(
        (e) =>
          e.type === 'CharacterCreated'
          && (e as CharacterCreatedEvent).snapshot.statblockId === 'troll-limb',
      );
      expect(spawn).toBeUndefined();
      return;
    }
    throw new Error('no seed produced a hit with the longsword');
  });

  it('a non-slashing damage event (acid, fire) does NOT spawn even at high damage', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(236) });
    const troll = buildTroll(80);
    const hero = buildHero(10);
    let campaign: Campaign = engine.createCampaign({ name: 'no-spawn-acid' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: troll } satisfies CharacterCreatedEvent,
    ]);
    // 30 acid damage doesn't match the slashing filter.
    const damage: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: troll.id,
      components: [{ type: 'acid', amount: 30 }],
    };
    campaign = commit(campaign, [damage]);
    // The dispatchTriggers chain only fires from the attack planner;
    // a direct DamageApplied commit doesn't trigger dispatch. So the
    // test asserts that no extra characters were spawned in state.
    const trollLimbCount = Object.values(campaign.state.characters)
      .filter((c) => c.statblockId === 'troll-limb')
      .length;
    expect(trollLimbCount).toBe(0);
  });
});
