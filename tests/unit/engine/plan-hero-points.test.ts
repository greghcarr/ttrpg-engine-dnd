import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { CampaignSettingsChangedEvent } from '../../../src/schemas/events/settings.js';

const seedWithHeroPointsOn = (rng = seededRNG(5)) => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng });
  const alyx = buildFighter({ name: 'Alyx', level: 3 });
  const mira = buildFighter({ name: 'Mira', level: 1 });
  let campaign = engine.createCampaign({ name: 'hp' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: mira } satisfies CharacterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CampaignSettingsChanged',
      heroPoints: true,
    } satisfies CampaignSettingsChangedEvent,
  ]);
  return { engine, campaign, alyxId: alyx.id, miraId: mira.id };
};

describe('Hero Points variant rule (DMG 2024)', () => {
  it('refuses to grant points when the setting is off', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx' });
    let campaign = engine.createCampaign({ name: 'hp-off' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.grantInitialHeroPoints(campaign.state, { characterIds: [alyx.id] }),
    ).toThrow(/Hero Points variant/);
  });

  it('grants 5 + (level - 1) hero points to each PC', () => {
    const { engine, campaign, alyxId, miraId } = seedWithHeroPointsOn();
    const { events } = engine.plan.grantInitialHeroPoints(campaign.state, {
      characterIds: [alyxId, miraId],
    });
    // Alyx is level 3 → 5 + 2 = 7. Mira is level 1 → 5.
    expect(events).toHaveLength(2);
    for (const e of events) {
      if (e.type === 'HeroPointGranted' && e.characterId === alyxId) {
        expect(e.amount).toBe(7);
      }
      if (e.type === 'HeroPointGranted' && e.characterId === miraId) {
        expect(e.amount).toBe(5);
      }
    }
    const after = commit(campaign, events);
    expect(after.state.characters[alyxId]?.heroPoints).toBe(7);
    expect(after.state.characters[miraId]?.heroPoints).toBe(5);
  });

  it('spending a Hero Point rolls a d6 and decrements the pool', () => {
    const { engine, campaign, alyxId } = seedWithHeroPointsOn();
    const granted = engine.plan.grantInitialHeroPoints(campaign.state, {
      characterIds: [alyxId],
    });
    const after = commit(campaign, granted.events);
    const outcome = engine.plan.spendHeroPoint(after.state, {
      characterId: alyxId,
      appliedTo: 'save',
    });
    expect(outcome.d6).toBeGreaterThanOrEqual(1);
    expect(outcome.d6).toBeLessThanOrEqual(6);
    const types = outcome.events.map((e) => e.type);
    expect(types).toEqual(['HeroPointSpent']);
    const final = commit(after, outcome.events);
    expect(final.state.characters[alyxId]?.heroPoints).toBe(6); // 7 - 1
  });

  it('rejects spending when the pool is empty', () => {
    const { engine, campaign, alyxId } = seedWithHeroPointsOn();
    expect(() =>
      engine.plan.spendHeroPoint(campaign.state, { characterId: alyxId }),
    ).toThrow(/no Hero Points/);
  });
});

describe('Gritty Realism variant: rest events stamp the right duration', () => {
  it('standard rules: short rest = 60 min, long rest = 480 min', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx' });
    let campaign = engine.createCampaign({ name: 'standard' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
    ]);
    const sr = engine.plan.rest(campaign.state, { type: 'ShortRest', participantIds: [alyx.id] });
    const srStart = sr.events.find((e) => e.type === 'ShortRestStarted');
    if (srStart?.type === 'ShortRestStarted') {
      expect(srStart.expectedDurationMinutes).toBe(60);
    }
    const lr = engine.plan.rest(campaign.state, { type: 'LongRest', participantIds: [alyx.id] });
    const lrStart = lr.events.find((e) => e.type === 'LongRestStarted');
    if (lrStart?.type === 'LongRestStarted') {
      expect(lrStart.expectedDurationMinutes).toBe(480);
    }
  });

  it('gritty: short rest = 480 min, long rest = 7 days', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx' });
    let campaign = engine.createCampaign({ name: 'gritty' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CampaignSettingsChanged',
        grittyRest: true,
      } satisfies CampaignSettingsChangedEvent,
    ]);
    const sr = engine.plan.rest(campaign.state, { type: 'ShortRest', participantIds: [alyx.id] });
    const srStart = sr.events.find((e) => e.type === 'ShortRestStarted');
    if (srStart?.type === 'ShortRestStarted') {
      expect(srStart.expectedDurationMinutes).toBe(480);
    }
    const lr = engine.plan.rest(campaign.state, { type: 'LongRest', participantIds: [alyx.id] });
    const lrStart = lr.events.find((e) => e.type === 'LongRestStarted');
    if (lrStart?.type === 'LongRestStarted') {
      expect(lrStart.expectedDurationMinutes).toBe(60 * 24 * 7);
    }
  });
});
