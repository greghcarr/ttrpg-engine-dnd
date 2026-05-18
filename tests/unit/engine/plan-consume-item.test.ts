import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent, HealedEvent } from '../../../src/schemas/events/combat.js';
import type { ItemConsumedEvent } from '../../../src/schemas/events/inventory.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

// Slice 235: ConsumeItem planner. Canonical user: Potions of Healing
// (Common, Greater Uncommon, Superior Rare, Supreme Very Rare). The
// planner walks the consumable's onConsume actions, emits the
// corresponding effect events (Healed for Heal actions), then emits
// an ItemConsumed event that the reducer uses to retire the instance.

const PACK = loadStarterPack();

const buildHero = (currentHp: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Hero',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: currentHp, max: 40, temp: 0 },
  });

describe('planConsumeItem (slice 235)', () => {
  it('drinking a Potion of Healing emits a Healed event and removes the instance', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(235) });
    const potion = makeItemInstance('healing-potion');
    const baseHero = buildHero(10);
    const hero: Character = {
      ...baseHero,
      inventory: [potion.id],
    };
    let campaign: Campaign = engine.createCampaign({ name: 'healing-potion' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.consumeItem(campaign.state, {
      characterId: hero.id,
      instanceId: potion.id,
    });
    const healed = events.find((e) => e.type === 'Healed') as HealedEvent | undefined;
    const consumed = events.find((e) => e.type === 'ItemConsumed') as ItemConsumedEvent | undefined;
    expect(healed).toBeDefined();
    expect(consumed).toBeDefined();
    expect(healed!.targetId).toBe(hero.id);
    // 2d4+2 ranges 4-10.
    expect(healed!.amount).toBeGreaterThanOrEqual(4);
    expect(healed!.amount).toBeLessThanOrEqual(10);
    expect(consumed!.characterId).toBe(hero.id);
    expect(consumed!.instanceId).toBe(potion.id);
  });

  it("a Potion of Supreme Healing rolls 10d4+20 (range 30..60)", () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(236) });
    const potion = makeItemInstance('potion-of-supreme-healing');
    const baseHero = buildHero(1);
    const hero: Character = { ...baseHero, inventory: [potion.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'supreme' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.consumeItem(campaign.state, {
      characterId: hero.id,
      instanceId: potion.id,
    });
    const healed = events.find((e) => e.type === 'Healed') as HealedEvent | undefined;
    expect(healed).toBeDefined();
    expect(healed!.amount).toBeGreaterThanOrEqual(30);
    expect(healed!.amount).toBeLessThanOrEqual(60);
  });

  it('after consumption, the item instance is removed from inventory and itemInstances', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(237) });
    const potion = makeItemInstance('healing-potion');
    const baseHero = buildHero(10);
    const hero: Character = { ...baseHero, inventory: [potion.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'retire-instance' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.consumeItem(campaign.state, {
        characterId: hero.id,
        instanceId: potion.id,
      }).events,
    );
    expect(campaign.state.characters[hero.id]!.inventory).not.toContain(potion.id);
    expect(campaign.state.itemInstances[potion.id]).toBeUndefined();
  });

  it('feeding a potion to another character heals the targetId, not the consumer', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(238) });
    const potion = makeItemInstance('healing-potion');
    const baseAlice = buildHero(40);
    const baseBob = buildHero(5);
    const alice: Character = { ...baseAlice, name: 'Alice', inventory: [potion.id] };
    const bob: Character = { ...baseBob, name: 'Bob' };
    let campaign: Campaign = engine.createCampaign({ name: 'feed-to-bob' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alice } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bob } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.consumeItem(campaign.state, {
      characterId: alice.id,
      instanceId: potion.id,
      targetId: bob.id,
    });
    const healed = events.find((e) => e.type === 'Healed') as HealedEvent | undefined;
    expect(healed!.targetId).toBe(bob.id);
  });

  it('throws when the instance is not in the consumer inventory', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(239) });
    const potion = makeItemInstance('healing-potion');
    const hero = buildHero(10);
    let campaign: Campaign = engine.createCampaign({ name: 'no-inventory' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.consumeItem(campaign.state, {
        characterId: hero.id,
        instanceId: potion.id,
      }),
    ).toThrow(/not in.*inventory/);
  });

  it('drinking a Potion of Climbing applies the spider-climbing-active condition', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(241) });
    const potion = makeItemInstance('potion-of-climbing');
    const baseHero = buildHero(20);
    const hero: Character = { ...baseHero, inventory: [potion.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'climbing-potion' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.consumeItem(campaign.state, {
      characterId: hero.id,
      instanceId: potion.id,
    });
    const condApplied = events.find(
      (e) => e.type === 'ConditionApplied' && (e as ConditionAppliedEvent).conditionId === 'spider-climbing-active',
    ) as ConditionAppliedEvent | undefined;
    expect(condApplied).toBeDefined();
    expect(condApplied!.targetId).toBe(hero.id);
    expect(condApplied!.sourceCharacterId).toBe(hero.id);
    // The instance is still retired regardless of action kind.
    expect(events.some((e) => e.type === 'ItemConsumed')).toBe(true);
  });

  it('drinking a Potion of Water Breathing applies the water-breathing-active condition', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(242) });
    const potion = makeItemInstance('potion-of-water-breathing');
    const baseHero = buildHero(20);
    const hero: Character = { ...baseHero, inventory: [potion.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'water-breathing-potion' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.consumeItem(campaign.state, {
        characterId: hero.id,
        instanceId: potion.id,
      }).events,
    );
    const applied = campaign.state.characters[hero.id]!.appliedConditions.find(
      (c) => c.conditionId === 'water-breathing-active',
    );
    expect(applied).toBeDefined();
  });

  it('drinking a Spell Scroll of Magic Missile casts the spell at slot level 1', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(243) });
    const scroll = makeItemInstance('spell-scroll-of-magic-missile');
    const baseHero = buildHero(40);
    const hero: Character = { ...baseHero, inventory: [scroll.id] };
    const target = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Goblin',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
      abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 20, max: 20, temp: 0 },
    });
    let campaign: Campaign = engine.createCampaign({ name: 'scroll-magic-missile' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: scroll },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.consumeItem(campaign.state, {
      characterId: hero.id,
      instanceId: scroll.id,
      castTargetIds: [target.id, target.id, target.id],
    });
    // Magic Missile fires SpellCastDeclared + per-dart damage chain.
    expect(events.some((e) => e.type === 'SpellCastDeclared')).toBe(true);
    // No slot consumed (the scroll provided the slot).
    expect(events.some((e) => e.type === 'SpellSlotConsumed')).toBe(false);
    // The scroll itself is consumed.
    expect(events.some((e) => e.type === 'ItemConsumed')).toBe(true);
  });

  it('a non-caster (Barbarian) can use the scroll thanks to ignorePreparation', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(244) });
    const scroll = makeItemInstance('spell-scroll-of-fireball');
    const barbarian: Character = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Grok',
      speciesId: 'human',
      backgroundId: 'outlander',
      classes: [{ classId: 'barbarian', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 18, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 10 },
      hp: { current: 50, max: 50, temp: 0 },
      inventory: [scroll.id],
    });
    const target = buildHero(20);
    let campaign: Campaign = engine.createCampaign({ name: 'scroll-fireball' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: scroll },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: barbarian } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    // Barbarian has no spellcasting class, no spells, definitely can't
    // cast Fireball without ignorePreparation. The scroll should let
    // them anyway.
    expect(() =>
      engine.plan.consumeItem(campaign.state, {
        characterId: barbarian.id,
        instanceId: scroll.id,
        castTargetIds: [target.id],
      }),
    ).not.toThrow();
  });

  it('throws when the item is not a consumable', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(240) });
    const sword = makeItemInstance('longsword');
    const baseHero = buildHero(10);
    const hero: Character = { ...baseHero, inventory: [sword.id] };
    let campaign: Campaign = engine.createCampaign({ name: 'wrong-kind' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: hero } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.consumeItem(campaign.state, {
        characterId: hero.id,
        instanceId: sword.id,
      }),
    ).toThrow(/not a consumable/);
  });
});
