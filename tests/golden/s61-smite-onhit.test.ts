// Golden scenario: on-hit trigger primitive.
//
// Searing Smite (one-shot): Paladin casts as a Bonus Action; on the next
// weapon attack that hits, +1d6 fire fires via the `OnEvent` rider, and
// the spell's concentration breaks via the new `consumeOnTrigger` path.
// A subsequent attack does not fire the smite (the condition is gone).
//
// Divine Favor (duration): Paladin casts; every weapon attack that hits
// for the spell's duration fires +1d4 radiant. The rider does NOT consume
// on trigger — concentration persists until something else ends it.
//
// Together these prove the two halves of the on-hit trigger primitive:
// the `consumeOnTrigger` flag lifts the parent condition (and breaks
// concentration when tracked) after firing, and the default behavior is
// the existing every-hit rider that Sneak Attack already exercises.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { commit } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../src/ids.js';
import { eventId, isoTimestamp, makeItemInstance } from '../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../src/schemas/events/attack.js';

const buildPaladin = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ariadne',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'paladin', level: 2, hitDiceRemaining: 2 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 12, CHA: 16 },
    hp: { current: 22, max: 22, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['searing-smite', 'divine-favor'],
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

describe('golden: on-hit trigger primitive (smite cohort)', () => {
  it('Searing Smite fires once on first hit, breaks concentration, second hit does not fire', () => {
    const STARTER_PACK = loadStarterPack();
    // Seed-search: find a seed where the paladin's first weapon attack
    // after casting Searing Smite is a hit. The smite rider needs a hit
    // to fire; a miss leaves both the spell and the test inconclusive.
    let attempt = 0;
    let proven = false;
    while (attempt < 100 && !proven) {
      attempt += 1;
      const engine = createEngine({ contentPacks: [STARTER_PACK], rng: seededRNG(attempt) });
      const longsword = makeItemInstance('longsword');
      const paladin = buildPaladin();
      const target = buildTarget();
      let campaign = engine.createCampaign({ name: 'smite' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'CharacterCreated',
          snapshot: paladin,
        } satisfies CharacterCreatedEvent,
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'CharacterCreated',
          snapshot: target,
        } satisfies CharacterCreatedEvent,
      ]);

      const castEvents = engine.plan.castSpell(campaign.state, {
        characterId: paladin.id,
        spellId: 'searing-smite',
        slotLevel: 1,
        targetIds: [paladin.id],
      }).events;
      campaign = commit(campaign, castEvents);

      expect(campaign.state.characters[paladin.id]?.concentrationEffectId).toBeDefined();
      expect(
        campaign.state.characters[paladin.id]?.appliedConditions.some(
          (c) => c.conditionId === 'searing-smite-active',
        ),
      ).toBe(true);

      const firstAttack = engine.plan.attack(campaign.state, {
        attackerId: paladin.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const firstHit = firstAttack.find((e) => e.type === 'AttackRolled') as
        | AttackRolledEvent
        | undefined;
      if (firstHit?.hit !== true) continue;

      const firstFire = firstAttack.find(
        (e) => e.type === 'TriggerFired' && e.triggerId.endsWith('searing-smite-rider'),
      );
      expect(firstFire).toBeDefined();
      const concentrationBroken = firstAttack.find(
        (e) => e.type === 'ConcentrationBroken' && e.reason === 'used',
      );
      expect(concentrationBroken).toBeDefined();

      campaign = commit(campaign, firstAttack);

      // After commit, the smite condition is gone and the paladin no
      // longer holds concentration.
      expect(campaign.state.characters[paladin.id]?.concentrationEffectId).toBeUndefined();
      expect(
        campaign.state.characters[paladin.id]?.appliedConditions.some(
          (c) => c.conditionId === 'searing-smite-active',
        ),
      ).toBe(false);

      // A second attack still resolves but the smite rider does not
      // fire — the condition that carried it has been consumed.
      const secondAttack = engine.plan.attack(campaign.state, {
        attackerId: paladin.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const secondFire = secondAttack.find(
        (e) => e.type === 'TriggerFired' && e.triggerId.endsWith('searing-smite-rider'),
      );
      expect(secondFire).toBeUndefined();

      proven = true;
    }
    expect(proven, `Searing Smite test could not find a hit across ${attempt} seeds`).toBe(true);
  });

  it('Divine Favor fires +1d4 radiant on every hit; concentration persists', () => {
    const STARTER_PACK = loadStarterPack();
    let attempt = 0;
    let proven = false;
    while (attempt < 100 && !proven) {
      attempt += 1;
      const engine = createEngine({ contentPacks: [STARTER_PACK], rng: seededRNG(attempt + 200) });
      const longsword = makeItemInstance('longsword');
      const paladin = buildPaladin();
      const target = buildTarget();
      let campaign = engine.createCampaign({ name: 'divine-favor' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'CharacterCreated',
          snapshot: paladin,
        } satisfies CharacterCreatedEvent,
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'CharacterCreated',
          snapshot: target,
        } satisfies CharacterCreatedEvent,
      ]);

      const castEvents = engine.plan.castSpell(campaign.state, {
        characterId: paladin.id,
        spellId: 'divine-favor',
        slotLevel: 1,
        targetIds: [paladin.id],
      }).events;
      campaign = commit(campaign, castEvents);

      const firstAttack = engine.plan.attack(campaign.state, {
        attackerId: paladin.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const firstHit = firstAttack.find((e) => e.type === 'AttackRolled') as
        | AttackRolledEvent
        | undefined;
      if (firstHit?.hit !== true) continue;

      const firstFire = firstAttack.find(
        (e) => e.type === 'TriggerFired' && e.triggerId.endsWith('divine-favor-rider'),
      );
      expect(firstFire).toBeDefined();
      // The duration rider does NOT consume; no ConcentrationBroken
      // event fires from this trigger path.
      const concentrationBroken = firstAttack.find(
        (e) => e.type === 'ConcentrationBroken' && e.reason === 'used',
      );
      expect(concentrationBroken).toBeUndefined();

      campaign = commit(campaign, firstAttack);
      expect(campaign.state.characters[paladin.id]?.concentrationEffectId).toBeDefined();
      expect(
        campaign.state.characters[paladin.id]?.appliedConditions.some(
          (c) => c.conditionId === 'divine-favor-active',
        ),
      ).toBe(true);

      // A second hit also fires the rider (duration smite, no per-turn
      // gate either since the rider has no `oncePer`).
      const secondAttack = engine.plan.attack(campaign.state, {
        attackerId: paladin.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events;
      const secondHit = secondAttack.find((e) => e.type === 'AttackRolled') as
        | AttackRolledEvent
        | undefined;
      if (secondHit?.hit !== true) continue;
      const secondFire = secondAttack.find(
        (e) => e.type === 'TriggerFired' && e.triggerId.endsWith('divine-favor-rider'),
      );
      expect(secondFire).toBeDefined();

      proven = true;
    }
    expect(proven, `Divine Favor test could not find two hits across ${attempt} seeds`).toBe(true);
  });
});
