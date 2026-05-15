// Reducer tests for the summon system.
//
// - applyCompanionSummoned: creates a creature-kind Character with the
//   companion's stats and a summonSource pointer to its controller.
// - applyCompanionDismissed: removes the companion from state.
// - clearConcentrationEffect (when triggered via ConcentrationBroken):
//   auto-dismisses companions whose summonSource.effectInstanceId
//   matches the ending effect.

import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { newCharacterId, newEffectInstanceId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  CompanionSummonedEvent,
  CompanionDismissedEvent,
} from '../../../src/schemas/events/summons.js';
import type {
  ConcentrationStartedEvent,
  ConcentrationBrokenEvent,
} from '../../../src/schemas/events/concentration.js';

const seed = () => {
  const caster = buildFighter({ name: 'Casper' });
  const state = apply(emptyCampaignState(), {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: caster,
  } satisfies CharacterCreatedEvent);
  return { caster, state };
};

describe('CompanionSummoned reducer', () => {
  it('creates a creature-kind Character with the summon stats and a summonSource pointer', () => {
    const { caster, state } = seed();
    const companionId = newCharacterId();
    const next = apply(state, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CompanionSummoned',
      companionId,
      controllerId: caster.id,
      spellId: 'find-familiar',
      slotLevel: 1,
      name: 'Familiar',
      ac: 13,
      hp: 10,
      speedFeet: 30,
    } satisfies CompanionSummonedEvent);
    const companion = next.characters[companionId];
    expect(companion).toBeDefined();
    expect(companion!.kind).toBe('creature');
    expect(companion!.name).toBe('Familiar');
    expect(companion!.hp.max).toBe(10);
    expect(companion!.hp.current).toBe(10);
    expect(companion!.armorClass).toBe(13);
    expect(companion!.speedFeet).toBe(30);
    expect(companion!.summonSource?.controllerId).toBe(caster.id);
    expect(companion!.summonSource?.spellId).toBe('find-familiar');
    expect(companion!.summonSource?.slotLevel).toBe(1);
    // No concentration tie-in: effectInstanceId should be absent.
    expect(companion!.summonSource?.effectInstanceId).toBeUndefined();
  });

  it('persists effectInstanceId on the companion when the summon is concentration-bound', () => {
    const { caster, state } = seed();
    const companionId = newCharacterId();
    const effectId = newEffectInstanceId();
    const next = apply(state, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CompanionSummoned',
      companionId,
      controllerId: caster.id,
      spellId: 'summon-beast',
      slotLevel: 2,
      name: 'Bestial Spirit',
      ac: 11,
      hp: 30,
      speedFeet: 30,
      effectInstanceId: effectId,
    } satisfies CompanionSummonedEvent);
    expect(next.characters[companionId]!.summonSource?.effectInstanceId).toBe(effectId);
  });

  it('rejects a second summon with the same companionId', () => {
    const { caster, state } = seed();
    const companionId = newCharacterId();
    const summoned: CompanionSummonedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CompanionSummoned',
      companionId,
      controllerId: caster.id,
      spellId: 'find-familiar',
      slotLevel: 1,
      name: 'Familiar',
      ac: 13,
      hp: 10,
      speedFeet: 30,
    };
    const once = apply(state, summoned);
    expect(() => apply(once, summoned)).toThrow(/already exists/);
  });
});

describe('CompanionDismissed reducer', () => {
  it('removes the companion from state.characters', () => {
    const { caster, state } = seed();
    const companionId = newCharacterId();
    let next = apply(state, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CompanionSummoned',
      companionId,
      controllerId: caster.id,
      spellId: 'find-familiar',
      slotLevel: 1,
      name: 'Familiar',
      ac: 13,
      hp: 10,
      speedFeet: 30,
    } satisfies CompanionSummonedEvent);
    expect(next.characters[companionId]).toBeDefined();
    next = apply(next, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CompanionDismissed',
      companionId,
    } satisfies CompanionDismissedEvent);
    expect(next.characters[companionId]).toBeUndefined();
  });

  it('is tolerant of dismissing a companion that no longer exists', () => {
    const { state } = seed();
    const ghostId = newCharacterId();
    const next = apply(state, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CompanionDismissed',
      companionId: ghostId,
    } satisfies CompanionDismissedEvent);
    expect(next.characters[ghostId]).toBeUndefined();
  });
});

describe('concentration auto-dismiss', () => {
  it('removes companions tied to the ending concentration effect', () => {
    const { caster, state } = seed();
    const companionId = newCharacterId();
    const effectId = newEffectInstanceId();
    // Start concentration on the caster (so clearConcentrationEffect
    // has an effect to look up), then summon a companion bound to it.
    const next = applyAll(state, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConcentrationStarted',
        effectInstanceId: effectId,
        casterId: caster.id,
        spellId: 'summon-beast',
        targetIds: [],
        conditionsApplied: [],
        slotLevel: 2,
      } satisfies ConcentrationStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CompanionSummoned',
        companionId,
        controllerId: caster.id,
        spellId: 'summon-beast',
        slotLevel: 2,
        name: 'Bestial Spirit',
        ac: 11,
        hp: 30,
        speedFeet: 30,
        effectInstanceId: effectId,
      } satisfies CompanionSummonedEvent,
    ]);
    expect(next.characters[companionId]).toBeDefined();
    const after = apply(next, {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConcentrationBroken',
      effectInstanceId: effectId,
      casterId: caster.id,
      reason: 'failedSave',
    } satisfies ConcentrationBrokenEvent);
    expect(after.characters[companionId]).toBeUndefined();
  });
});
