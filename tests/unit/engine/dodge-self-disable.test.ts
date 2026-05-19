// Slice 272 — Dodge action self-disable on Incapacitated / Speed 0.
//
// RAW (2024 PHB Dodge action): "Until the start of your next turn, any
// attack roll made against you has Disadvantage if you can see the
// attacker, and you make Dexterity saving throws with Advantage. You
// lose these benefits if you have the Incapacitated condition or if
// your Speed is 0."
//
// Pre-272 the `dodged` condition imposed the benefits unconditionally.
// This slice gates both arms (ImposeDisadvantageOnAttackers + SetAdvantage
// on DEX save) on `all(bearer.hasIncapacitated=false, bearer.speedZero=false)`.
// The attack planner and `computeSavingThrow` populate the bearer-state
// facts. The LoS gate ("if you can see the attacker") still needs a
// consumer-supplied predicate fact and stays deferred (slice 267 row).
import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId, newAppliedConditionId, newEncounterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnStartedEvent,
} from '../../../src/schemas/events/encounter.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import type { ItemInstance } from '../../../src/schemas/runtime/item-instance.js';
import { computeSavingThrow } from '../../../src/derive/save.js';
import { resolveContent } from '../../../src/content/pack.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildFighter = (name: string, swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const applyCondition = (targetId: string, conditionId: string): ConditionAppliedEvent => ({
  id: eventId(),
  at: isoTimestamp(),
  type: 'ConditionApplied',
  targetId: targetId as never,
  conditionId,
  appliedConditionId: newAppliedConditionId(),
});

const seedEncounter = (
  dodger: Character,
  attacker: Character,
  swordId: string,
  extraConditions: ReadonlyArray<ConditionAppliedEvent> = [],
) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(272) });
  let campaign: Campaign = engine.createCampaign({ name: 'dodge-self-disable' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: { id: swordId, definitionId: 'longsword', quantity: 1, attuned: false, identifiedByCharacterIds: [] } as ItemInstance },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dodger } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    applyCondition(dodger.id, 'dodged'),
    ...extraConditions,
  ]);
  const encounterId = newEncounterId();
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'EncounterCreated', encounterId, combatantIds: [dodger.id, attacker.id] } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: dodger.id, d20: 20, modifier: 0, total: 20 },
        { combatantId: attacker.id, d20: 5, modifier: 0, total: 5 },
      ],
    } satisfies InitiativeRolledEvent,
    { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId } satisfies EncounterStartedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'TurnStarted', encounterId, combatantId: dodger.id, round: 1 } satisfies TurnStartedEvent,
  ]);
  return { engine, campaign, encounterId };
};

const findAttack = (events: ReadonlyArray<unknown>): AttackRolledEvent =>
  events.find((e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled')!;

describe('slice 272: Dodge benefits disabled by Incapacitated or Speed 0', () => {
  it('baseline: a dodging combatant imposes disadvantage on attackers AND has DEX save advantage', () => {
    const swordId = makeItemInstance('longsword').id;
    const dodger = buildFighter('Dodger', swordId);
    const attacker = buildFighter('Attacker', swordId);
    const { engine, campaign } = seedEncounter(dodger, attacker, swordId);
    const attack = findAttack(
      engine.plan.attack(campaign.state, {
        attackerId: attacker.id,
        targetId: dodger.id,
        weaponInstanceId: swordId,
      }).events,
    );
    expect(attack.used).toBe('disadvantage');
    expect(attack.d20).toHaveLength(2);
    const save = computeSavingThrow({
      character: campaign.state.characters[dodger.id]!,
      itemInstances: campaign.state.itemInstances,
      content: CONTENT,
      ability: 'DEX',
    });
    expect(save.hasAdvantage).toBe(true);
  });

  it('Incapacitated suppresses both Dodge benefits (disadvantage-on-attackers AND DEX-save advantage)', () => {
    const swordId = makeItemInstance('longsword').id;
    const dodger = buildFighter('Dodger', swordId);
    const attacker = buildFighter('Attacker', swordId);
    const { engine, campaign } = seedEncounter(dodger, attacker, swordId, [
      applyCondition(dodger.id, 'incapacitated'),
    ]);
    const attack = findAttack(
      engine.plan.attack(campaign.state, {
        attackerId: attacker.id,
        targetId: dodger.id,
        weaponInstanceId: swordId,
      }).events,
    );
    expect(attack.used).toBe('none');
    expect(attack.d20).toHaveLength(1);
    const save = computeSavingThrow({
      character: campaign.state.characters[dodger.id]!,
      itemInstances: campaign.state.itemInstances,
      content: CONTENT,
      ability: 'DEX',
    });
    expect(save.hasAdvantage).toBe(false);
  });

  it('Speed 0 (Grappled) suppresses both Dodge benefits', () => {
    // Grappled sets walking speed to 0 via ModifySpeed walk set 0 and
    // carries no other side effects on attacks or DEX saves; a clean
    // test of the speed-zero gate. Restrained also zeros speed but
    // adds advantage to attackers and disadvantage on DEX saves
    // independently, so it isn't useful for isolating the gate.
    const swordId = makeItemInstance('longsword').id;
    const dodger = buildFighter('Dodger', swordId);
    const attacker = buildFighter('Attacker', swordId);
    const { engine, campaign } = seedEncounter(dodger, attacker, swordId, [
      applyCondition(dodger.id, 'grappled'),
    ]);
    const attack = findAttack(
      engine.plan.attack(campaign.state, {
        attackerId: attacker.id,
        targetId: dodger.id,
        weaponInstanceId: swordId,
      }).events,
    );
    expect(attack.used).toBe('none');
    expect(attack.d20).toHaveLength(1);
    const save = computeSavingThrow({
      character: campaign.state.characters[dodger.id]!,
      itemInstances: campaign.state.itemInstances,
      content: CONTENT,
      ability: 'DEX',
    });
    expect(save.hasAdvantage).toBe(false);
  });
});
