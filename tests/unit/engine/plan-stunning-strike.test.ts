import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Monk Stunning Strike (Monk L5). Bug this prevents: a Monk who
// scores a hit should be able to spend a Focus Point to force a CON
// save with stunned-on-fail. Without wiring, the feature is inert.

const PACK = loadStarterPack();

const buildMonk = (opts: { kiCurrent?: number; level?: number } = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Iri',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level: opts.level ?? 5, hitDiceRemaining: opts.level ?? 5 }],
    abilityScores: { STR: 14, DEX: 16, CON: 14, INT: 10, WIS: 16, CHA: 10 },
    hp: { current: 38, max: 38, temp: 0 },
    featsTaken: [],
    resources: [{ resourceId: 'ki', current: opts.kiCurrent ?? 5, max: 5 }],
  });

const buildTarget = (con = 10): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Foe',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: con, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 20, max: 20, temp: 0 },
    featsTaken: [],
  });

describe('Stunning Strike (Monk L5)', () => {
  it('spends 1 Focus Point and emits SaveRolled (CON, DC 8 + WIS + prof)', () => {
    const monk = buildMonk();
    const target = buildTarget();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(11) });
    let campaign: Campaign = engine.createCampaign({ name: 'ss-test' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: monk } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const result = engine.plan.stunningStrike(campaign.state, { monkId: monk.id, targetId: target.id });
    const types = result.events.map((e) => e.type);
    expect(types).toContain('ResourceSpent');
    expect(types).toContain('SaveRolled');
    const save = result.events.find((e) => e.type === 'SaveRolled') as SaveRolledEvent;
    // DC = 8 + WIS (16 → +3) + prof bonus (L5 → +3) = 14.
    expect(save.dc).toBe(14);
    expect(save.ability).toBe('CON');
  });

  it('on failure, applies the Stunned condition to the target', () => {
    // CON 1 target almost always fails the save.
    const monk = buildMonk();
    const target = buildTarget(1);
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'ss-fail' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: monk } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const events = engine.plan.stunningStrike(campaign.state, { monkId: monk.id, targetId: target.id }).events;
    // Probably failed unless nat-20.
    const save = events.find((e) => e.type === 'SaveRolled') as SaveRolledEvent;
    if (!save.success) {
      expect(events.some((e) => e.type === 'ConditionApplied')).toBe(true);
    }
  });

  it('throws when no Focus Points are available', () => {
    const monk = buildMonk({ kiCurrent: 0 });
    const target = buildTarget();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'ss-no-ki' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: monk } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.stunningStrike(campaign.state, { monkId: monk.id, targetId: target.id }),
    ).toThrow(/Focus Points/);
  });

  it('throws when attempted twice in the same turn (in an encounter)', () => {
    const monk = buildMonk();
    const target = buildTarget();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'ss-twice' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: monk } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [monk.id, target.id] });
    campaign = commit(campaign, enc.events);
    campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
    campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);

    campaign = commit(
      campaign,
      engine.plan.stunningStrike(campaign.state, { monkId: monk.id, targetId: target.id }).events,
    );
    expect(() =>
      engine.plan.stunningStrike(campaign.state, { monkId: monk.id, targetId: target.id }),
    ).toThrow(/already attempted/);
  });

  it('out-of-encounter calls skip the once-per-turn enforcement', () => {
    const monk = buildMonk();
    const target = buildTarget();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'ss-no-encounter' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: monk } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    // Twice in succession out of an encounter — both should succeed.
    campaign = commit(
      campaign,
      engine.plan.stunningStrike(campaign.state, { monkId: monk.id, targetId: target.id }).events,
    );
    expect(() =>
      engine.plan.stunningStrike(campaign.state, { monkId: monk.id, targetId: target.id }),
    ).not.toThrow();
  });
});
