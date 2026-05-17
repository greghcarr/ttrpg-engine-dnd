// Slice 135: remote sensor primitive + Clairvoyance dedicated planner.
// Verifies the place / switch / cleanup lifecycle:
//   - planClairvoyance emits cast + slot + concentration + sensor place
//   - planSwitchSensorMode emits action + RemoteSensorModeChanged
//   - planRemoveSensor emits RemoteSensorRemoved
//   - Concentration drop sweeps the sensor (clearConcentrationEffect)

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  RemoteSensorPlacedEvent,
  RemoteSensorModeChangedEvent,
  RemoteSensorRemovedEvent,
} from '../../../src/schemas/events/sensors.js';
import type {
  ConcentrationStartedEvent,
  ConcentrationBrokenEvent,
} from '../../../src/schemas/events/concentration.js';
import type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../../src/schemas/events/spellcasting.js';

const PACK = loadStarterPack();

const buildWizard = (preparedSpells: string[] = ['clairvoyance']): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Diviner',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
    preparedSpells,
  });

const seedCampaign = (wizard: Character): { campaign: Campaign; engine: ReturnType<typeof createEngine> } => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
  let campaign: Campaign = engine.createCampaign({ name: 'clairvoyance' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
  ]);
  return { campaign, engine };
};

describe('engine.plan.clairvoyance', () => {
  it('emits SpellCastDeclared + slot + concentration + sensor place; sensor lives in state.sensors', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const result = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: "Lord Westra's study",
      mode: 'sight',
    });
    const types = result.events.map((e) => e.type);
    expect(types).toEqual([
      'SpellCastDeclared',
      'SpellSlotConsumed',
      'ConcentrationStarted',
      'RemoteSensorPlaced',
    ]);
    const placed = result.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    );
    expect(placed).toBeDefined();
    expect(placed!.casterId).toBe(wizard.id);
    expect(placed!.sourceSpellId).toBe('clairvoyance');
    expect(placed!.mode).toBe('sight');
    expect(placed!.location).toBe("Lord Westra's study");

    // Commit and verify the sensor lands in state.
    const after = commit(campaign, result.events);
    expect(after.state.sensors[placed!.sensorId]).toBeDefined();
    expect(after.state.sensors[placed!.sensorId]!.mode).toBe('sight');
  });

  it('sensor is linked to the concentration EffectInstance (sourceEffectInstanceId matches)', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const result = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'the throne room',
      mode: 'hearing',
    });
    const started = result.events.find(
      (e): e is ConcentrationStartedEvent => e.type === 'ConcentrationStarted',
    );
    const placed = result.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    );
    expect(started).toBeDefined();
    expect(placed).toBeDefined();
    expect(placed!.sourceEffectInstanceId).toBe(started!.effectInstanceId);
  });

  it('higher-level slot is honored on the SpellSlotConsumed', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const result = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'somewhere',
      mode: 'sight',
      slotLevel: 5,
    });
    const slot = result.events.find(
      (e): e is SpellSlotConsumedEvent => e.type === 'SpellSlotConsumed',
    );
    expect(slot!.slotLevel).toBe(5);
  });

  it('rejects slotLevel < 3', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    expect(() =>
      engine.plan.clairvoyance(campaign.state, {
        casterId: wizard.id,
        location: 'somewhere',
        mode: 'sight',
        slotLevel: 2,
      }),
    ).toThrow(/3rd-level/);
  });

  it('rejects when the caster does not know Clairvoyance', () => {
    const wizard = buildWizard([]);
    const { campaign, engine } = seedCampaign(wizard);
    expect(() =>
      engine.plan.clairvoyance(campaign.state, {
        casterId: wizard.id,
        location: 'somewhere',
        mode: 'sight',
      }),
    ).toThrow(/Clairvoyance/);
  });

  it('casting a second Clairvoyance breaks the prior concentration (sensor cleaned up)', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const first = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'the bandit camp',
      mode: 'sight',
    });
    const placedFirst = first.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    let afterFirst = commit(campaign, first.events);
    expect(afterFirst.state.sensors[placedFirst.sensorId]).toBeDefined();

    const second = engine.plan.clairvoyance(afterFirst.state, {
      casterId: wizard.id,
      location: 'the throne room',
      mode: 'hearing',
    });
    const types = second.events.map((e) => e.type);
    expect(types).toContain('ConcentrationBroken');
    const broken = second.events.find(
      (e): e is ConcentrationBrokenEvent => e.type === 'ConcentrationBroken',
    );
    expect(broken!.reason).toBe('newConcentrationSpell');
    // After committing the broken + new started events, the old
    // sensor is gone and a fresh one is placed.
    afterFirst = commit(afterFirst, second.events);
    expect(afterFirst.state.sensors[placedFirst.sensorId]).toBeUndefined();
    const placedSecond = second.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    expect(afterFirst.state.sensors[placedSecond.sensorId]).toBeDefined();
    expect(afterFirst.state.sensors[placedSecond.sensorId]!.mode).toBe('hearing');
  });
});

