// Slice 275 — Bracers of Archery +2 damage with longbow / shortbow.
//
// RAW: "Proficiency with the longbow and the shortbow, and gain a +2
// bonus to damage rolls on ranged attacks made with such weapons."
//
// Pre-275 Bracers of Archery shipped unwired (effects: []). This
// slice adds a new `event.weaponId` predicate fact on the attack
// planner's `damageFacts` map and wires the +2 damage arm via
// AddModifier { target: 'damage', value: 2 } gated on
// `any(eq path:event.weaponId value:longbow, ...shortbow)`. The
// proficiency arm stays deferred until a conditional GrantProficiency
// shape lands.
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
import { newCharacterId, newItemInstanceId, newEncounterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnStartedEvent,
} from '../../../src/schemas/events/encounter.js';
import type { DamageRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const makeWeapon = (definitionId: string): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId });

const buildArcher = (weaponId: string, attuned: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Archer',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 18, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [weaponId, ...attuned],
    equipped: { mainHand: weaponId, attuned },
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 8, WIS: 10, CHA: 8 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const setupAttack = (
  attacker: Character,
  target: Character,
  weapon: ItemInstance,
  bracers: ItemInstance | undefined,
) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(275) });
  let campaign: Campaign = engine.createCampaign({ name: 'bracers-of-archery' });
  const seed: ReadonlyArray<{ id: string; at: string; type: 'ItemAcquired'; instance: ItemInstance } | CharacterCreatedEvent> = [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: weapon },
    ...(bracers !== undefined
      ? ([{ id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: bracers }] as const)
      : []),
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ];
  campaign = commit(campaign, seed);
  const encounterId = newEncounterId();
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'EncounterCreated', encounterId, combatantIds: [attacker.id, target.id] } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: attacker.id, d20: 20, modifier: 0, total: 20 },
        { combatantId: target.id, d20: 5, modifier: 0, total: 5 },
      ],
    } satisfies InitiativeRolledEvent,
    { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId } satisfies EncounterStartedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'TurnStarted', encounterId, combatantId: attacker.id, round: 1 } satisfies TurnStartedEvent,
  ]);
  return { engine, campaign };
};

const findDamageRoll = (events: ReadonlyArray<unknown>): DamageRolledEvent | undefined =>
  events.find((e): e is DamageRolledEvent => (e as { type?: string }).type === 'DamageRolled');

describe('slice 275: Bracers of Archery +2 damage with longbow/shortbow', () => {
  it('Bracers + longbow: damage modifier includes +2', () => {
    const longbow = makeWeapon('longbow');
    const bracers = makeItemInstance('bracers-of-archery');
    const attacker = buildArcher(longbow.id, [bracers.id]);
    const target = buildTarget();
    const { engine, campaign } = setupAttack(attacker, target, longbow, bracers);
    const events = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: longbow.id,
    }).events;
    const dmg = findDamageRoll(events);
    expect(dmg).toBeDefined();
    // DEX 18 = +4 mod. Bracers contribute +2 to damage modifier.
    expect(dmg!.rolls[0]!.modifier).toBe(4 + 2);
  });

  it('Bracers + shortbow: damage modifier includes +2', () => {
    const shortbow = makeWeapon('shortbow');
    const bracers = makeItemInstance('bracers-of-archery');
    const attacker = buildArcher(shortbow.id, [bracers.id]);
    const target = buildTarget();
    const { engine, campaign } = setupAttack(attacker, target, shortbow, bracers);
    const events = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: shortbow.id,
    }).events;
    const dmg = findDamageRoll(events);
    expect(dmg!.rolls[0]!.modifier).toBe(4 + 2);
  });

  it('Bracers + heavy crossbow: NO damage bonus (RAW: bows only)', () => {
    const crossbow = makeWeapon('crossbow-heavy');
    const bracers = makeItemInstance('bracers-of-archery');
    const attacker = buildArcher(crossbow.id, [bracers.id]);
    const target = buildTarget();
    const { engine, campaign } = setupAttack(attacker, target, crossbow, bracers);
    const events = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: crossbow.id,
    }).events;
    const dmg = findDamageRoll(events);
    // DEX 18 mod = +4; no Bracers bonus.
    expect(dmg!.rolls[0]!.modifier).toBe(4);
  });

  it('No Bracers + longbow: baseline damage modifier (DEX mod only)', () => {
    const longbow = makeWeapon('longbow');
    const attacker = buildArcher(longbow.id, []);
    const target = buildTarget();
    const { engine, campaign } = setupAttack(attacker, target, longbow, undefined);
    const events = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: longbow.id,
    }).events;
    const dmg = findDamageRoll(events);
    expect(dmg!.rolls[0]!.modifier).toBe(4);
  });

  it('Bracers carried but NOT attuned + longbow: no bonus (slice-132 projection gate)', () => {
    const longbow = makeWeapon('longbow');
    const bracers = makeItemInstance('bracers-of-archery');
    // attuned omitted - just carried in inventory.
    const attacker = buildArcher(longbow.id, []);
    const attackerWithBracers: Character = {
      ...attacker,
      inventory: [...attacker.inventory, bracers.id],
    };
    const target = buildTarget();
    const { engine, campaign } = setupAttack(attackerWithBracers, target, longbow, bracers);
    const events = engine.plan.attack(campaign.state, {
      attackerId: attackerWithBracers.id,
      targetId: target.id,
      weaponInstanceId: longbow.id,
    }).events;
    const dmg = findDamageRoll(events);
    expect(dmg!.rolls[0]!.modifier).toBe(4);
  });
});
