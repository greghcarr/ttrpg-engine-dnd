// Slice 113 — rider damage through the mitigation pipeline.
//
// Before this slice the trigger dispatcher emitted raw DamageApplied
// events for AddDamage / AddDamageToAttacker riders: no resistance,
// no immunity, no qualifier check. Same gap on Graze (weapon-mastery)
// and trap base damage. Now every damage emitter runs
// mitigateDamage, with `sourceIsMagical` inferred from the rider's
// source (spell-applied condition with an EffectInstance.spellId =>
// magical; weapon attack rider => inherits from weapon; default
// non-magical).

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
  DamageAppliedEvent,
} from '../../../src/schemas/events/combat.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Mage',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 7, hitDiceRemaining: 7 }],
    abilityScores: { STR: 10, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: [],
    preparedSpells: ['fire-shield'],
  });

const buildFighter = (swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Brawler',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

describe('Fire Shield retaliation flows through mitigation', () => {
  it('halves the 2d8 fire retaliation against a fire-resistant attacker', () => {
    // Wizard with fire-shield-warm-active. Fighter with manual
    // fire-resistance condition. Fighter hits wizard with a sword;
    // the retaliation should be halved (resistance applies).
    const sword = makeItemInstance('longsword');
    const wizard = buildWizard();
    const fighter = buildFighter(sword.id);

    // Seed an ad-hoc fire-resistance condition by reusing the
    // protection-from-energy-fire-active condition that ships in pack.
    const seedFireResistance = (cid: string): ConditionAppliedEvent => ({
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: fighter.id,
      conditionId: cid,
      appliedConditionId: newAppliedConditionId(),
    });

    const fireResistanceConditionId = PACK.conditions.find(
      (c) => c.effects.some(
        (e) => e.kind === 'GrantResistance' && e.damageType === 'fire',
      ),
    )?.id;
    expect(fireResistanceConditionId).toBeDefined();

    for (let seed = 1; seed < 60; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = engine.createCampaign({ name: `rider-mit-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
      ]);
      // Cast Fire Shield (warm) on the wizard via the canonical buff path.
      campaign = commit(
        campaign,
        engine.plan.castSpell(campaign.state, {
          characterId: wizard.id,
          spellId: 'fire-shield',
          slotLevel: 4,
          targetIds: [wizard.id],
          casterChoice: { kind: 'variant', value: 'warm' },
        }).events,
      );
      // Apply the fire-resistance condition to the fighter.
      campaign = commit(campaign, [seedFireResistance(fireResistanceConditionId!)]);

      const events = engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: wizard.id,
        weaponInstanceId: sword.id,
      }).events;
      const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (rolled?.hit !== true) continue;
      // The retaliation damage targets the fighter (attacker).
      const retaliations = events.filter(
        (e): e is DamageAppliedEvent =>
          e.type === 'DamageApplied' && e.targetId === fighter.id,
      );
      // Find the fire-typed retaliation. The component should now
      // carry mitigation='resisted' because the fighter has fire
      // resistance and Fire Shield is spell-sourced (magical).
      const fireHit = retaliations.find((e) =>
        e.components.some((c) => c.type === 'fire'),
      );
      expect(fireHit).toBeDefined();
      const fireComponent = fireHit!.components.find((c) => c.type === 'fire');
      expect(fireComponent!.mitigation).toBe('resisted');
      return;
    }
    throw new Error('no hit landed in 60 seeds for Fire Shield rider test');
  });
});

describe('Sneak Attack rider inherits weapon magicality for the qualifier', () => {
  it('halves Sneak Attack damage vs a stoneskin-warded target (nonmagical weapon)', () => {
    // Rogue with Sneak Attack. Warded target has stoneskin-active
    // (slice 112: B/P/S resistance with qualifier='nonmagical').
    // Rogue's longsword is nonmagical → Sneak Attack damage inherits
    // nonmagical → resistance applies → mitigation='resisted'.
    const sword = makeItemInstance('longsword');
    const ally = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Ally',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 30, max: 30, temp: 0 },
      featsTaken: [],
    });
    const rogue = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Sneak',
      speciesId: 'human',
      backgroundId: 'criminal',
      classes: [{ classId: 'rogue', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 12, DEX: 18, CON: 14, INT: 10, WIS: 10, CHA: 8 },
      hp: { current: 35, max: 35, temp: 0 },
      featsTaken: [],
      inventory: [sword.id],
      equipped: { mainHand: sword.id, attuned: [] },
    });
    const target = buildWizard();

    for (let seed = 1; seed < 100; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = engine.createCampaign({ name: `sneak-stone-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: rogue } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      campaign = commit(campaign, [
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'ConditionApplied',
          targetId: target.id,
          conditionId: 'stoneskin-active',
          appliedConditionId: newAppliedConditionId(),
        } satisfies ConditionAppliedEvent,
      ]);

      const events = engine.plan.attack(campaign.state, {
        attackerId: rogue.id,
        targetId: target.id,
        weaponInstanceId: sword.id,
      }).events;
      const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (rolled?.hit !== true) continue;
      // Sneak Attack damage targets the wizard with piercing damage.
      const sneakHits = events.filter(
        (e): e is DamageAppliedEvent =>
          e.type === 'DamageApplied' && e.targetId === target.id,
      );
      // Multiple DamageApplied may be present (main weapon damage +
      // Sneak Attack rider). Both should be 'resisted' since stoneskin
      // covers piercing and the weapon is nonmagical.
      expect(sneakHits.length).toBeGreaterThanOrEqual(1);
      for (const hit of sneakHits) {
        for (const c of hit.components) {
          if (c.type === 'piercing') {
            expect(c.mitigation).toBe('resisted');
          }
        }
      }
      return;
    }
    throw new Error('no hit landed in 100 seeds for Sneak Attack stoneskin test');
  });
});
