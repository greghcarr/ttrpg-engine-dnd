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
import type { ConditionRemovedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests engine.plan.tickRecurringSave via Hold Person's
// 'held-paralyzed-active' condition. The condition declares
// recurringSave { ability: 'WIS', trigger: 'turnEnd',
// onSuccess: 'removeCondition' }. Consumer calls tickRecurringSave at
// the end of the bearer's turn while the spell holds; on a successful
// save the planner emits ConditionRemoved (the spell ends on the
// target). Failure leaves the condition in place.

const PACK = loadStarterPack();

const buildCleric = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Holder',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level: 9, hitDiceRemaining: 9 }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
    preparedSpells: ['hold-person'],
  });

const buildLowWISTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Held Goblin',
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

// Seeds a campaign, casts hold-person, commits everything, returns
// the post-cast state. Caller filters seeds to those where the cast
// landed (target failed the initial save).
const setupHeld = (target: Character, seed: number) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const cleric = buildCleric();
  let campaign: Campaign = engine.createCampaign({ name: `held-${seed}` });
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
    spellId: 'hold-person',
    slotLevel: 2,
    targetIds: [target.id],
  }).events;
  return { engine, campaign: commit(campaign, castEvents), castEvents, cleric, target };
};

const findRolledSave = (events: ReadonlyArray<unknown>): SaveRolledEvent | undefined =>
  events.find(
    (e): e is SaveRolledEvent =>
      typeof e === 'object' && e !== null && (e as { type?: string }).type === 'SaveRolled',
  );

const findRemoved = (events: ReadonlyArray<unknown>): ConditionRemovedEvent | undefined =>
  events.find(
    (e): e is ConditionRemovedEvent =>
      typeof e === 'object' && e !== null && (e as { type?: string }).type === 'ConditionRemoved',
  );

describe('engine.plan.tickRecurringSave (Hold Person, onSuccess removeCondition)', () => {
  it('removes the condition on a successful recurring save', () => {
    // Try seeds where the initial cast lands AND a subsequent tick
    // succeeds (target gets out).
    for (let seed = 1; seed < 300; seed += 1) {
      const { engine, campaign, castEvents, target } = setupHeld(buildHighWISTarget(), seed);
      const conditionApplied = castEvents.find((e) => e.type === 'ConditionApplied');
      if (conditionApplied === undefined) continue;

      const tickEvents = engine.plan.tickRecurringSave(campaign.state, {
        targetId: target.id,
        conditionId: 'held-paralyzed-active',
      }).events;
      const save = findRolledSave(tickEvents);
      if (save?.success !== true) continue;

      const removed = findRemoved(tickEvents);
      expect(removed).toBeDefined();
      expect(removed!.conditionId).toBe('held-paralyzed-active');
      expect(removed!.targetId).toBe(target.id);
      expect(removed!.causedByEventId).toBe(save!.id);
      return;
    }
    throw new Error('no seed produced cast-landed + successful recurring save');
  });

  it('does NOT remove the condition on a failed recurring save', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const { engine, campaign, castEvents, target } = setupHeld(buildLowWISTarget(), seed);
      const conditionApplied = castEvents.find((e) => e.type === 'ConditionApplied');
      if (conditionApplied === undefined) continue;

      const tickEvents = engine.plan.tickRecurringSave(campaign.state, {
        targetId: target.id,
        conditionId: 'held-paralyzed-active',
      }).events;
      const save = findRolledSave(tickEvents);
      if (save?.success !== false) continue;

      expect(findRemoved(tickEvents)).toBeUndefined();
      return;
    }
    throw new Error('no seed produced cast-landed + failed recurring save');
  });

  it('does NOT consume an action on the failed save (Hold Person has no onFail)', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const { engine, campaign, castEvents, target } = setupHeld(buildLowWISTarget(), seed);
      const conditionApplied = castEvents.find((e) => e.type === 'ConditionApplied');
      if (conditionApplied === undefined) continue;

      const tickEvents = engine.plan.tickRecurringSave(campaign.state, {
        targetId: target.id,
        conditionId: 'held-paralyzed-active',
      }).events;
      const save = findRolledSave(tickEvents);
      if (save?.success !== false) continue;

      const consumed = tickEvents.find(
        (e) =>
          typeof e === 'object' && e !== null && (e as { type?: string }).type === 'ActionEconomyConsumed',
      );
      expect(consumed).toBeUndefined();
      return;
    }
    throw new Error('no seed produced cast-landed + failed recurring save');
  });
});
