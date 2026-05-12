import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

describe('createEngine integration', () => {
  it('creates an engine, makes a campaign, runs a vertical slice', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK] });
    const campaign = engine.createCampaign({ name: 'Family game' });
    const character = buildFighter({ level: 3, hpMax: 26 });
    const create: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    };
    const after = engine.commit(campaign, [create]);
    expect(after.cursor).toBe(1);
    expect(engine.derive.character(after.state, character.id).totalLevel).toBe(3);
    const ac = engine.derive.ac(after.state, character.id);
    expect(ac.total).toBeGreaterThan(0);
    const save = engine.derive.savingThrow(after.state, character.id, 'STR');
    expect(save.total).toBeGreaterThan(0);
  });

  it('throws on cross-reference validation failure', () => {
    const broken = {
      ...TEST_PACK,
      backgrounds: TEST_PACK.backgrounds.map((b) => ({
        ...b,
        originFeatId: 'definitely-nonexistent-feat',
      })),
    };
    expect(() => createEngine({ contentPacks: [broken] })).toThrow(/cross-reference/);
  });

  it('plan.longRest produces start + end events', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK] });
    const character = buildFighter();
    const result = engine.plan.longRest(engine.createCampaign({ name: 'x' }).state, {
      participantIds: [character.id],
      at: '2026-01-01T00:00:00.000Z',
    });
    expect(result.events).toHaveLength(2);
  });

  it('plan.rest dispatches to short or long correctly', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK] });
    const state = engine.createCampaign({ name: 'x' }).state;
    expect(
      engine.plan.rest(state, {
        type: 'ShortRest',
        participantIds: ['01HKQM3J6S1H4ZGSTPYBHN0VCS'],
        at: '2026-01-01T00:00:00.000Z',
      }).events[0]?.type,
    ).toBe('ShortRestStarted');
    expect(
      engine.plan.rest(state, {
        type: 'LongRest',
        participantIds: ['01HKQM3J6S1H4ZGSTPYBHN0VCS'],
        at: '2026-01-01T00:00:00.000Z',
      }).events[0]?.type,
    ).toBe('LongRestStarted');
  });

  it('derive.abilityModifier and derive.proficiencyBonus delegate correctly', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK] });
    expect(engine.derive.abilityModifier(16)).toBe(3);
    expect(engine.derive.proficiencyBonus(5)).toBe(3);
  });
});
