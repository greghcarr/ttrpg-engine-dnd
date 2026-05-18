import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import type { ItemUsedEvent } from '../../../src/schemas/events/inventory.js';
import type { ItemChargeConsumedEvent } from '../../../src/schemas/events/charges.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

// Slice 240: planUseItem activates a magic item without retiring it.
// Canonical user: Wings of Flying (rare wondrous, attunement; 1/dawn
// charges; onUse applies the `flying-active` condition).
//
// The planner walks the item's `onUse` action list (currently only
// `ApplyCondition` variants), emits a charge decrement first if the
// definition has the charges shape, and emits an `ItemUsed` journal
// marker at the end. Unlike planConsumeItem, the instance persists
// after activation.

const PACK = loadStarterPack();

const buildHero = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Aerin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
  });

describe('planUseItem (slice 240)', () => {
  it('using Wings of Flying applies the flying-active condition and spends 1 charge', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(240) });
    const cloak = makeItemInstance('wings-of-flying', { chargesRemaining: 1, maxCharges: 1 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [cloak.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'wings-of-flying' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: cloak },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.useItem(campaign.state, {
      characterId: hero.id,
      instanceId: cloak.id,
    });
    const charge = events.find((e) => e.type === 'ItemChargeConsumed') as ItemChargeConsumedEvent | undefined;
    const condApplied = events.find(
      (e) => e.type === 'ConditionApplied' && (e as ConditionAppliedEvent).conditionId === 'flying-active',
    ) as ConditionAppliedEvent | undefined;
    const used = events.find((e) => e.type === 'ItemUsed') as ItemUsedEvent | undefined;
    expect(charge).toBeDefined();
    expect(charge!.amount).toBe(1);
    expect(charge!.itemInstanceId).toBe(cloak.id);
    expect(condApplied).toBeDefined();
    expect(condApplied!.targetId).toBe(hero.id);
    expect(condApplied!.sourceCharacterId).toBe(hero.id);
    expect(used).toBeDefined();
    expect(used!.characterId).toBe(hero.id);
    expect(used!.instanceId).toBe(cloak.id);
  });

  it('after using Wings of Flying, the instance persists and chargesRemaining drops to 0', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(241) });
    const cloak = makeItemInstance('wings-of-flying', { chargesRemaining: 1, maxCharges: 1 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [cloak.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'wings-persists' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: cloak },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: cloak.id,
      }).events,
    );
    expect(campaign.state.itemInstances[cloak.id]).toBeDefined();
    expect(campaign.state.itemInstances[cloak.id]!.chargesRemaining).toBe(0);
    expect(campaign.state.characters[hero.id]!.inventory).toContain(cloak.id);
    const applied = campaign.state.characters[hero.id]!.appliedConditions.find(
      (c) => c.conditionId === 'flying-active',
    );
    expect(applied).toBeDefined();
  });

  it('throws when the item has no charges remaining', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(242) });
    const cloak = makeItemInstance('wings-of-flying', { chargesRemaining: 0, maxCharges: 1 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [cloak.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'wings-empty' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: cloak },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: cloak.id,
      }),
    ).toThrow(/no charges remaining/);
  });

  it('throws when the item is not in the inventory', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(243) });
    const cloak = makeItemInstance('wings-of-flying', { chargesRemaining: 1, maxCharges: 1 });
    const hero = buildHero();
    let campaign: Campaign = engine.createCampaign({ name: 'wings-no-inventory' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: cloak },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: cloak.id,
      }),
    ).toThrow(/not in.*inventory/);
  });

  it('throws when the item is not a magic item', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(244) });
    const potion = makeItemInstance('healing-potion');
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [potion.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'use-potion-wrong-kind' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: potion.id,
      }),
    ).toThrow(/not a magic item/);
  });

  it('activating an item on a different target applies the condition to that target, not the user', () => {
    // Wings of Flying RAW is a self-only cloak; the engine doesn't
    // enforce that. Test the multi-target seam by using the same
    // planner with targetId pointing at an ally — the condition lands
    // on the ally and the charge still spends from the user's item.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(245) });
    const cloak = makeItemInstance('wings-of-flying', { chargesRemaining: 1, maxCharges: 1 });
    const baseAlice = buildHero();
    const baseBob = buildHero();
    const alice: Character = { ...baseAlice, name: 'Alice', inventory: [cloak.id] };
    const bob: Character = { ...baseBob, name: 'Bob' };
    let campaign: Campaign = engine.createCampaign({ name: 'wings-on-ally' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: cloak },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alice } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bob } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.useItem(campaign.state, {
      characterId: alice.id,
      instanceId: cloak.id,
      targetId: bob.id,
    });
    const condApplied = events.find((e) => e.type === 'ConditionApplied') as ConditionAppliedEvent | undefined;
    expect(condApplied!.targetId).toBe(bob.id);
    // sourceCharacterId still tracks the user (alice), not the target.
    expect(condApplied!.sourceCharacterId).toBe(alice.id);
  });
});
