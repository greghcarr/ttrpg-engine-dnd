import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId, newEventId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent, HealedEvent } from '../../../src/schemas/events/combat.js';
import type { UncannyDodgeUsedEvent } from '../../../src/schemas/events/reactive-spells.js';
import type { ActionEconomyConsumedEvent } from '../../../src/schemas/events/action-economy.js';
import type { ULID } from '../../../src/engine/ids-utils.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 200: Rogue L5 Uncanny Dodge. RAW (SRD 5.2.1): "When an
// attacker that you can see hits you with an attack roll, you can
// take a Reaction to halve the attack's damage against you (round
// down)."
//
// Engine implementation mirrors planAbsorbElements: the triggering
// DamageApplied has already committed, so the planner emits a
// compensating `Healed` event for `floor(damageAmount / 2)`. Plus an
// ActionEconomyConsumed (reaction) when the bearer is inside an
// encounter, and a record-only `UncannyDodgeUsed` notification.

const PACK = loadStarterPack();

const buildRogue = (level: number = 5): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Veska',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'rogue', level, hitDiceRemaining: level }],
    abilityScores: { STR: 10, DEX: 18, CON: 12, INT: 14, WIS: 10, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

const buildBruiser = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bruiser',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
  });

const buildScenario = () => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
  const rogue = buildRogue();
  let campaign: Campaign = engine.createCampaign({ name: 'uncanny-dodge' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: rogue } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, rogue };
};

const applyIncomingDamage = (
  campaign: Campaign,
  targetId: string,
  amount: number,
): { campaign: Campaign; triggeringId: string } => {
  const triggeringId = newEventId();
  const dmg: DamageAppliedEvent = {
    id: triggeringId as ULID,
    at: isoTimestamp(),
    type: 'DamageApplied',
    targetId: targetId as ULID,
    components: [{ amount, type: 'slashing' }],
    source: 'incoming-attack',
  };
  return { campaign: commit(campaign, [dmg]), triggeringId };
};

