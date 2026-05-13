import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import { parseSpellDurationMinutes } from '../../../src/internal/spell-duration.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildCleric = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Cleric',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 10, CON: 14, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildTarget = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 12, max: 12, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('parseSpellDurationMinutes', () => {
  it('parses common 2024 phrasings', () => {
    expect(parseSpellDurationMinutes('Instantaneous')).toBeUndefined();
    expect(parseSpellDurationMinutes('1 round')).toBe(1);
    expect(parseSpellDurationMinutes('1 minute')).toBe(1);
    expect(parseSpellDurationMinutes('10 minutes')).toBe(10);
    expect(parseSpellDurationMinutes('1 hour')).toBe(60);
    expect(parseSpellDurationMinutes('8 hours')).toBe(480);
    expect(parseSpellDurationMinutes('24 hours')).toBe(1440);
    expect(parseSpellDurationMinutes('Up to 1 minute')).toBe(1);
    expect(parseSpellDurationMinutes('Up to 10 minutes')).toBe(10);
    expect(parseSpellDurationMinutes('Until dispelled')).toBeUndefined();
    expect(parseSpellDurationMinutes('Special')).toBeUndefined();
  });
});

describe('planExpireSpellDurations', () => {
  it('emits ConcentrationBroken (durationEnded) when listed duration elapses', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric(['bless']);
    const t1 = buildTarget('T1');
    let campaign = engine.createCampaign({ name: 'expire' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t1 } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'bless',
        slotLevel: 1,
        targetIds: [t1.id, cleric.id],
      }).events,
    );
    // Bless is 1 minute. Before the time advances, nothing has expired.
    expect(engine.plan.expireSpellDurations(campaign.state).events).toHaveLength(0);

    // Advance one minute — listed duration elapses.
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'InGameTimeAdvanced', minutes: 1 },
    ]);
    const expiryEvents = engine.plan.expireSpellDurations(campaign.state).events;
    expect(expiryEvents).toHaveLength(1);
    expect(expiryEvents[0]?.type).toBe('ConcentrationBroken');
    if (expiryEvents[0]?.type === 'ConcentrationBroken') {
      expect(expiryEvents[0].reason).toBe('durationEnded');
    }

    // Applying the expiry clears the effect instance and the blessed condition.
    campaign = commit(campaign, expiryEvents);
    expect(campaign.state.characters[cleric.id]?.concentrationEffectId).toBeUndefined();
    expect(
      campaign.state.characters[t1.id]?.appliedConditions.some((c) => c.conditionId === 'blessed'),
    ).toBe(false);
  });

  it('does not expire effects with no listed duration (Until dispelled)', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric(['bless']);
    const t1 = buildTarget('T1');
    let campaign = engine.createCampaign({ name: 'no-duration' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t1 } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'bless',
        slotLevel: 1,
        targetIds: [t1.id],
      }).events,
    );
    // 30 seconds later (rounded down to 0 minutes); the effect should not expire.
    expect(engine.plan.expireSpellDurations(campaign.state).events).toHaveLength(0);
  });
});
