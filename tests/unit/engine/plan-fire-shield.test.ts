import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../../src/ids.js';
import { mitigateDamage } from '../../../src/derive/damage-mitigation.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ConditionAppliedEvent,
  DamageAppliedEvent,
} from '../../../src/schemas/events/combat.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 100 — Fire Shield wires the new AddDamageToAttacker
// TriggerAction. Caster picks 'warm' (resist cold, retaliate fire) or
// 'chill' (resist fire, retaliate cold) at cast time. When a creature
// hits the caster with a weapon attack, dispatch fires the rider and
// emits DamageApplied targeting the *attacker*.

const PACK = loadStarterPack();

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Shielded',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 9, hitDiceRemaining: 9 }],
    abilityScores: { STR: 8, DEX: 12, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
    preparedSpells: ['fire-shield'],
  });

const buildAttacker = (swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Attacker',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const setup = (variant: 'warm' | 'chill', seed: number) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const sword = longsword();
  const wizard = buildWizard();
  const attacker = buildAttacker(sword.id);
  let campaign: Campaign = engine.createCampaign({ name: `fire-shield-${variant}-${seed}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
  ]);
  const castEvents = engine.plan.castSpell(campaign.state, {
    characterId: wizard.id,
    spellId: 'fire-shield',
    slotLevel: 4,
    targetIds: [wizard.id],
    casterChoice: { kind: 'variant', value: variant },
  }).events;
  campaign = commit(campaign, castEvents);
  return { engine, campaign, wizard, attacker, swordId: sword.id, castEvents };
};

describe('Fire Shield retaliation via AddDamageToAttacker', () => {
  it('applies the warm variant condition on cast', () => {
    const { castEvents, wizard } = setup('warm', 1);
    const applied = castEvents.find(
      (e): e is ConditionAppliedEvent =>
        e.type === 'ConditionApplied'
        && (e as ConditionAppliedEvent).conditionId === 'fire-shield-warm-active'
        && (e as ConditionAppliedEvent).targetId === wizard.id,
    );
    expect(applied).toBeDefined();
  });

  it('warm variant retaliates with fire when the caster is hit', () => {
    // Walk seeds until the attacker actually hits the wizard.
    for (let seed = 1; seed < 60; seed += 1) {
      const { engine, campaign, wizard, attacker, swordId } = setup('warm', seed);
      const attackEvents = engine.plan.attack(campaign.state, {
        attackerId: attacker.id,
        targetId: wizard.id,
        weaponInstanceId: swordId,
      }).events;
      const rolled = attackEvents.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (!rolled?.hit) continue;
      const retaliation = attackEvents.find(
        (e): e is DamageAppliedEvent =>
          e.type === 'DamageApplied' && (e as DamageAppliedEvent).targetId === attacker.id,
      );
      expect(retaliation).toBeDefined();
      expect(retaliation!.components[0]!.type).toBe('fire');
      expect(retaliation!.components[0]!.amount).toBeGreaterThan(0);
      return;
    }
    throw new Error('no seed produced a hit against the Fire Shield bearer');
  });

  it('chill variant retaliates with cold and grants Fire resistance', () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const { engine, campaign, wizard, attacker, swordId } = setup('chill', seed);
      const attackEvents = engine.plan.attack(campaign.state, {
        attackerId: attacker.id,
        targetId: wizard.id,
        weaponInstanceId: swordId,
      }).events;
      const rolled = attackEvents.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (!rolled?.hit) continue;
      const retaliation = attackEvents.find(
        (e): e is DamageAppliedEvent =>
          e.type === 'DamageApplied' && (e as DamageAppliedEvent).targetId === attacker.id,
      );
      expect(retaliation).toBeDefined();
      expect(retaliation!.components[0]!.type).toBe('cold');

      // Resistance to fire flows through mitigateDamage on the wizard.
      const wizardState = campaign.state.characters[wizard.id]!;
      const fireMitigated = mitigateDamage({
        character: wizardState,
        itemInstances: campaign.state.itemInstances,
        content: engine.content,
        rawComponents: [{ amount: 20, type: 'fire' }],
      });
      expect(fireMitigated[0]).toEqual({
        amount: 10,
        type: 'fire',
        rawAmount: 20,
        mitigation: 'resisted',
      });
      return;
    }
    throw new Error('no seed produced a hit against the Fire Shield bearer (chill)');
  });

  it('does NOT retaliate when the attack misses', () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const { engine, campaign, wizard, attacker, swordId } = setup('warm', seed);
      const attackEvents = engine.plan.attack(campaign.state, {
        attackerId: attacker.id,
        targetId: wizard.id,
        weaponInstanceId: swordId,
      }).events;
      const rolled = attackEvents.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (rolled?.hit !== false) continue;
      const retaliation = attackEvents.find(
        (e): e is DamageAppliedEvent =>
          e.type === 'DamageApplied' && (e as DamageAppliedEvent).targetId === attacker.id,
      );
      expect(retaliation).toBeUndefined();
      return;
    }
    throw new Error('no seed produced a miss against the Fire Shield bearer');
  });
});
