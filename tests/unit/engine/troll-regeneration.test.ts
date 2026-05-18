import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent, HealedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 232: Regeneration trait primitive. Canonical user: Troll
// (15 HP/turn at the start of its turn, suppressed on the next turn
// if it took acid or fire damage since the last turn-start).

const PACK = loadStarterPack();

const buildTroll = (currentHp: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Troll',
    speciesId: 'companion',
    backgroundId: 'companion',
    statblockId: 'troll',
    classes: [{ classId: 'companion', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 18, DEX: 13, CON: 20, INT: 7, WIS: 9, CHA: 7 },
    hp: { current: currentHp, max: 94, temp: 0 },
  });

const buildHero = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Hero',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
  });

describe('Troll Regeneration (slice 232)', () => {
  it('a troll at less than full HP regenerates 15 HP at the start of its turn', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(232) });
    const troll = buildTroll(50);
    const hero = buildHero();
    let campaign: Campaign = engine.createCampaign({ name: 'regen' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: troll } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, {
      combatantIds: [hero.id, troll.id],
    });
    campaign = commit(campaign, enc.events);
    campaign = commit(
      campaign,
      engine.plan.rollInitiative(campaign.state, {
        encounterId: enc.encounterId,
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events,
    );
    // Advance to the troll's turn.
    const advanceEvents = engine.plan.advanceTurn(campaign.state, {
      encounterId: enc.encounterId,
    }).events;
    const healedFromRegen = advanceEvents.find(
      (e) => e.type === 'Healed' && (e as HealedEvent).source === 'regeneration',
    ) as HealedEvent | undefined;
    expect(healedFromRegen).toBeDefined();
    expect(healedFromRegen!.amount).toBe(15);
    expect(healedFromRegen!.targetId).toBe(troll.id);
  });

  it('regeneration is suppressed on the next turn after the troll takes acid damage', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(233) });
    const troll = buildTroll(50);
    const hero = buildHero();
    let campaign: Campaign = engine.createCampaign({ name: 'suppress-acid' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: troll } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, {
      combatantIds: [hero.id, troll.id],
    });
    campaign = commit(campaign, enc.events);
    campaign = commit(
      campaign,
      engine.plan.rollInitiative(campaign.state, {
        encounterId: enc.encounterId,
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events,
    );
    // Hero hits the troll with acid damage on hero's turn.
    const damage: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: troll.id,
      components: [{ type: 'acid', amount: 10 }],
    };
    campaign = commit(campaign, [damage]);
    // Advance to the troll's turn.
    const advanceEvents = engine.plan.advanceTurn(campaign.state, {
      encounterId: enc.encounterId,
    }).events;
    const healedFromRegen = advanceEvents.find(
      (e) => e.type === 'Healed' && (e as HealedEvent).source === 'regeneration',
    );
    expect(healedFromRegen).toBeUndefined();
  });

  it('regeneration is NOT suppressed by slashing damage', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(234) });
    const troll = buildTroll(50);
    const hero = buildHero();
    let campaign: Campaign = engine.createCampaign({ name: 'suppress-slash' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: troll } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, {
      combatantIds: [hero.id, troll.id],
    });
    campaign = commit(campaign, enc.events);
    campaign = commit(
      campaign,
      engine.plan.rollInitiative(campaign.state, {
        encounterId: enc.encounterId,
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events,
    );
    // Slashing damage doesn't match suppressedBy.
    const damage: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: troll.id,
      components: [{ type: 'slashing', amount: 10 }],
    };
    campaign = commit(campaign, [damage]);
    const advanceEvents = engine.plan.advanceTurn(campaign.state, {
      encounterId: enc.encounterId,
    }).events;
    const healedFromRegen = advanceEvents.find(
      (e) => e.type === 'Healed' && (e as HealedEvent).source === 'regeneration',
    ) as HealedEvent | undefined;
    expect(healedFromRegen).toBeDefined();
    expect(healedFromRegen!.amount).toBe(15);
  });

  it('damageTypesTakenThisTurn clears at turn-start so suppression is one-turn-only', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(235) });
    const troll = buildTroll(50);
    const hero = buildHero();
    let campaign: Campaign = engine.createCampaign({ name: 'one-turn-only' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: troll } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, {
      combatantIds: [hero.id, troll.id],
    });
    campaign = commit(campaign, enc.events);
    campaign = commit(
      campaign,
      engine.plan.rollInitiative(campaign.state, {
        encounterId: enc.encounterId,
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events,
    );
    // Hero turn: acid damage.
    const damage: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: troll.id,
      components: [{ type: 'acid', amount: 10 }],
    };
    campaign = commit(campaign, [damage]);
    // Advance to troll turn — regen suppressed.
    campaign = commit(
      campaign,
      engine.plan.advanceTurn(campaign.state, { encounterId: enc.encounterId }).events,
    );
    // Troll turn passes without taking more acid/fire damage.
    // Advance back to hero turn, then to troll turn again.
    campaign = commit(
      campaign,
      engine.plan.advanceTurn(campaign.state, { encounterId: enc.encounterId }).events,
    );
    const advanceEvents = engine.plan.advanceTurn(campaign.state, {
      encounterId: enc.encounterId,
    }).events;
    const healedFromRegen = advanceEvents.find(
      (e) => e.type === 'Healed' && (e as HealedEvent).source === 'regeneration',
    ) as HealedEvent | undefined;
    expect(healedFromRegen).toBeDefined();
    expect(healedFromRegen!.amount).toBe(15);
  });
});
