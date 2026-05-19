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
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

// Slice 269: Boots of Speed's RAW "Disadvantage on opportunity attacks
// against the wearer" arm wires as an ImposeDisadvantageOnAttackers
// entry gated on `event.isOpportunityAttack === true` (the predicate
// fact slice 206 added for Hunter L7 Escape the Horde). Pre-269 the
// boots-of-speed-active condition only doubled walking speed; this
// closes the deferred arm tracked since slice 242.

const PACK = loadStarterPack();

const longsword = (id?: string): ItemInstance =>
  ItemInstanceSchema.parse({ id: id ?? newItemInstanceId(), definitionId: 'longsword' });

const buildCombatant = (name: string, swordId: string, bootsId?: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: bootsId !== undefined ? [bootsId, swordId] : [swordId],
    equipped: bootsId !== undefined
      ? { mainHand: swordId, attuned: [bootsId] }
      : { mainHand: swordId, attuned: [] },
  });

const setupAndToggleBoots = (
  wearer: Character,
  attacker: Character,
  bootsId: string,
  swordId: string,
) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(269) });
  let campaign: Campaign = engine.createCampaign({ name: 'boots-oa' });
  const boots = makeItemInstance('boots-of-speed', { id: bootsId });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: { id: swordId, definitionId: 'longsword', quantity: 1, attuned: false, identifiedByCharacterIds: [] } as ItemInstance },
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: boots },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wearer } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
  ]);
  const encounterId = newEncounterId();
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'EncounterCreated', encounterId, combatantIds: [wearer.id, attacker.id] } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: wearer.id, d20: 20, modifier: 0, total: 20 },
        { combatantId: attacker.id, d20: 5, modifier: 0, total: 5 },
      ],
    } satisfies InitiativeRolledEvent,
    { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId } satisfies EncounterStartedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'TurnStarted', encounterId, combatantId: wearer.id, round: 1 } satisfies TurnStartedEvent,
  ]);
  // Click boots on.
  campaign = commit(
    campaign,
    engine.plan.useItem(campaign.state, {
      characterId: wearer.id,
      instanceId: bootsId,
    }).events,
  );
  return { engine, campaign };
};

const findAttack = (events: ReadonlyArray<unknown>): AttackRolledEvent =>
  events.find((e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled')!;

describe('slice 269: Boots of Speed imposes disadvantage on opportunity attacks against the wearer', () => {
  it('an OA against the boots-of-speed-active wearer rolls with disadvantage', () => {
    const swordId = newItemInstanceId();
    const bootsId = newItemInstanceId();
    const wearer = buildCombatant('Wearer', swordId, bootsId);
    const attacker = buildCombatant('Attacker', swordId);
    const { engine, campaign } = setupAndToggleBoots(wearer, attacker, bootsId, swordId);
    const { events } = engine.plan.opportunityAttack(campaign.state, {
      reactorId: attacker.id,
      targetId: wearer.id,
      weaponInstanceId: swordId,
    });
    const attack = findAttack(events);
    expect(attack.isOpportunityAttack).toBe(true);
    expect(attack.used).toBe('disadvantage');
    expect(attack.d20).toHaveLength(2);
  });

  it('a regular attack against the boots-of-speed-active wearer is NOT disadvantaged', () => {
    const swordId = newItemInstanceId();
    const bootsId = newItemInstanceId();
    const wearer = buildCombatant('Wearer', swordId, bootsId);
    const attacker = buildCombatant('Attacker', swordId);
    const { engine, campaign } = setupAndToggleBoots(wearer, attacker, bootsId, swordId);
    const { events } = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: wearer.id,
      weaponInstanceId: swordId,
    });
    const attack = findAttack(events);
    expect(attack.isOpportunityAttack ?? false).toBe(false);
    expect(attack.used).toBe('none');
    expect(attack.d20).toHaveLength(1);
  });

  it('an OA against a wearer WITHOUT boots-of-speed-active is NOT disadvantaged', () => {
    const swordId = newItemInstanceId();
    const target = buildCombatant('Plain', swordId);
    const attacker = buildCombatant('Attacker', swordId);
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(269) });
    let campaign: Campaign = engine.createCampaign({ name: 'boots-baseline' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: { id: swordId, definitionId: 'longsword', quantity: 1, attuned: false, identifiedByCharacterIds: [] } as ItemInstance },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    ]);
    const encounterId = newEncounterId();
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'EncounterCreated', encounterId, combatantIds: [target.id, attacker.id] } satisfies EncounterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: target.id, d20: 20, modifier: 0, total: 20 },
          { combatantId: attacker.id, d20: 5, modifier: 0, total: 5 },
        ],
      } satisfies InitiativeRolledEvent,
      { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId } satisfies EncounterStartedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'TurnStarted', encounterId, combatantId: target.id, round: 1 } satisfies TurnStartedEvent,
    ]);
    const { events } = engine.plan.opportunityAttack(campaign.state, {
      reactorId: attacker.id,
      targetId: target.id,
      weaponInstanceId: swordId,
    });
    const attack = findAttack(events);
    expect(attack.isOpportunityAttack).toBe(true);
    expect(attack.used).toBe('none');
    expect(attack.d20).toHaveLength(1);
  });
});
