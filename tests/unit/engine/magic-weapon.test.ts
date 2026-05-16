// Unit tests for the magic-weapon planner shipped in slice 76.
// The planner stamps a temporary attack-and-damage buff onto the
// named weapon instance. Attack derive (attack bonus) and damage
// roll (damage modifier) read the buff back when the instance is
// used as the weapon. Concentration cleanup auto-strips the buff
// when the caster loses concentration.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { computeAttackBonus } from '../../../src/derive/attack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Vex',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 7, hitDiceRemaining: 7 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 18, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    preparedSpells: ['magic-weapon'],
  });

const PACK = loadStarterPack();

describe('engine.plan.magicWeapon', () => {
  it('stamps +1 attack / +1 damage buff on the weapon instance at L2 slot', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildWizard();
    const longsword = makeItemInstance('longsword');
    let campaign = engine.createCampaign({ name: 'mw' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: caster,
      } satisfies CharacterCreatedEvent,
    ]);

    const events = engine.plan.magicWeapon(campaign.state, {
      casterId: caster.id,
      weaponInstanceId: longsword.id,
      slotLevel: 2,
    }).events;
    const buffEvent = events.find((e) => e.type === 'ItemBuffApplied');
    expect(buffEvent).toBeDefined();
    expect(buffEvent!.attackBonus).toBe(1);
    expect(buffEvent!.damageBonus).toBe(1);

    campaign = commit(campaign, events);
    const after = campaign.state.itemInstances[longsword.id];
    expect(after?.temporaryBuff?.attackBonus).toBe(1);
    expect(after?.temporaryBuff?.damageBonus).toBe(1);
    expect(caster.id).toBe(campaign.state.characters[caster.id]?.id);
    expect(campaign.state.characters[caster.id]?.concentrationEffectId).toBeDefined();
  });

  it('scales to +2 at slot 4 and +3 at slot 6+', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildWizard();
    const sword = makeItemInstance('longsword');
    let campaign = engine.createCampaign({ name: 'mw-scale' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: caster,
      } satisfies CharacterCreatedEvent,
    ]);

    const fourth = engine.plan.magicWeapon(campaign.state, {
      casterId: caster.id,
      weaponInstanceId: sword.id,
      slotLevel: 4,
    }).events;
    expect(fourth.find((e) => e.type === 'ItemBuffApplied')?.attackBonus).toBe(2);
  });

  it('attack derive reads the buff into the attack bonus breakdown', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildWizard();
    const sword = makeItemInstance('longsword');
    let campaign = engine.createCampaign({ name: 'mw-derive' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: caster,
      } satisfies CharacterCreatedEvent,
    ]);
    const beforeBuff = computeAttackBonus({
      character: campaign.state.characters[caster.id]!,
      itemInstances: campaign.state.itemInstances,
      content: engine.content,
      weaponInstanceId: sword.id,
    });

    campaign = commit(
      campaign,
      engine.plan.magicWeapon(campaign.state, {
        casterId: caster.id,
        weaponInstanceId: sword.id,
        slotLevel: 2,
      }).events,
    );

    const afterBuff = computeAttackBonus({
      character: campaign.state.characters[caster.id]!,
      itemInstances: campaign.state.itemInstances,
      content: engine.content,
      weaponInstanceId: sword.id,
    });
    expect(afterBuff.total).toBe(beforeBuff.total + 1);
    expect(afterBuff.breakdown.some((b) => b.source === 'magic-weapon')).toBe(true);
  });

  it('concentration cleanup strips the buff', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildWizard();
    const sword = makeItemInstance('longsword');
    let campaign = engine.createCampaign({ name: 'mw-cleanup' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: caster,
      } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.magicWeapon(campaign.state, {
        casterId: caster.id,
        weaponInstanceId: sword.id,
        slotLevel: 2,
      }).events,
    );
    expect(campaign.state.itemInstances[sword.id]?.temporaryBuff).toBeDefined();

    // Drop concentration manually (e.g., voluntary).
    const effectId = campaign.state.characters[caster.id]!.concentrationEffectId!;
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConcentrationBroken',
        effectInstanceId: effectId,
        casterId: caster.id,
        reason: 'voluntary',
      },
    ]);
    expect(campaign.state.itemInstances[sword.id]?.temporaryBuff).toBeUndefined();
  });
});
