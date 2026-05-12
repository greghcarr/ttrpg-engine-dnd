import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../../src/rng/throw.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { LevelUpResolvedEvent } from '../../../src/schemas/events/level-up.js';

const seedFighter = (rng = seededRNG(1)) => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng });
  const character = buildFighter({ level: 1, hpMax: 12, hpCurrent: 12, hitDiceRemaining: 1, CON: 14 });
  let campaign = engine.createCampaign({ name: 'lvl' });
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, characterId: character.id };
};

describe('engine.plan.levelUp', () => {
  it('average HP strategy: gain = die-average + CON mod', () => {
    const { engine, campaign, characterId } = seedFighter();
    const { events } = engine.plan.levelUp(campaign.state, {
      characterId,
      classId: 'fighter',
      hpStrategy: 'average',
    });
    expect(events).toHaveLength(1);
    const e = events[0] as LevelUpResolvedEvent;
    expect(e.newClassLevel).toBe(2);
    expect(e.hpGained).toBe(6 + 2);
    expect(e.hpRoll).toBeUndefined();
  });

  it('roll HP strategy: captures a die roll', () => {
    const { engine, campaign, characterId } = seedFighter();
    const { events } = engine.plan.levelUp(campaign.state, {
      characterId,
      classId: 'fighter',
      hpStrategy: 'roll',
    });
    const e = events[0] as LevelUpResolvedEvent;
    expect(e.hpRoll).toBeGreaterThanOrEqual(1);
    expect(e.hpRoll).toBeLessThanOrEqual(10);
    expect(e.hpGained).toBe((e.hpRoll ?? 0) + 2);
  });

  it('roll is deterministic for a fixed seed', () => {
    const a = seedFighter(seededRNG(42));
    const b = seedFighter(seededRNG(42));
    const ea = a.engine.plan.levelUp(a.campaign.state, {
      characterId: a.characterId,
      classId: 'fighter',
      hpStrategy: 'roll',
    }).events[0] as LevelUpResolvedEvent;
    const eb = b.engine.plan.levelUp(b.campaign.state, {
      characterId: b.characterId,
      classId: 'fighter',
      hpStrategy: 'roll',
    }).events[0] as LevelUpResolvedEvent;
    expect(ea.hpRoll).toBe(eb.hpRoll);
  });

  it('emits LevelUpResolved + adjusts state on commit', () => {
    const { engine, campaign, characterId } = seedFighter();
    const { events } = engine.plan.levelUp(campaign.state, {
      characterId,
      classId: 'fighter',
      hpStrategy: 'average',
    });
    const after = commit(campaign, events);
    expect(after.state.characters[characterId]?.classes[0]?.level).toBe(2);
    expect(after.state.characters[characterId]?.hp.max).toBe(12 + 8);
  });

  it('applying planned events with ThrowOnCallRNG does not call RNG', () => {
    const { engine, campaign, characterId } = seedFighter();
    const events = engine.plan.levelUp(campaign.state, {
      characterId,
      classId: 'fighter',
      hpStrategy: 'roll',
    }).events;
    void throwOnCallRNG();
    expect(() => engine.applyAll(campaign.state, events)).not.toThrow();
  });

  it('throws on unknown character', () => {
    const { engine, campaign } = seedFighter();
    expect(() =>
      engine.plan.levelUp(campaign.state, {
        characterId: '01HKQM3J6S1H4ZGSTPYBHN0VCS',
        classId: 'fighter',
        hpStrategy: 'average',
      }),
    ).toThrow(/Unknown character/);
  });

  it('throws when class not enrolled', () => {
    const { engine, campaign, characterId } = seedFighter();
    expect(() =>
      engine.plan.levelUp(campaign.state, {
        characterId,
        classId: 'wizard',
        hpStrategy: 'average',
      }),
    ).toThrow(/no enrollment/);
  });

  it('refuses to advance past 20', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const character = buildFighter({ level: 20, hpMax: 200, hpCurrent: 200, hitDiceRemaining: 20 });
    let campaign = engine.createCampaign({ name: 'max' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: character,
      } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.levelUp(campaign.state, {
        characterId: character.id,
        classId: 'fighter',
        hpStrategy: 'average',
      }),
    ).toThrow(/max level/);
  });
});

describe('engine.plan.resolveChoice', () => {
  it('rejects unknown choice', () => {
    const { engine, campaign, characterId } = seedFighter();
    expect(() =>
      engine.plan.resolveChoice(campaign.state, {
        choiceId: '01HKQM3J6S1H4ZGSTPYBHN0VCS',
        characterId,
        selectedOptionIds: ['x'],
      }),
    ).toThrow(/Unknown choice/);
  });
});
