import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ConditionAppliedEvent,
  ConditionRemovedEvent,
} from '../../../src/schemas/events/combat.js';
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
    ).toThrow(/0 charges remaining, needs 1/);
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

  // Slice 241: CastSpell UseAction variant. Same delegation pattern as
  // slice 237's ConsumeAction CastSpell — planUseItem hands the action
  // to planCastSpell with noSlotCost + ignorePreparation. Canonical
  // users: Boots of Levitation (Levitate L2, no charges, at-will) and
  // Hat of Disguise (Disguise Self L1, no charges, at-will). Both
  // target spells are schema-only, so the cast emits SpellCastDeclared
  // and no mechanical chain.
  it('using Boots of Levitation casts the Levitate spell on the wearer (no charges, no slot cost)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(246) });
    const boots = makeItemInstance('boots-of-levitation');
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [boots.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'boots-of-levitation' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: boots },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.useItem(campaign.state, {
      characterId: hero.id,
      instanceId: boots.id,
    });
    expect(events.some((e) => e.type === 'SpellCastDeclared')).toBe(true);
    // No slot consumed (item supplies the slot).
    expect(events.some((e) => e.type === 'SpellSlotConsumed')).toBe(false);
    // No charges to decrement (Boots of Levitation has no charges).
    expect(events.some((e) => e.type === 'ItemChargeConsumed')).toBe(false);
    // Instance persists.
    expect(events.some((e) => e.type === 'ItemUsed')).toBe(true);
  });

  it('using Hat of Disguise casts Disguise Self on the wearer (Barbarian non-caster path works)', () => {
    // Hat of Disguise via a Barbarian — verifies the ignorePreparation
    // + castingClassId='wizard' flow works for non-caster classes,
    // same shape as slice 237's scroll-of-fireball Barbarian test.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(247) });
    const hat = makeItemInstance('hat-of-disguise');
    const barbarian: Character = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Grok',
      speciesId: 'human',
      backgroundId: 'outlander',
      classes: [{ classId: 'barbarian', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 18, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 10 },
      hp: { current: 50, max: 50, temp: 0 },
      inventory: [hat.id],
    });
    let campaign: Campaign = engine.createCampaign({ name: 'hat-of-disguise' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: hat },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: barbarian } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.useItem(campaign.state, {
        characterId: barbarian.id,
        instanceId: hat.id,
      }),
    ).not.toThrow();
    const { events } = engine.plan.useItem(campaign.state, {
      characterId: barbarian.id,
      instanceId: hat.id,
    });
    expect(events.some((e) => e.type === 'SpellCastDeclared')).toBe(true);
    expect(events.some((e) => e.type === 'ItemUsed')).toBe(true);
  });

  // Slice 242: Toggle UseAction variant. Click-on / click-off shape.
  // Canonical user: Boots of Speed (rare wondrous, attunement, no
  // charges; onUse toggles `boots-of-speed-active`). The planner
  // inspects the target's current applied conditions: if the
  // conditionId is present, emit ConditionRemoved; otherwise emit
  // ConditionApplied.
  it('using Boots of Speed for the first time applies boots-of-speed-active', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(248) });
    const boots = makeItemInstance('boots-of-speed');
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [boots.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'boots-of-speed-on' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: boots },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.useItem(campaign.state, {
      characterId: hero.id,
      instanceId: boots.id,
    });
    const condApplied = events.find(
      (e) => e.type === 'ConditionApplied' && (e as ConditionAppliedEvent).conditionId === 'boots-of-speed-active',
    ) as ConditionAppliedEvent | undefined;
    expect(condApplied).toBeDefined();
    expect(condApplied!.sourceCharacterId).toBe(hero.id);
    expect(events.some((e) => e.type === 'ConditionRemoved')).toBe(false);
    expect(events.some((e) => e.type === 'ItemUsed')).toBe(true);
  });

  it('using Boots of Speed a second time removes boots-of-speed-active (toggle off)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(249) });
    const boots = makeItemInstance('boots-of-speed');
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [boots.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'boots-of-speed-toggle' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: boots },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    // First click: condition applied.
    campaign = commit(
      campaign,
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: boots.id,
      }).events,
    );
    expect(
      campaign.state.characters[hero.id]!.appliedConditions.some(
        (c) => c.conditionId === 'boots-of-speed-active',
      ),
    ).toBe(true);
    // Second click: condition removed.
    const second = engine.plan.useItem(campaign.state, {
      characterId: hero.id,
      instanceId: boots.id,
    });
    const removed = second.events.find(
      (e) => e.type === 'ConditionRemoved' && (e as ConditionRemovedEvent).conditionId === 'boots-of-speed-active',
    ) as ConditionRemovedEvent | undefined;
    expect(removed).toBeDefined();
    expect(removed!.targetId).toBe(hero.id);
    expect(second.events.some((e) => e.type === 'ConditionApplied')).toBe(false);
    campaign = commit(campaign, second.events);
    expect(
      campaign.state.characters[hero.id]!.appliedConditions.some(
        (c) => c.conditionId === 'boots-of-speed-active',
      ),
    ).toBe(false);
    // Boots persist (no charges, no retirement).
    expect(campaign.state.characters[hero.id]!.inventory).toContain(boots.id);
  });

  it('Toggle on third use re-applies the condition (full on/off/on cycle)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(250) });
    const boots = makeItemInstance('boots-of-speed');
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [boots.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'boots-of-speed-cycle' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: boots },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    // Click 1 (on), click 2 (off), click 3 (on again).
    for (let i = 0; i < 3; i += 1) {
      campaign = commit(
        campaign,
        engine.plan.useItem(campaign.state, {
          characterId: hero.id,
          instanceId: boots.id,
        }).events,
      );
    }
    expect(
      campaign.state.characters[hero.id]!.appliedConditions.some(
        (c) => c.conditionId === 'boots-of-speed-active',
      ),
    ).toBe(true);
  });

  // Slice 243: action-selector + per-action chargesCost. Canonical
  // user: Staff of Healing (rare staff with 10 charges; Lesser
  // Restoration costs 2, Mass Cure Wounds costs 5). The Cure Wounds
  // arm is variable-cost (1-4 charges → slot 1-4) and deferred to a
  // future slice. Both target spells are wired so the cast actually
  // emits the heal chain.
  it("using Staff of Healing's Mass Cure Wounds arm spends 5 charges and casts the wired spell", () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(251) });
    const staff = makeItemInstance('staff-of-healing', { chargesRemaining: 10, maxCharges: 10 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [staff.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'staff-mass-cure' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: staff },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.useItem(campaign.state, {
      characterId: hero.id,
      instanceId: staff.id,
      actionId: 'mass-cure-wounds',
    });
    const charge = events.find((e) => e.type === 'ItemChargeConsumed') as ItemChargeConsumedEvent | undefined;
    expect(charge).toBeDefined();
    expect(charge!.amount).toBe(5);
    expect(events.some((e) => e.type === 'SpellCastDeclared')).toBe(true);
    // No engine-tracked slot consumed (the staff supplies the slot).
    expect(events.some((e) => e.type === 'SpellSlotConsumed')).toBe(false);
    expect(events.some((e) => e.type === 'ItemUsed')).toBe(true);
  });

  it("using Staff of Healing's Lesser Restoration arm spends 2 charges", () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(252) });
    const staff = makeItemInstance('staff-of-healing', { chargesRemaining: 10, maxCharges: 10 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [staff.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'staff-lesser-restoration' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: staff },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: staff.id,
        actionId: 'lesser-restoration',
      }).events,
    );
    expect(campaign.state.itemInstances[staff.id]!.chargesRemaining).toBe(8);
    // Staff persists.
    expect(campaign.state.itemInstances[staff.id]).toBeDefined();
  });

  it('a multi-action item without an actionId on the intent throws with a helpful message', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(253) });
    const staff = makeItemInstance('staff-of-healing', { chargesRemaining: 10, maxCharges: 10 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [staff.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'staff-missing-actionid' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: staff },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: staff.id,
      }),
    ).toThrow(/multiple onUse actions.*actionId is required/);
  });

  it('an unknown actionId throws with a helpful message listing available ids', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(254) });
    const staff = makeItemInstance('staff-of-healing', { chargesRemaining: 10, maxCharges: 10 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [staff.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'staff-bad-actionid' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: staff },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: staff.id,
        actionId: 'nonexistent',
      }),
    ).toThrow(/no action with id 'nonexistent'/);
  });

  it('using Mass Cure Wounds with only 4 charges remaining throws (needs 5)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(255) });
    const staff = makeItemInstance('staff-of-healing', { chargesRemaining: 4, maxCharges: 10 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [staff.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'staff-not-enough' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: staff },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: staff.id,
        actionId: 'mass-cure-wounds',
      }),
    ).toThrow(/has 4 charges remaining, needs 5/);
  });

  it('single-action items still work without actionId on the intent (slice-240 back-compat)', () => {
    // Wings of Flying has a single onUse entry — slice 243's
    // action-selector should not require actionId for single-action
    // items.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(256) });
    const cloak = makeItemInstance('wings-of-flying', { chargesRemaining: 1, maxCharges: 1 });
    const baseHero = buildHero();
    const hero: Character = { ...baseHero, inventory: [cloak.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'wings-back-compat' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: cloak },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.useItem(campaign.state, {
        characterId: hero.id,
        instanceId: cloak.id,
      }),
    ).not.toThrow();
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
