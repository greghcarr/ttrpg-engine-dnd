import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  PactSlotConsumedEvent,
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../../src/schemas/events/spellcasting.js';
import type {
  LongRestEndedEvent,
  LongRestStartedEvent,
  ShortRestEndedEvent,
  ShortRestStartedEvent,
} from '../../../src/schemas/events/rest.js';

const seed = () => {
  const character = buildFighter();
  const state = apply(emptyCampaignState(), {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: character,
  } satisfies CharacterCreatedEvent);
  return { state, characterId: character.id };
};

describe('SpellSlotConsumed reducer', () => {
  it('increments the used count for the given level', () => {
    const { state, characterId } = seed();
    const event: SpellSlotConsumedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'SpellSlotConsumed',
      characterId,
      slotLevel: 1,
    };
    const after = apply(state, event);
    expect(after.characters[characterId]?.spellSlotsUsed['1']).toBe(1);
  });

  it('accumulates across multiple casts at the same level', () => {
    const { state, characterId } = seed();
    const event: SpellSlotConsumedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'SpellSlotConsumed',
      characterId,
      slotLevel: 2,
    };
    const after = applyAll(state, [event, event, event]);
    expect(after.characters[characterId]?.spellSlotsUsed['2']).toBe(3);
  });
});

describe('PactSlotConsumed reducer', () => {
  it('increments pact slot usage', () => {
    const { state, characterId } = seed();
    const event: PactSlotConsumedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'PactSlotConsumed',
      characterId,
    };
    const after = applyAll(state, [event, event]);
    expect(after.characters[characterId]?.pactSlotsUsed).toBe(2);
  });
});

describe('SpellCastDeclared reducer', () => {
  it('does not mutate state on its own', () => {
    const { state, characterId } = seed();
    const event: SpellCastDeclaredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'SpellCastDeclared',
      characterId,
      spellId: 'fire-bolt',
      slotLevel: 0,
      slotSource: 'standard',
      targetIds: [],
      castAsRitual: false,
    };
    const after = apply(state, event);
    expect(after.characters[characterId]?.spellSlotsUsed).toEqual({});
    expect(after.version).toBe(state.version + 1);
  });
});

describe('rest interaction with spell slots', () => {
  it('long rest resets spell slots used and pact slots used', () => {
    const { state, characterId } = seed();
    const slot: SpellSlotConsumedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'SpellSlotConsumed',
      characterId,
      slotLevel: 1,
    };
    const pact: PactSlotConsumedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'PactSlotConsumed',
      characterId,
    };
    const start: LongRestStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'LongRestStarted',
      participantIds: [characterId],
    };
    const end: LongRestEndedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'LongRestEnded',
    };
    const after = applyAll(state, [slot, pact, start, end]);
    expect(after.characters[characterId]?.spellSlotsUsed).toEqual({});
    expect(after.characters[characterId]?.pactSlotsUsed).toBe(0);
  });

  it('short rest resets only pact slots used', () => {
    const { state, characterId } = seed();
    const slot: SpellSlotConsumedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'SpellSlotConsumed',
      characterId,
      slotLevel: 1,
    };
    const pact: PactSlotConsumedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'PactSlotConsumed',
      characterId,
    };
    const start: ShortRestStartedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ShortRestStarted',
      participantIds: [characterId],
    };
    const end: ShortRestEndedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ShortRestEnded',
    };
    const after = applyAll(state, [slot, pact, start, end]);
    expect(after.characters[characterId]?.spellSlotsUsed['1']).toBe(1);
    expect(after.characters[characterId]?.pactSlotsUsed).toBe(0);
  });
});