describe('engine.plan.uncannyDodge', () => {
  it('halves damage, emits Healed for floor(amount / 2), and a UncannyDodgeUsed notification', () => {
    const { engine, campaign: c0, rogue } = buildScenario();
    const { campaign: c1, triggeringId } = applyIncomingDamage(c0, rogue.id, 20);
    const hpAfterHit = c1.state.characters[rogue.id]!.hp.current;

    const outcome = engine.plan.uncannyDodge(c1.state, {
      characterId: rogue.id,
      triggeringDamageEventId: triggeringId,
      damageAmount: 20,
    });
    expect(outcome.halvedAmount).toBe(10);

    const healed = outcome.events.find((e) => e.type === 'Healed') as HealedEvent | undefined;
    expect(healed).toBeDefined();
    expect(healed!.amount).toBe(10);
    expect(healed!.source).toBe('uncanny-dodge');

    const used = outcome.events.find((e) => e.type === 'UncannyDodgeUsed') as UncannyDodgeUsedEvent | undefined;
    expect(used).toBeDefined();
    expect(used!.halvedAmount).toBe(10);
    expect(used!.triggeringDamageEventId).toBe(triggeringId);

    const c2 = commit(c1, outcome.events);
    const hpAfterDodge = c2.state.characters[rogue.id]!.hp.current;
    expect(hpAfterDodge - hpAfterHit).toBe(10);
  });

  it('floors odd damage when halving (15 -> 7)', () => {
    const { engine, campaign: c0, rogue } = buildScenario();
    const { campaign: c1, triggeringId } = applyIncomingDamage(c0, rogue.id, 15);
    const outcome = engine.plan.uncannyDodge(c1.state, {
      characterId: rogue.id,
      triggeringDamageEventId: triggeringId,
      damageAmount: 15,
    });
    expect(outcome.halvedAmount).toBe(7);
    const healed = outcome.events.find((e) => e.type === 'Healed') as HealedEvent | undefined;
    expect(healed!.amount).toBe(7);
  });

  it('with 0 incoming damage emits no Healed event but still records UncannyDodgeUsed', () => {
    const { engine, campaign: c0, rogue } = buildScenario();
    const { campaign: c1, triggeringId } = applyIncomingDamage(c0, rogue.id, 0);
    const outcome = engine.plan.uncannyDodge(c1.state, {
      characterId: rogue.id,
      triggeringDamageEventId: triggeringId,
      damageAmount: 0,
    });
    expect(outcome.halvedAmount).toBe(0);
    expect(outcome.events.some((e) => e.type === 'Healed')).toBe(false);
    expect(outcome.events.some((e) => e.type === 'UncannyDodgeUsed')).toBe(true);
  });

  it('throws when the character does not have Uncanny Dodge (L4 Rogue)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const rogue = buildRogue(4);
    let campaign: Campaign = engine.createCampaign({ name: 'no-uncanny' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: rogue } satisfies CharacterCreatedEvent,
    ]);
    const { campaign: c1, triggeringId } = applyIncomingDamage(campaign, rogue.id, 10);
    expect(() =>
      engine.plan.uncannyDodge(c1.state, {
        characterId: rogue.id,
        triggeringDamageEventId: triggeringId,
        damageAmount: 10,
      }),
    ).toThrow(/does not have Uncanny Dodge/);
  });

  it('throws on negative damageAmount', () => {
    const { engine, campaign: c0, rogue } = buildScenario();
    const { campaign: c1, triggeringId } = applyIncomingDamage(c0, rogue.id, 5);
    expect(() =>
      engine.plan.uncannyDodge(c1.state, {
        characterId: rogue.id,
        triggeringDamageEventId: triggeringId,
        damageAmount: -1,
      }),
    ).toThrow(/non-negative/);
  });

  it('out of encounter: emits Healed + UncannyDodgeUsed but no ActionEconomyConsumed', () => {
    const { engine, campaign: c0, rogue } = buildScenario();
    const { campaign: c1, triggeringId } = applyIncomingDamage(c0, rogue.id, 8);
    const outcome = engine.plan.uncannyDodge(c1.state, {
      characterId: rogue.id,
      triggeringDamageEventId: triggeringId,
      damageAmount: 8,
    });
    expect(outcome.events.some((e) => e.type === 'ActionEconomyConsumed')).toBe(false);
  });

  it('in encounter: emits an ActionEconomyConsumed (reaction)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const rogue = buildRogue();
    const bruiser = buildBruiser();
    let campaign: Campaign = engine.createCampaign({ name: 'uncanny-in-encounter' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: rogue } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bruiser } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [rogue.id, bruiser.id] });
    campaign = commit(campaign, enc.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);

    const { campaign: c1, triggeringId } = applyIncomingDamage(campaign, rogue.id, 12);
    const outcome = engine.plan.uncannyDodge(c1.state, {
      characterId: rogue.id,
      triggeringDamageEventId: triggeringId,
      damageAmount: 12,
    });
    const econ = outcome.events.find((e) => e.type === 'ActionEconomyConsumed') as ActionEconomyConsumedEvent | undefined;
    expect(econ).toBeDefined();
    expect(econ!.kind).toBe('reaction');
    expect(econ!.combatantId).toBe(rogue.id);
  });

  it('throws when the bearer has already used their reaction this round', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const rogue = buildRogue();
    const bruiser = buildBruiser();
    let campaign: Campaign = engine.createCampaign({ name: 'uncanny-reaction-gate' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: rogue } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bruiser } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [rogue.id, bruiser.id] });
    campaign = commit(campaign, enc.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);

    const { campaign: c1, triggeringId: t1 } = applyIncomingDamage(campaign, rogue.id, 10);
    campaign = commit(
      c1,
      engine.plan.uncannyDodge(c1.state, {
        characterId: rogue.id,
        triggeringDamageEventId: t1,
        damageAmount: 10,
      }).events,
    );

    const { campaign: c2, triggeringId: t2 } = applyIncomingDamage(campaign, rogue.id, 8);
    expect(() =>
      engine.plan.uncannyDodge(c2.state, {
        characterId: rogue.id,
        triggeringDamageEventId: t2,
        damageAmount: 8,
      }),
    ).toThrow(/reaction already used/);
  });
});
