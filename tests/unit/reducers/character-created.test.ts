import { describe, expect, it } from 'vitest';
import { apply } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

describe('CharacterCreated reducer', () => {
  it('adds a character to state', () => {
    const character = buildFighter();
    const event: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    };
    const next = apply(emptyCampaignState(), event);
    expect(next.characters[character.id]).toEqual(character);
  });

  it('throws on duplicate id', () => {
    const character = buildFighter();
    const event: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    };
    const state = apply(emptyCampaignState(), event);
    expect(() => apply(state, event)).toThrow(/already exists/);
  });

  it('bumps state.version on every commit', () => {
    const initial = emptyCampaignState();
    expect(initial.version).toBe(0);
    const event: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: buildFighter(),
    };
    const next = apply(initial, event);
    expect(next.version).toBe(1);
  });
});
