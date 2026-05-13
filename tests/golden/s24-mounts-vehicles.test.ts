import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import { newJournalEntryId } from '../../src/ids.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  MountedEvent,
  DismountedEvent,
  VehicleAcquiredEvent,
  VehicleBoardedEvent,
  VehicleDepartedEvent,
  VehicleDamagedEvent,
  VehicleRepairedEvent,
} from '../../src/schemas/events/mounts-vehicles.js';

describe('golden: mounts and vehicles (Slice 24)', () => {
  it('rider mounts a warhorse, dismounts; party boards a wagon, takes damage, repairs', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(24) });
    const alyx = buildFighter({ name: 'Alyx' });
    const borin = buildFighter({ name: 'Borin' });
    const warhorse = buildFighter({ name: 'Stride' });
    const wagonId = newJournalEntryId();

    let campaign = engine.createCampaign({ name: 's24' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: borin } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: warhorse } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'Mounted',
        riderId: alyx.id,
        mountId: warhorse.id,
      } satisfies MountedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'VehicleAcquired',
        vehicleId: wagonId,
        name: 'Supply Wagon',
        kind: 'land',
        speedFeet: 20,
        ac: 14,
        maxHp: 100,
        capacity: 4,
      } satisfies VehicleAcquiredEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'VehicleBoarded',
        vehicleId: wagonId,
        characterId: borin.id,
      } satisfies VehicleBoardedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'VehicleDamaged',
        vehicleId: wagonId,
        amount: 25,
        source: 'wolf pack ambush',
      } satisfies VehicleDamagedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'VehicleRepaired',
        vehicleId: wagonId,
        amount: 10,
      } satisfies VehicleRepairedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'VehicleDeparted',
        vehicleId: wagonId,
        characterId: borin.id,
      } satisfies VehicleDepartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'Dismounted',
        riderId: alyx.id,
        mountId: warhorse.id,
        voluntary: true,
      } satisfies DismountedEvent,
    ]);

    expect(campaign.state.characters[alyx.id]?.mountedOnId).toBeUndefined();
    expect(campaign.state.vehicles[wagonId]?.hp.current).toBe(85);
    expect(campaign.state.vehicles[wagonId]?.occupantIds).toEqual([]);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 24: Mounts and Vehicles',
      }),
    ).toMatchFileSnapshot('./transcripts/s24-mounts-vehicles.transcript.md');
  });

  it('refuses to board a vehicle at capacity', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(24) });
    const a = buildFighter({ name: 'A' });
    const b = buildFighter({ name: 'B' });
    const skiff = newJournalEntryId();
    let campaign = engine.createCampaign({ name: 'skiff' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'VehicleAcquired',
        vehicleId: skiff,
        name: 'Tiny Skiff',
        kind: 'water',
        speedFeet: 30,
        ac: 11,
        maxHp: 20,
        capacity: 1,
      } satisfies VehicleAcquiredEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'VehicleBoarded',
        vehicleId: skiff,
        characterId: a.id,
      } satisfies VehicleBoardedEvent,
    ]);
    expect(() =>
      commit(campaign, [
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'VehicleBoarded',
          vehicleId: skiff,
          characterId: b.id,
        } satisfies VehicleBoardedEvent,
      ]),
    ).toThrow(/at capacity/);
  });
});
