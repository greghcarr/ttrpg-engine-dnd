import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ItemAcquiredEvent,
  ItemAttunedEvent,
  ItemEquippedEvent,
  ItemUnattunedEvent,
  ItemUnequippedEvent,
} from '../../../src/schemas/events/inventory.js';

const seedFighter = () => {
  const character = buildFighter();
  const armor1 = makeItemInstance('leather-armor');
  const armor2 = makeItemInstance('chain-mail');
  const ring1 = makeItemInstance('healing-potion');
  const ring2 = makeItemInstance('healing-potion');
  const ring3 = makeItemInstance('healing-potion');
  const ring4 = makeItemInstance('healing-potion');
  const state = applyAll(emptyCampaignState(), [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: character } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: armor1 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: armor2 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: ring1 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: ring2 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: ring3 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: ring4 } satisfies ItemAcquiredEvent,
  ]);
  return { state, characterId: character.id, armor1, armor2, ring1, ring2, ring3, ring4 };
};

describe('Item equip / unequip', () => {
  it('equipping an item sets the slot and links the instance back', () => {
    const { state, characterId, armor1 } = seedFighter();
    const event: ItemEquippedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemEquipped',
      characterId,
      instanceId: armor1.id,
      slot: 'armor',
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.equipped.armor).toBe(armor1.id);
    expect(next.itemInstances[armor1.id]?.equippedBy).toBe(characterId);
  });

  it('unequipping clears the slot and the instance back-link', () => {
    const { state, characterId, armor1 } = seedFighter();
    const equip: ItemEquippedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemEquipped',
      characterId,
      instanceId: armor1.id,
      slot: 'armor',
    };
    const unequip: ItemUnequippedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemUnequipped',
      characterId,
      slot: 'armor',
    };
    const next = applyAll(state, [equip, unequip]);
    expect(next.characters[characterId]?.equipped.armor).toBeUndefined();
    expect(next.itemInstances[armor1.id]?.equippedBy).toBeUndefined();
  });
});

describe('Item attunement', () => {
  it('attuning sets attuned and adds to character.equipped.attuned', () => {
    const { state, characterId, ring1 } = seedFighter();
    const event: ItemAttunedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemAttuned',
      characterId,
      instanceId: ring1.id,
    };
    const next = apply(state, event);
    expect(next.itemInstances[ring1.id]?.attuned).toBe(true);
    expect(next.itemInstances[ring1.id]?.attunedTo).toBe(characterId);
    expect(next.characters[characterId]?.equipped.attuned).toContain(ring1.id);
  });

  it('four attunements: fourth throws (max 3)', () => {
    const { state, characterId, ring1, ring2, ring3, ring4 } = seedFighter();
    const attune = (instanceId: string): ItemAttunedEvent => ({
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemAttuned',
      characterId,
      instanceId,
    });
    const after3 = applyAll(state, [attune(ring1.id), attune(ring2.id), attune(ring3.id)]);
    expect(after3.characters[characterId]?.equipped.attuned).toHaveLength(3);
    expect(() => apply(after3, attune(ring4.id))).toThrow(/maximum of 3/);
  });

  it('unattuning frees a slot, allowing a new attunement', () => {
    const { state, characterId, ring1, ring2, ring3, ring4 } = seedFighter();
    const attune = (instanceId: string): ItemAttunedEvent => ({
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemAttuned',
      characterId,
      instanceId,
    });
    const unattune: ItemUnattunedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemUnattuned',
      characterId,
      instanceId: ring2.id,
    };
    const after = applyAll(state, [
      attune(ring1.id),
      attune(ring2.id),
      attune(ring3.id),
      unattune,
      attune(ring4.id),
    ]);
    expect(after.characters[characterId]?.equipped.attuned).toHaveLength(3);
    expect(after.itemInstances[ring2.id]?.attuned).toBe(false);
    expect(after.itemInstances[ring4.id]?.attuned).toBe(true);
  });

  it('attuning an already-attuned item throws', () => {
    const { state, characterId, ring1 } = seedFighter();
    const event: ItemAttunedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemAttuned',
      characterId,
      instanceId: ring1.id,
    };
    const once = apply(state, event);
    expect(() => apply(once, event)).toThrow(/already attuned/);
  });
});
