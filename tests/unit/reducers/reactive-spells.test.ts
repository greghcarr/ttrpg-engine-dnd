import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';
import { newEffectInstanceId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ItemAcquiredEvent } from '../../../src/schemas/events/inventory.js';
import type {
  SpellCounteredEvent,
  SpellDispelledEvent,
  ItemIdentifiedEvent,
} from '../../../src/schemas/events/reactive-spells.js';
import type { ConcentrationStartedEvent } from '../../../src/schemas/events/concentration.js';

const evt = <T extends { id: string; at: string }>(e: Omit<T, 'id' | 'at'>): T =>
  ({ id: eventId(), at: isoTimestamp(), ...e }) as T;

describe('reducer: reactive spells', () => {
  it('SpellCountered is record-only and does not mutate state', () => {
    const caster = buildFighter({ name: 'Caster' });
    const target = buildFighter({ name: 'Target' });
    let state = applyAll(emptyCampaignState(), [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: caster }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: target }),
    ]);
    const before = state.version;
    state = apply(
      state,
      evt<SpellCounteredEvent>({
        type: 'SpellCountered',
        originalSpellEventId: 'evt-x',
        counterCasterId: caster.id,
        targetCasterId: target.id,
        spellId: 'fireball',
      }),
    );
    expect(state.version).toBe(before + 1);
  });

  it('SpellDispelled removes the effect, applied conditions, and concentration link', () => {
    const caster = buildFighter({ name: 'Caster' });
    const target = buildFighter({ name: 'Target' });
    const effectId = newEffectInstanceId();
    let state = applyAll(emptyCampaignState(), [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: caster }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: target }),
      evt<ConcentrationStartedEvent>({
        type: 'ConcentrationStarted',
        casterId: caster.id,
        spellId: 'hold-person',
        effectInstanceId: effectId,
        targetIds: [target.id],
        conditionsApplied: [],
      }),
    ]);
    expect(state.effectInstances[effectId]).toBeDefined();
    expect(state.characters[caster.id]?.concentrationEffectId).toBe(effectId);
    state = apply(
      state,
      evt<SpellDispelledEvent>({
        type: 'SpellDispelled',
        effectInstanceId: effectId,
        dispelledByCharacterId: caster.id,
      }),
    );
    expect(state.effectInstances[effectId]).toBeUndefined();
    expect(state.characters[caster.id]?.concentrationEffectId).toBeUndefined();
  });

  it('ItemIdentified appends the character to the item identified list', () => {
    const c = buildFighter({ name: 'Bookworm' });
    const item = makeItemInstance('longsword');
    let state = applyAll(emptyCampaignState(), [
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: c }),
      evt<ItemAcquiredEvent>({ type: 'ItemAcquired', instance: item }),
    ]);
    state = apply(
      state,
      evt<ItemIdentifiedEvent>({
        type: 'ItemIdentified',
        itemInstanceId: item.id,
        identifiedByCharacterId: c.id,
      }),
    );
    expect(state.itemInstances[item.id]?.identifiedByCharacterIds).toEqual([c.id]);
    state = apply(
      state,
      evt<ItemIdentifiedEvent>({
        type: 'ItemIdentified',
        itemInstanceId: item.id,
        identifiedByCharacterId: c.id,
      }),
    );
    expect(state.itemInstances[item.id]?.identifiedByCharacterIds).toEqual([c.id]);
  });
});
