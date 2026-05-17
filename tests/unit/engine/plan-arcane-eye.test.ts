// Slice 138: Arcane Eye extends the slice-135 Sensor primitive
// with mobility + darkvision. New `planArcaneEye` places a
// mobile sensor; `planMoveSensor` updates its location on the
// caster's bonus action. Clairvoyance / Scrying sensors stay
// immobile and reject moves.

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
  RemoteSensorMovedEvent,
} from '../../../src/schemas/events/sensors.js';

const PACK = loadStarterPack();

const buildWizard = (preparedSpells: string[] = ['arcane-eye', 'clairvoyance']): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Diviner',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 7, hitDiceRemaining: 7 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 38, max: 38, temp: 0 },
    featsTaken: [],
    preparedSpells,
  });

const seedCampaign = (wizard: Character): { campaign: Campaign; engine: ReturnType<typeof createEngine> } => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
  let campaign: Campaign = engine.createCampaign({ name: 'arcane-eye' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
  ]);
  return { campaign, engine };
};

describe('engine.plan.arcaneEye', () => {
  it('emits the cast chain and places a mobile sensor with darkvision 30', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const { events } = engine.plan.arcaneEye(campaign.state, {
      casterId: wizard.id,
      location: '10 ft up, north of the caster',
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'SpellCastDeclared',
      'SpellSlotConsumed',
      'ConcentrationStarted',
      'RemoteSensorPlaced',
    ]);
    const placed = events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    expect(placed.mobile).toBe(true);
    expect(placed.darkvisionRange).toBe(30);
    expect(placed.sourceSpellId).toBe('arcane-eye');
    expect(placed.label).toBe('Arcane Eye');
    const after = commit(campaign, events);
    const stored = after.state.sensors[placed.sensorId]!;
    expect(stored.mobile).toBe(true);
    expect(stored.darkvisionRange).toBe(30);
  });

  it('rejects slotLevel < 4', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    expect(() =>
      engine.plan.arcaneEye(campaign.state, {
        casterId: wizard.id,
        location: 'here',
        slotLevel: 3,
      }),
    ).toThrow(/4th-level/);
  });

  it('rejects when caster does not know arcane-eye', () => {
    const wizard = buildWizard([]);
    const { campaign, engine } = seedCampaign(wizard);
    expect(() =>
      engine.plan.arcaneEye(campaign.state, {
        casterId: wizard.id,
        location: 'here',
      }),
    ).toThrow(/Arcane Eye/);
  });
});

describe('engine.plan.moveSensor', () => {
  it('moves an Arcane Eye sensor; emits RemoteSensorMoved and updates state.sensors location', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const place = engine.plan.arcaneEye(campaign.state, {
      casterId: wizard.id,
      location: 'starting room',
    });
    const placed = place.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    let after = commit(campaign, place.events);

    const move = engine.plan.moveSensor(after.state, {
      casterId: wizard.id,
      sensorId: placed.sensorId,
      toLocation: 'down the hallway, 30 ft north',
    });
    const moved = move.events.find(
      (e): e is RemoteSensorMovedEvent => e.type === 'RemoteSensorMoved',
    );
    expect(moved).toBeDefined();
    expect(moved!.fromLocation).toBe('starting room');
    expect(moved!.toLocation).toBe('down the hallway, 30 ft north');
    after = commit(after, move.events);
    expect(after.state.sensors[placed.sensorId]!.location).toBe('down the hallway, 30 ft north');
  });

  it('rejects moving an immobile sensor (Clairvoyance)', () => {
    // Clairvoyance creates an immobile sensor; planMoveSensor must
    // reject it even though the caster owns it.
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const place = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'the study',
      mode: 'sight',
    });
    const placed = place.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    const after = commit(campaign, place.events);
    expect(() =>
      engine.plan.moveSensor(after.state, {
        casterId: wizard.id,
        sensorId: placed.sensorId,
        toLocation: 'somewhere else',
      }),
    ).toThrow(/not mobile/);
  });

  it('rejects move by a non-caster (sensor owner mismatch)', () => {
    const wizard = buildWizard();
    const other = buildWizard();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    let campaign: Campaign = engine.createCampaign({ name: 'mover-mismatch' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: other } satisfies CharacterCreatedEvent,
    ]);
    const place = engine.plan.arcaneEye(campaign.state, {
      casterId: wizard.id,
      location: 'here',
    });
    const placed = place.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    const after = commit(campaign, place.events);
    expect(() =>
      engine.plan.moveSensor(after.state, {
        casterId: other.id, // wrong caster
        sensorId: placed.sensorId,
        toLocation: 'somewhere',
      }),
    ).toThrow(/not owned/);
  });

  it('rejects moving the sensor to the same location it is already at', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const place = engine.plan.arcaneEye(campaign.state, {
      casterId: wizard.id,
      location: 'here',
    });
    const placed = place.events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    const after = commit(campaign, place.events);
    expect(() =>
      engine.plan.moveSensor(after.state, {
        casterId: wizard.id,
        sensorId: placed.sensorId,
        toLocation: 'here',
      }),
    ).toThrow(/already at/);
  });
});

describe('Clairvoyance / Scrying sensors retain mobile: false (regression)', () => {
  it('clairvoyance places an immobile sensor with no darkvision range', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const { events } = engine.plan.clairvoyance(campaign.state, {
      casterId: wizard.id,
      location: 'the throne room',
      mode: 'sight',
    });
    const placed = events.find(
      (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
    )!;
    expect(placed.mobile).toBe(false);
    expect(placed.darkvisionRange).toBeUndefined();
  });
});
