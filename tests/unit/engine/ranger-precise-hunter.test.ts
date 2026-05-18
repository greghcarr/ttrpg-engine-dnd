import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

// Slice 231: Ranger L17 Precise Hunter ("while your Hunter's Mark
// spell is on a creature, you have Advantage on attack rolls against
// that creature"). Wired via the new
// GrantAdvantageVsBearersOfMyCondition primitive: the ranger bears
// the marker; the attack planner checks the target's
// hunters-mark-active condition for a sourceCharacterId match against
// the attacker; on match, advantage applies.

const PACK = loadStarterPack();

const buildRanger = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Cassian',
    speciesId: 'human',
    backgroundId: 'outlander',
    classes: [{ classId: 'ranger', level, hitDiceRemaining: level }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
    preparedSpells: ['hunters-mark'],
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
  });

const buildBystander = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bystander Ranger',
    speciesId: 'human',
    backgroundId: 'outlander',
    classes: [{ classId: 'ranger', level: 17, hitDiceRemaining: 17 }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    preparedSpells: ['hunters-mark'],
  });

describe('Ranger L17 Precise Hunter (slice 231)', () => {
  it('an L17 ranger has advantage on attacks against their own Hunter\'s-Marked target', () => {
    for (let seed = 1; seed < 50; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const longsword = makeItemInstance('longsword');
      const ranger = buildRanger(17);
      const target = buildTarget();
      let campaign: Campaign = engine.createCampaign({ name: `precise-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      campaign = commit(
        campaign,
        engine.plan.castSpell(campaign.state, {
          characterId: ranger.id,
          spellId: 'hunters-mark',
          slotLevel: 1,
          targetIds: [target.id],
        }).events,
      );

      const events = engine.plan.attack(campaign.state, {
        attackerId: ranger.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const attackRolled = events.find((e) => e.type === 'AttackRolled') as AttackRolledEvent | undefined;
      if (!attackRolled) continue;
      expect(attackRolled.used).toBe('advantage');
      return;
    }
    throw new Error('no seed produced an AttackRolled event');
  });

  it('an L16 ranger (no Precise Hunter yet) does NOT get advantage even with Hunter\'s Mark active', () => {
    for (let seed = 1; seed < 50; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const longsword = makeItemInstance('longsword');
      const ranger = buildRanger(16);
      const target = buildTarget();
      let campaign: Campaign = engine.createCampaign({ name: `no-precise-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      campaign = commit(
        campaign,
        engine.plan.castSpell(campaign.state, {
          characterId: ranger.id,
          spellId: 'hunters-mark',
          slotLevel: 1,
          targetIds: [target.id],
        }).events,
      );

      const events = engine.plan.attack(campaign.state, {
        attackerId: ranger.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const attackRolled = events.find((e) => e.type === 'AttackRolled') as AttackRolledEvent | undefined;
      if (!attackRolled) continue;
      expect(attackRolled.used).not.toBe('advantage');
      return;
    }
    throw new Error('no seed produced an AttackRolled event');
  });

  it('an L17 ranger does NOT get advantage against a creature marked by a DIFFERENT ranger', () => {
    for (let seed = 1; seed < 50; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const longsword = makeItemInstance('longsword');
      const ranger = buildRanger(17);
      const bystander = buildBystander();
      const target = buildTarget();
      let campaign: Campaign = engine.createCampaign({ name: `wrong-source-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bystander } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      // Bystander ranger marks the target — not our L17 ranger.
      campaign = commit(
        campaign,
        engine.plan.castSpell(campaign.state, {
          characterId: bystander.id,
          spellId: 'hunters-mark',
          slotLevel: 1,
          targetIds: [target.id],
        }).events,
      );

      const events = engine.plan.attack(campaign.state, {
        attackerId: ranger.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const attackRolled = events.find((e) => e.type === 'AttackRolled') as AttackRolledEvent | undefined;
      if (!attackRolled) continue;
      expect(attackRolled.used).not.toBe('advantage');
      return;
    }
    throw new Error('no seed produced an AttackRolled event');
  });

  it('an L17 ranger attacking an unmarked target gets no advantage', () => {
    for (let seed = 1; seed < 50; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const longsword = makeItemInstance('longsword');
      const ranger = buildRanger(17);
      const target = buildTarget();
      let campaign: Campaign = engine.createCampaign({ name: `unmarked-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      // Don't cast Hunter's Mark — target is unmarked.

      const events = engine.plan.attack(campaign.state, {
        attackerId: ranger.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const attackRolled = events.find((e) => e.type === 'AttackRolled') as AttackRolledEvent | undefined;
      if (!attackRolled) continue;
      expect(attackRolled.used).not.toBe('advantage');
      return;
    }
    throw new Error('no seed produced an AttackRolled event');
  });
});
