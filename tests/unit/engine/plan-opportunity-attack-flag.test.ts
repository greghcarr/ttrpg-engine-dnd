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
import { newCharacterId, newItemInstanceId, newEncounterId, newChoiceId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ChoiceRequiredEvent, ChoiceResolvedEvent } from '../../../src/schemas/events/level-up.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnStartedEvent,
} from '../../../src/schemas/events/encounter.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 206: AttackRolled.isOpportunityAttack surfaces OA-ness so
// predicates can scope to opportunity attacks without sniffing the
// planner. Canonical user: Hunter L7 Defensive Tactics, Escape the
// Horde arm — `ImposeDisadvantageOnAttackers` gated on
// `event.isOpportunityAttack === true`.

const PACK = loadStarterPack();

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const buildAttacker = (name: string, swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const buildHunter = (level: number, swordId?: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Hunter',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'ranger', level, hitDiceRemaining: level, subclassId: 'hunter' }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 14, CHA: 10 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
    ...(swordId !== undefined
      ? { inventory: [swordId], equipped: { mainHand: swordId, attuned: [] } }
      : {}),
  });

const seedEscapeTheHorde = (characterId: string): [ChoiceRequiredEvent, ChoiceResolvedEvent] => {
  const choiceId = newChoiceId();
  return [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'defensive-tactics',
      prompt: 'Pick Escape the Horde or Multiattack Defense.',
      options: [
        {
          id: 'escape-the-horde',
          label: 'Escape the Horde',
          effects: [
            {
              kind: 'ImposeDisadvantageOnAttackers',
              condition: { kind: 'eq', path: 'event.isOpportunityAttack', value: true },
            },
          ],
        },
        { id: 'multiattack-defense', label: 'Multiattack Defense', effects: [] },
      ],
      oneOf: 1,
    },
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: ['escape-the-horde'],
    },
  ];
};

const setupEncounter = (
  attacker: Character,
  reactor: Character,
  weaponId: string,
  extraEvents: ReadonlyArray<CharacterCreatedEvent | ChoiceRequiredEvent | ChoiceResolvedEvent> = [],
) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(206) });
  let campaign: Campaign = engine.createCampaign({ name: 'oa-flag' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: { id: weaponId, definitionId: 'longsword', quantity: 1, attuned: false, identifiedByCharacterIds: [] } as ItemInstance },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: reactor } satisfies CharacterCreatedEvent,
    ...extraEvents,
  ]);
  const encounterId = newEncounterId();
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      combatantIds: [attacker.id, reactor.id],
    } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: attacker.id, d20: 20, modifier: 0, total: 20 },
        { combatantId: reactor.id, d20: 5, modifier: 0, total: 5 },
      ],
    } satisfies InitiativeRolledEvent,
    { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId } satisfies EncounterStartedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TurnStarted',
      encounterId,
      combatantId: attacker.id,
      round: 1,
    } satisfies TurnStartedEvent,
  ]);
  return { engine, campaign, encounterId };
};

const findAttack = (events: ReadonlyArray<unknown>): AttackRolledEvent =>
  events.find((e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled')!;

describe('slice 206: isOpportunityAttack flag + Hunter L7 Escape the Horde', () => {
  it('planOpportunityAttack stamps isOpportunityAttack=true on the emitted AttackRolled', () => {
    const sword = longsword();
    const moving = buildAttacker('Mover', sword.id);
    const watcher = buildAttacker('Watcher', sword.id);
    const { engine, campaign } = setupEncounter(moving, watcher, sword.id);
    const { events } = engine.plan.opportunityAttack(campaign.state, {
      reactorId: watcher.id,
      targetId: moving.id,
      weaponInstanceId: sword.id,
    });
    expect(findAttack(events).isOpportunityAttack).toBe(true);
  });

  it('a regular attack does not stamp isOpportunityAttack', () => {
    const sword = longsword();
    const attacker = buildAttacker('Attacker', sword.id);
    const target = buildAttacker('Target', sword.id);
    const { engine, campaign } = setupEncounter(attacker, target, sword.id);
    const { events } = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: sword.id,
    });
    // Either undefined (field omitted) or explicitly false would be
    // acceptable; the schema lets it stay absent on non-OAs.
    const attack = findAttack(events);
    expect(attack.isOpportunityAttack ?? false).toBe(false);
  });

  it('Hunter L7 with Escape the Horde imposes disadvantage on OAs against them', () => {
    const sword = longsword();
    const attacker = buildAttacker('Attacker', sword.id);
    const hunter = buildHunter(7, sword.id);
    const { engine, campaign } = setupEncounter(
      hunter,
      attacker,
      sword.id,
      seedEscapeTheHorde(hunter.id),
    );
    // hunter is the active combatant in setupEncounter (passed first);
    // attacker is the reactor. So this is "while the hunter moves
    // away, attacker takes an OA at them" — perfect for the test.
    const { events } = engine.plan.opportunityAttack(campaign.state, {
      reactorId: attacker.id,
      targetId: hunter.id,
      weaponInstanceId: sword.id,
    });
    const attack = findAttack(events);
    expect(attack.isOpportunityAttack).toBe(true);
    expect(attack.used).toBe('disadvantage');
    expect(attack.d20).toHaveLength(2);
  });

  it('Hunter L7 with Escape the Horde does NOT impose disadvantage on a regular attack', () => {
    const sword = longsword();
    // Swap setup: attacker is active, hunter is the reactor. Attacker
    // performs a regular planAttack against the hunter on their turn.
    const attacker = buildAttacker('Attacker', sword.id);
    const hunter = buildHunter(7, sword.id);
    const { engine, campaign } = setupEncounter(
      attacker,
      hunter,
      sword.id,
      seedEscapeTheHorde(hunter.id),
    );
    const { events } = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: hunter.id,
      weaponInstanceId: sword.id,
    });
    const attack = findAttack(events);
    expect(attack.isOpportunityAttack ?? false).toBe(false);
    expect(attack.used).toBe('none');
    expect(attack.d20).toHaveLength(1);
  });
});
