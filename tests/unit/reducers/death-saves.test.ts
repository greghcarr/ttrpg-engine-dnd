import { describe, expect, it } from 'vitest';
import { apply } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  DeathSaveRolledEvent,
  StabilizedEvent,
} from '../../../src/schemas/events/combat.js';

const seedDowned = () => {
  const character = buildFighter({ hpCurrent: 0 });
  const created: CharacterCreatedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: character,
  };
  return { state: apply(emptyCampaignState(), created), characterId: character.id };
};

describe('DeathSaveRolled reducer', () => {
  it('roll 10+: success', () => {
    const { state, characterId } = seedDowned();
    const event: DeathSaveRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DeathSaveRolled',
      targetId: characterId,
      d20: 12,
      success: true,
      critical: false,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.deathSaves.successes).toBe(1);
  });

  it('roll <10: failure', () => {
    const { state, characterId } = seedDowned();
    const event: DeathSaveRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DeathSaveRolled',
      targetId: characterId,
      d20: 5,
      success: false,
      critical: false,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.deathSaves.failures).toBe(1);
  });

  it('nat 1 counts as 2 failures', () => {
    const { state, characterId } = seedDowned();
    const event: DeathSaveRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DeathSaveRolled',
      targetId: characterId,
      d20: 1,
      success: false,
      critical: false,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.deathSaves.failures).toBe(2);
  });

  it('nat 20 revives to 1 HP', () => {
    const { state, characterId } = seedDowned();
    const event: DeathSaveRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DeathSaveRolled',
      targetId: characterId,
      d20: 20,
      success: true,
      critical: true,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(1);
    expect(next.characters[characterId]?.deathSaves.successes).toBe(0);
  });

  it('3 successes → stable', () => {
    const { state, characterId } = seedDowned();
    let s = state;
    for (let i = 0; i < 3; i++) {
      s = apply(s, {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DeathSaveRolled',
        targetId: characterId,
        d20: 12,
        success: true,
        critical: false,
      } satisfies DeathSaveRolledEvent);
    }
    expect(s.characters[characterId]?.deathSaves.stable).toBe(true);
    expect(s.characters[characterId]?.deathSaves.successes).toBe(3);
  });

  it('rejects death save when not at 0 HP', () => {
    const character = buildFighter({ hpCurrent: 5 });
    const created: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    };
    const state = apply(emptyCampaignState(), created);
    const event: DeathSaveRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DeathSaveRolled',
      targetId: character.id,
      d20: 12,
      success: true,
      critical: false,
    };
    expect(() => apply(state, event)).toThrow(/Death saves only apply at 0 HP/);
  });
});

describe('Stabilized reducer', () => {
  it('sets stable and clears counters', () => {
    const { state, characterId } = seedDowned();
    const event: StabilizedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'Stabilized',
      targetId: characterId,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.deathSaves.stable).toBe(true);
    expect(next.characters[characterId]?.deathSaves.successes).toBe(0);
    expect(next.characters[characterId]?.deathSaves.failures).toBe(0);
  });
});
