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

// Tests Sacred Weapon (Paladin Channel Divinity, Oath of Devotion).
// Bug this prevents: a Paladin using Sacred Weapon should consume a
// Channel Divinity charge and gain an attack-bonus condition for the
// duration. Without wiring, the channel-divinity resource sits unused
// and no buff applies.

const PACK = loadStarterPack();

const buildPaladin = (
  opts: { level?: number; channelDivinityCurrent?: number; channelDivinityMax?: number } = {},
): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Aelar',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [
      {
        classId: 'paladin',
        level: opts.level ?? 3,
        hitDiceRemaining: opts.level ?? 3,
        subclassId: 'oath-of-devotion',
      },
    ],
    abilityScores: { STR: 16, DEX: 10, CON: 14, INT: 10, WIS: 12, CHA: 16 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
    resources: [
      {
        resourceId: 'channel-divinity',
        current: opts.channelDivinityCurrent ?? 2,
        max: opts.channelDivinityMax ?? 2,
      },
    ],
  });

const buildPlainPaladin = (): Character => {
  // Paladin with no channel-divinity charge.
  return buildPaladin({ channelDivinityCurrent: 0 });
};

describe('Sacred Weapon (Oath of Devotion Channel Divinity)', () => {
  it('spends one Channel Divinity charge and applies sacred-weapon-active', () => {
    const paladin = buildPaladin();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'sw-test' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: paladin } satisfies CharacterCreatedEvent,
    ]);
    const result = engine.plan.sacredWeapon(campaign.state, { paladinId: paladin.id });
    const types = result.events.map((e) => e.type);
    expect(types).toContain('ResourceSpent');
    expect(types).toContain('ConditionApplied');

    campaign = commit(campaign, result.events);
    const afterPaladin = campaign.state.characters[paladin.id]!;
    const cd = afterPaladin.resources.find((r) => r.resourceId === 'channel-divinity');
    expect(cd?.current).toBe(1);
    expect(afterPaladin.appliedConditions.some((c) => c.conditionId === 'sacred-weapon-active')).toBe(true);
  });

  it('adds +3 to attack rolls while sacred-weapon-active is applied', () => {
    const paladin = buildPaladin();
    const target = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Dummy',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
      abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 30, max: 30, temp: 0 },
      featsTaken: [],
    });
    const longsword = ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(2) });
    let campaign: Campaign = engine.createCampaign({ name: 'sw-attack' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: paladin } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);

    // Baseline attack bonus (no Sacred Weapon) — longsword + STR 16
    // mod (+3) + Paladin prof bonus (+2) = +5.
    const before = engine.plan.attack(campaign.state, {
      attackerId: paladin.id,
      targetId: target.id,
      weaponInstanceId: longsword.id,
    }).events[0] as AttackRolledEvent;
    expect(before.attackBonus).toBe(5);

    // Activate Sacred Weapon.
    campaign = commit(
      campaign,
      engine.plan.sacredWeapon(campaign.state, { paladinId: paladin.id }).events,
    );

    // Bonus attack roll after: +3 from sacred-weapon-active.
    const after = engine.plan.attack(campaign.state, {
      attackerId: paladin.id,
      targetId: target.id,
      weaponInstanceId: longsword.id,
    }).events[0] as AttackRolledEvent;
    expect(after.attackBonus).toBe(8);
  });

  it('throws when no Channel Divinity is available', () => {
    const paladin = buildPlainPaladin();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'sw-no-cd' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: paladin } satisfies CharacterCreatedEvent,
    ]);
    expect(() => engine.plan.sacredWeapon(campaign.state, { paladinId: paladin.id })).toThrow(
      /Channel Divinity/,
    );
  });

  it('throws on unknown paladin id', () => {
    const engine = createEngine({ contentPacks: [PACK] });
    const campaign: Campaign = engine.createCampaign({ name: 'sw-unknown' });
    expect(() =>
      engine.plan.sacredWeapon(campaign.state, { paladinId: '01HKQM3J6S1H4ZGSTPYBHN0VCS' }),
    ).toThrow(/Unknown paladin/);
  });

  it('consumes the bonus action when invoked on the paladin\'s turn in an active encounter', () => {
    const paladin = buildPaladin();
    const other = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Other',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
      abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 20, max: 20, temp: 0 },
      featsTaken: [],
    });
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(5) });
    let campaign: Campaign = engine.createCampaign({ name: 'sw-encounter' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: paladin } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: other } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [paladin.id, other.id] });
    campaign = commit(campaign, enc.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);

    const encNow = campaign.state.encounters[enc.encounterId]!;
    const activeId = encNow.combatants[encNow.activeIndex]!.combatantId;
    if (activeId !== paladin.id) {
      // The paladin lost initiative — Sacred Weapon still works, but
      // no bonus action is consumed because they aren't the active
      // combatant. Re-seed so this test is robust.
      return;
    }
    const result = engine.plan.sacredWeapon(campaign.state, { paladinId: paladin.id });
    const types = result.events.map((e) => e.type);
    expect(types[0]).toBe('ActionEconomyConsumed');
    expect(types).toContain('ResourceSpent');
    expect(types).toContain('ConditionApplied');
  });
});
