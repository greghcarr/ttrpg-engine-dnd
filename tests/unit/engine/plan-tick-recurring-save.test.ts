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
import type { ActionEconomyConsumedEvent } from '../../../src/schemas/events/action-economy.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests engine.plan.tickRecurringSave via Bestow Curse's inactive-turn
// variant. The cursed-inert-active condition's `recurringSave` field
// declares { ability: 'WIS', onFail: 'consumeAction' }. The consumer
// calls tickRecurringSave at the bearer's start of turn; the planner
// rolls a WIS save against the curse caster's spell DC and, on failure
// inside an active encounter, consumes the bearer's action.

const PACK = loadStarterPack();

const buildCleric = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Curser',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level: 9, hitDiceRemaining: 9 }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
    preparedSpells: ['bestow-curse'],
  });

const buildLowWISTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Cursed Goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 6, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildHighWISTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Wisdom Saver',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'cleric', level: 9, hitDiceRemaining: 9 }],
    abilityScores: { STR: 10, DEX: 12, CON: 12, INT: 10, WIS: 20, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

// Seeds a campaign with caster + target, starts an encounter, casts
// bestow-curse(inactive-turn), commits all events. Returns the
// post-cast campaign + ids.
const setupCursed = (target: Character, seed: number) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const cleric = buildCleric();
  let campaign: Campaign = engine.createCampaign({ name: `inert-${seed}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [cleric.id, target.id] });
  campaign = commit(campaign, enc.events);
  campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
  campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: enc.encounterId }).events);
  campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);

  const castEvents = engine.plan.castSpell(campaign.state, {
    characterId: cleric.id,
    spellId: 'bestow-curse',
    slotLevel: 3,
    targetIds: [target.id],
    casterChoice: { kind: 'variant', value: 'inactive-turn' },
  }).events;
  return { engine, campaign: commit(campaign, castEvents), castEvents, cleric, target };
};

const findRolledSave = (events: ReadonlyArray<unknown>): SaveRolledEvent | undefined =>
  events.find(
    (e): e is SaveRolledEvent =>
      typeof e === 'object' && e !== null && (e as { type?: string }).type === 'SaveRolled',
  );

const findConsumed = (
  events: ReadonlyArray<unknown>,
): ActionEconomyConsumedEvent | undefined =>
  events.find(
    (e): e is ActionEconomyConsumedEvent =>
      typeof e === 'object'
      && e !== null
      && (e as { type?: string }).type === 'ActionEconomyConsumed',
  );

describe('engine.plan.tickRecurringSave (Bestow Curse inactive-turn)', () => {
  it('emits a SaveRolled event when ticked on a cursed combatant', () => {
    // Try seeds until the bestow-curse save fails (so cursed-inert lands).
    for (let seed = 1; seed < 100; seed += 1) {
      const { engine, campaign, castEvents, target } = setupCursed(buildLowWISTarget(), seed);
      const conditionApplied = castEvents.find((e) => e.type === 'ConditionApplied');
      if (conditionApplied === undefined) continue;

      const tickEvents = engine.plan.tickRecurringSave(campaign.state, {
        targetId: target.id,
        conditionId: 'cursed-inert-active',
      }).events;
      const save = findRolledSave(tickEvents);
      expect(save).toBeDefined();
      expect(save!.ability).toBe('WIS');
      return;
    }
    throw new Error('no seed produced a cursed-inert application');
  });

  it("consumes the bearer's action on a failed recurring save", () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const { engine, campaign, castEvents, target } = setupCursed(buildLowWISTarget(), seed);
      const conditionApplied = castEvents.find((e) => e.type === 'ConditionApplied');
      if (conditionApplied === undefined) continue;

      const tickEvents = engine.plan.tickRecurringSave(campaign.state, {
        targetId: target.id,
        conditionId: 'cursed-inert-active',
      }).events;
      const save = findRolledSave(tickEvents);
      if (save?.success !== false) continue;

      const consumed = findConsumed(tickEvents);
      expect(consumed).toBeDefined();
      expect(consumed!.kind).toBe('action');
      expect(consumed!.combatantId).toBe(target.id);
      expect(consumed!.causedByEventId).toBe(save!.id);
      return;
    }
    throw new Error('no seed produced a failed recurring save');
  });

  it('does NOT consume an action on a successful recurring save', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const { engine, campaign, castEvents, target } = setupCursed(buildHighWISTarget(), seed);
      const conditionApplied = castEvents.find((e) => e.type === 'ConditionApplied');
      if (conditionApplied === undefined) continue;

      const tickEvents = engine.plan.tickRecurringSave(campaign.state, {
        targetId: target.id,
        conditionId: 'cursed-inert-active',
      }).events;
      const save = findRolledSave(tickEvents);
      if (save?.success !== true) continue;

      expect(findConsumed(tickEvents)).toBeUndefined();
      return;
    }
    throw new Error('no seed produced a successful recurring save');
  });

  it('throws when the target does not have the named condition', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const target = buildLowWISTarget();
    let campaign: Campaign = engine.createCampaign({ name: 'no-condition' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.tickRecurringSave(campaign.state, {
        targetId: target.id,
        conditionId: 'cursed-inert-active',
      }),
    ).toThrow(/does not have condition/);
  });

  it('throws when the named condition has no recurringSave metadata', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    const cleric = buildCleric();
    const target = buildLowWISTarget();
    let campaign: Campaign = engine.createCampaign({ name: 'no-recurring' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    // Apply a non-recurringSave condition (use prone — RAW with empty
    // recurringSave) and try to tick it.
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: target.id,
        conditionId: 'prone',
      },
    ]);
    expect(() =>
      engine.plan.tickRecurringSave(campaign.state, {
        targetId: target.id,
        conditionId: 'prone',
      }),
    ).toThrow(/no recurringSave metadata/);
  });
});