describe('engine.plan.switchSensorMode', () => {
  it('toggles sight → hearing via RemoteSensorModeChanged', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const placeResult = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'the courtyard',
      mode: 'sight',
    });
    const placed = placeResult.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    let after = commit(campaign, placeResult.events);

    const switched = engine.plan.switchSensorMode(after.state, {
      casterId: wizard.id,
      sensorId: placed.sensorId,
      mode: 'hearing',
    });
    const changed = switched.events.find(
      (e): e is RemoteSensorModeChangedEvent => e.type === 'RemoteSensorModeChanged',
    );
    expect(changed).toBeDefined();
    expect(changed!.mode).toBe('hearing');
    after = commit(after, switched.events);
    expect(after.state.sensors[placed.sensorId]!.mode).toBe('hearing');
  });

  it('rejects a sensor owned by a different caster', () => {
    const wizard = buildWizard();
    const other = buildWizard();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    let campaign: Campaign = engine.createCampaign({ name: 'two-wizards' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: other } satisfies CharacterCreatedEvent,
    ]);
    const placeResult = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'spied location',
      mode: 'sight',
    });
    const placed = placeResult.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    const after = commit(campaign, placeResult.events);

    expect(() =>
      engine.plan.switchSensorMode(after.state, {
        casterId: other.id, // not the original caster
        sensorId: placed.sensorId,
        mode: 'hearing',
      }),
    ).toThrow(/not owned/);
  });

  it('rejects switching to the same mode the sensor already has', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const placeResult = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'here',
      mode: 'sight',
    });
    const placed = placeResult.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    const after = commit(campaign, placeResult.events);

    expect(() =>
      engine.plan.switchSensorMode(after.state, {
        casterId: wizard.id,
        sensorId: placed.sensorId,
        mode: 'sight',
      }),
    ).toThrow(/already in sight mode/);
  });
});

describe('engine.plan.removeSensor', () => {
  it('emits RemoteSensorRemoved with the supplied reason; sensor is gone from state', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const placeResult = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'here',
      mode: 'sight',
    });
    const placed = placeResult.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    let after = commit(campaign, placeResult.events);

    const removeResult = engine.plan.removeSensor(after.state, {
      sensorId: placed.sensorId,
    });
    const removed = removeResult.events.find(
      (e): e is RemoteSensorRemovedEvent => e.type === 'RemoteSensorRemoved',
    );
    expect(removed).toBeDefined();
    expect(removed!.reason).toBe('casterAction');
    after = commit(after, removeResult.events);
    expect(after.state.sensors[placed.sensorId]).toBeUndefined();
  });
});

describe('concentration-drop cleanup', () => {
  it('breaking concentration on Clairvoyance sweeps the linked sensor', () => {
    // Drive the concentration drop by casting another concentration
    // spell. The first cast's sensor should disappear via clear
    // ConcentrationEffect's slice-135 sensor sweep, even though no
    // explicit RemoteSensorRemoved event fires.
    const wizard = buildWizard(['clairvoyance', 'hold-person']);
    const { campaign, engine } = seedCampaign(wizard);
    const first = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'spied location',
      mode: 'sight',
    });
    const placed = first.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    const afterPlace = commit(campaign, first.events);
    expect(afterPlace.state.sensors[placed.sensorId]).toBeDefined();

    // Recasting Clairvoyance breaks prior concentration. The reducer
    // for ConcentrationBroken calls clearConcentrationEffect, which
    // sweeps the sensor.
    const second = engine.plan.clairvoyance(afterPlace.state, {
      casterId: wizard.id,
      location: 'new location',
      mode: 'hearing',
    });
    const afterSecond = commit(afterPlace, second.events);
    expect(afterSecond.state.sensors[placed.sensorId]).toBeUndefined();
  });
});
