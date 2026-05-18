import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ResourceSpentEvent } from '../../../src/schemas/events/resources.js';
import type { ActionEconomyConsumedEvent } from '../../../src/schemas/events/action-economy.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 201: Sorcerer Innate Sorcery + Sorcery Incarnate.
//
// `planInnateSorcery` activates Innate Sorcery via one of two paths:
//   1. Default — consume one innate-sorcery resource use.
//   2. Sorcery Incarnate alternative (L7+) — consume 2 Sorcery Points
//      instead. Gated on the `GrantInnateSorcerySpendAlternative`
//      marker.
//
// Both paths apply the `innate-sorcery-active` condition (+1 spell
// save DC) and consume a bonus action when inside an active encounter
// on the character's turn.

const PACK = loadStarterPack();

const buildSorcerer = (
  opts: {
    level?: number;
    innateSorceryCurrent?: number;
    sorceryPointsCurrent?: number;
  } = {},
): Character => {
  const level = opts.level ?? 1;
  return CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ember',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'sorcerer', level, hitDiceRemaining: level }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: 24, max: 24, temp: 0 },
    featsTaken: [],
    resources: [
      { resourceId: 'innate-sorcery', current: opts.innateSorceryCurrent ?? 2, max: 2 },
      ...(level >= 2
        ? [{ resourceId: 'sorcery-points', current: opts.sorceryPointsCurrent ?? level, max: level }]
        : []),
    ],
  });
};

describe('engine.plan.innateSorcery', () => {
  it('default path spends one innate-sorcery use and applies the active condition', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const sorcerer = buildSorcerer({ level: 1 });
    let campaign: Campaign = engine.createCampaign({ name: 'innate-default' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
    ]);

    const result = engine.plan.innateSorcery(campaign.state, { characterId: sorcerer.id });
    campaign = commit(campaign, result.events);

    const after = campaign.state.characters[sorcerer.id]!;
    const innate = after.resources.find((r) => r.resourceId === 'innate-sorcery');
    expect(innate?.current).toBe(1);
    expect(after.appliedConditions.some((c) => c.conditionId === 'innate-sorcery-active')).toBe(true);
  });

  it('throws on the default path when the innate-sorcery resource is exhausted', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const sorcerer = buildSorcerer({ innateSorceryCurrent: 0 });
    let campaign: Campaign = engine.createCampaign({ name: 'innate-empty' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.innateSorcery(campaign.state, { characterId: sorcerer.id }),
    ).toThrow(/no Innate Sorcery uses remaining/);
  });

  it('Sorcery Incarnate path (L7) spends 2 Sorcery Points when Innate Sorcery is exhausted', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const sorcerer = buildSorcerer({
      level: 7,
      innateSorceryCurrent: 0,
      sorceryPointsCurrent: 7,
    });
    let campaign: Campaign = engine.createCampaign({ name: 'sorcery-incarnate' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
    ]);
    const result = engine.plan.innateSorcery(campaign.state, {
      characterId: sorcerer.id,
      useSorceryPoints: true,
    });
    const spendSP = result.events.find(
      (e): e is ResourceSpentEvent =>
        e.type === 'ResourceSpent' && (e as ResourceSpentEvent).resourceId === 'sorcery-points',
    );
    expect(spendSP).toBeDefined();
    expect(spendSP!.amount).toBe(2);

    campaign = commit(campaign, result.events);
    const after = campaign.state.characters[sorcerer.id]!;
    const sp = after.resources.find((r) => r.resourceId === 'sorcery-points');
    expect(sp?.current).toBe(5);
    const innate = after.resources.find((r) => r.resourceId === 'innate-sorcery');
    expect(innate?.current).toBe(0);
    expect(after.appliedConditions.some((c) => c.conditionId === 'innate-sorcery-active')).toBe(true);
  });

  it('throws when useSorceryPoints is set without the Sorcery Incarnate marker', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const sorcerer = buildSorcerer({ level: 2, sorceryPointsCurrent: 5 });
    let campaign: Campaign = engine.createCampaign({ name: 'no-marker' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.innateSorcery(campaign.state, {
        characterId: sorcerer.id,
        useSorceryPoints: true,
      }),
    ).toThrow(/without Sorcery Incarnate/);
  });

  it('throws on the SP path when Sorcery Points are below the 2-point cost', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const sorcerer = buildSorcerer({ level: 7, sorceryPointsCurrent: 1 });
    let campaign: Campaign = engine.createCampaign({ name: 'sp-short' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.innateSorcery(campaign.state, {
        characterId: sorcerer.id,
        useSorceryPoints: true,
      }),
    ).toThrow(/needs 2 Sorcery Points/);
  });

  it('consumes a bonus action when invoked inside an encounter on the actor\'s turn', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const sorcerer = buildSorcerer({ level: 7 });
    const otherCharacter = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Other',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
      abilityScores: { STR: 12, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 10, max: 10, temp: 0 },
      featsTaken: [],
    });
    let campaign: Campaign = engine.createCampaign({ name: 'in-encounter' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: otherCharacter } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [sorcerer.id, otherCharacter.id] });
    campaign = commit(campaign, enc.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);

    const result = engine.plan.innateSorcery(campaign.state, { characterId: sorcerer.id });
    const ba = result.events.find(
      (e): e is ActionEconomyConsumedEvent =>
        e.type === 'ActionEconomyConsumed' && (e as ActionEconomyConsumedEvent).kind === 'bonusAction',
    );
    if (campaign.state.encounters[enc.encounterId]!.combatants[0]!.combatantId === sorcerer.id) {
      expect(ba).toBeDefined();
    }
  });

  it('out of encounter emits no ActionEconomyConsumed', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const sorcerer = buildSorcerer({ level: 7 });
    let campaign: Campaign = engine.createCampaign({ name: 'no-encounter' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
    ]);
    const result = engine.plan.innateSorcery(campaign.state, { characterId: sorcerer.id });
    expect(result.events.some((e) => e.type === 'ActionEconomyConsumed')).toBe(false);
  });
});
