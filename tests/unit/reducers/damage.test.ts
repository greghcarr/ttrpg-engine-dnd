import { describe, expect, it } from 'vitest';
import { apply } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  DamageAppliedEvent,
  HealedEvent,
  TempHPGrantedEvent,
} from '../../../src/schemas/events/combat.js';

const seedWith = (hp: { current: number; max: number; temp?: number } = { current: 12, max: 12 }) => {
  const character = buildFighter({ hpMax: hp.max, hpCurrent: hp.current, hpTemp: hp.temp ?? 0 });
  const created: CharacterCreatedEvent = {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: character,
  };
  const state = apply(emptyCampaignState(), created);
  return { state, characterId: character.id };
};

describe('DamageApplied reducer', () => {
  it('subtracts simple damage', () => {
    const { state, characterId } = seedWith();
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: characterId,
      components: [{ amount: 5, type: 'slashing' }],
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(7);
  });

  it('temp HP absorbs first', () => {
    const { state, characterId } = seedWith({ current: 12, max: 12, temp: 4 });
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: characterId,
      components: [{ amount: 3, type: 'fire' }],
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.temp).toBe(1);
    expect(next.characters[characterId]?.hp.current).toBe(12);
  });

  it('temp HP exactly matches damage: temp 0, hp unchanged', () => {
    const { state, characterId } = seedWith({ current: 12, max: 12, temp: 5 });
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: characterId,
      components: [{ amount: 5, type: 'fire' }],
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.temp).toBe(0);
    expect(next.characters[characterId]?.hp.current).toBe(12);
  });

  it('temp HP less than damage: temp 0, rest applied', () => {
    const { state, characterId } = seedWith({ current: 12, max: 12, temp: 3 });
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: characterId,
      components: [{ amount: 5, type: 'fire' }],
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.temp).toBe(0);
    expect(next.characters[characterId]?.hp.current).toBe(10);
  });

  it('mixed damage types sum', () => {
    const { state, characterId } = seedWith();
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: characterId,
      components: [
        { amount: 3, type: 'slashing' },
        { amount: 4, type: 'fire' },
      ],
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(5);
  });

  it('drops to exactly 0 — character is downed (death save counters reset)', () => {
    const { state, characterId } = seedWith({ current: 5, max: 12 });
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: characterId,
      components: [{ amount: 5, type: 'slashing' }],
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(0);
    expect(next.characters[characterId]?.deathSaves.successes).toBe(0);
    expect(next.characters[characterId]?.deathSaves.failures).toBe(0);
    expect(next.characters[characterId]?.deathSaves.stable).toBe(false);
  });

  it('damage while at 0 HP adds a death save failure', () => {
    const { state, characterId } = seedWith({ current: 0, max: 12 });
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: characterId,
      components: [{ amount: 3, type: 'slashing' }],
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.deathSaves.failures).toBe(1);
  });

  it('massive damage exceeding max HP from full kills (3 death save failures)', () => {
    const { state, characterId } = seedWith({ current: 5, max: 12 });
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: characterId,
      components: [{ amount: 50, type: 'force' }],
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.deathSaves.failures).toBe(3);
  });

  it('throws on unknown target', () => {
    const { state } = seedWith();
    const event: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId: '01J0000000000000000000NEVER',
      components: [{ amount: 1, type: 'fire' }],
    };
    expect(() => apply(state, event)).toThrow(/not found/);
  });
});

describe('Healed reducer', () => {
  it('basic heal', () => {
    const { state, characterId } = seedWith({ current: 5, max: 12 });
    const event: HealedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'Healed',
      targetId: characterId,
      amount: 4,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(9);
  });

  it('clamps at max', () => {
    const { state, characterId } = seedWith({ current: 10, max: 12 });
    const event: HealedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'Healed',
      targetId: characterId,
      amount: 100,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(12);
  });

  it('revives downed character and clears death saves', () => {
    const { state, characterId } = seedWith({ current: 0, max: 12 });
    const event: HealedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'Healed',
      targetId: characterId,
      amount: 1,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(1);
    expect(next.characters[characterId]?.deathSaves.failures).toBe(0);
    expect(next.characters[characterId]?.deathSaves.successes).toBe(0);
  });

  it('zero or negative heal is a no-op', () => {
    const { state, characterId } = seedWith({ current: 5, max: 12 });
    const event: HealedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'Healed',
      targetId: characterId,
      amount: 0,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.current).toBe(5);
  });
});

describe('TempHPGranted reducer', () => {
  it('grants new temp HP', () => {
    const { state, characterId } = seedWith();
    const event: TempHPGrantedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TempHPGranted',
      targetId: characterId,
      amount: 5,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.hp.temp).toBe(5);
  });

  it('does not stack — higher value wins', () => {
    const { state, characterId } = seedWith();
    let s = apply(state, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TempHPGranted',
      targetId: characterId,
      amount: 3,
    } satisfies TempHPGrantedEvent);
    s = apply(s, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TempHPGranted',
      targetId: characterId,
      amount: 7,
    } satisfies TempHPGrantedEvent);
    expect(s.characters[characterId]?.hp.temp).toBe(7);
  });

  it('does not stack — lower value loses', () => {
    const { state, characterId } = seedWith();
    let s = apply(state, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TempHPGranted',
      targetId: characterId,
      amount: 5,
    } satisfies TempHPGrantedEvent);
    s = apply(s, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'TempHPGranted',
      targetId: characterId,
      amount: 2,
    } satisfies TempHPGrantedEvent);
    expect(s.characters[characterId]?.hp.temp).toBe(5);
  });
});
