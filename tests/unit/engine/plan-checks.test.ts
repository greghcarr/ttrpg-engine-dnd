import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../../src/rng/throw.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  AbilityCheckRolledEvent,
  SaveRolledEvent,
} from '../../../src/schemas/events/checks.js';

const seedFighter = (rng = seededRNG(1)) => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng });
  const character = buildFighter({ STR: 18, DEX: 14, CON: 14 });
  let campaign = engine.createCampaign({ name: 'checks' });
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

describe('engine.plan.save', () => {
  it('emits SaveRolled with baked d20, modifier, total, and success flag', () => {
    const { engine, campaign, characterId } = seedFighter();
    const { events } = engine.plan.save(campaign.state, {
      characterId,
      ability: 'STR',
      dc: 10,
    });
    expect(events).toHaveLength(1);
    const e = events[0] as SaveRolledEvent;
    expect(e.d20.length).toBeGreaterThanOrEqual(1);
    expect(e.bonus).toBe(4 + 2);
    expect(e.total).toBe((e.d20[0] ?? 0) + e.bonus);
    expect(e.success).toBe(e.total >= 10);
  });

  it('advantage rolls two d20 and keeps the higher', () => {
    const { engine, campaign, characterId } = seedFighter();
    const { events } = engine.plan.save(campaign.state, {
      characterId,
      ability: 'STR',
      dc: 15,
      advantage: 'advantage',
    });
    const e = events[0] as SaveRolledEvent;
    expect(e.d20).toHaveLength(2);
    expect(e.used).toBe('advantage');
    const max = Math.max(...e.d20);
    expect(e.total).toBe(max + e.bonus);
  });

  it('disadvantage keeps the lower', () => {
    const { engine, campaign, characterId } = seedFighter();
    const { events } = engine.plan.save(campaign.state, {
      characterId,
      ability: 'STR',
      dc: 15,
      advantage: 'disadvantage',
    });
    const e = events[0] as SaveRolledEvent;
    const min = Math.min(...e.d20);
    expect(e.total).toBe(min + e.bonus);
  });

  it('deterministic for a fixed seed', () => {
    const a = seedFighter(seededRNG(42));
    const b = seedFighter(seededRNG(42));
    const ea = a.engine.plan.save(a.campaign.state, {
      characterId: a.characterId,
      ability: 'STR',
      dc: 10,
    }).events[0] as SaveRolledEvent;
    const eb = b.engine.plan.save(b.campaign.state, {
      characterId: b.characterId,
      ability: 'STR',
      dc: 10,
    }).events[0] as SaveRolledEvent;
    expect(ea.d20).toEqual(eb.d20);
    expect(ea.success).toBe(eb.success);
  });

  it('apply of resolution event does not call RNG', () => {
    const { engine, campaign, characterId } = seedFighter();
    const events = engine.plan.save(campaign.state, {
      characterId,
      ability: 'STR',
      dc: 10,
    }).events;
    void throwOnCallRNG();
    expect(() => engine.applyAll(campaign.state, events)).not.toThrow();
  });
});

describe('engine.plan.abilityCheck', () => {
  it('raw ability check (no skill) just uses ability mod', () => {
    const { engine, campaign, characterId } = seedFighter();
    const { events } = engine.plan.abilityCheck(campaign.state, {
      characterId,
      ability: 'STR',
    });
    const e = events[0] as AbilityCheckRolledEvent;
    expect(e.bonus).toBe(4);
    expect(e.skill).toBeUndefined();
    expect(e.success).toBeUndefined();
  });

  it('skill check populates skill field and computes success when dc given', () => {
    const { engine, campaign, characterId } = seedFighter();
    const { events } = engine.plan.abilityCheck(campaign.state, {
      characterId,
      ability: 'STR',
      skill: 'athletics',
      dc: 10,
    });
    const e = events[0] as AbilityCheckRolledEvent;
    expect(e.skill).toBe('athletics');
    expect(e.success).toBe(e.total >= 10);
  });

  it('deterministic for a fixed seed', () => {
    const a = seedFighter(seededRNG(7));
    const b = seedFighter(seededRNG(7));
    const ea = a.engine.plan.abilityCheck(a.campaign.state, {
      characterId: a.characterId,
      ability: 'DEX',
    }).events[0] as AbilityCheckRolledEvent;
    const eb = b.engine.plan.abilityCheck(b.campaign.state, {
      characterId: b.characterId,
      ability: 'DEX',
    }).events[0] as AbilityCheckRolledEvent;
    expect(ea.d20).toEqual(eb.d20);
  });

  it('apply of resolution event does not call RNG', () => {
    const { engine, campaign, characterId } = seedFighter();
    const events = engine.plan.abilityCheck(campaign.state, {
      characterId,
      ability: 'STR',
      skill: 'athletics',
    }).events;
    void throwOnCallRNG();
    expect(() => engine.applyAll(campaign.state, events)).not.toThrow();
  });
});
