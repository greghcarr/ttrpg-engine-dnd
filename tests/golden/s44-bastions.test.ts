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
  BastionFoundedEvent,
  BastionFacilityAddedEvent,
  BastionHirelingAddedEvent,
  BastionTurnTakenEvent,
  BastionDamagedEvent,
  BastionLevelChangedEvent,
} from '../../src/schemas/events/bastion.js';

describe('golden: bastions (Slice 44)', () => {
  it('founds a bastion, adds facilities and hirelings, takes a turn, levels up', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(44) });
    const alyx = buildFighter({ name: 'Alyx', level: 5 });
    const bastionId = newJournalEntryId();
    const armoryId = newJournalEntryId();
    const libraryId = newJournalEntryId();
    const garrisonChief = newJournalEntryId();

    let campaign = engine.createCampaign({ name: 's44' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'BastionFounded',
        bastionId,
        name: 'Stoneheart Keep',
        ownerCharacterId: alyx.id,
        level: 1,
        hpMax: 80,
      } satisfies BastionFoundedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'BastionFacilityAdded',
        bastionId,
        facilityId: armoryId,
        name: 'Armory',
        kind: 'special',
        space: 'roomy',
        description: 'Stockpiles weapons and armor for the bastion defenders.',
      } satisfies BastionFacilityAddedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'BastionFacilityAdded',
        bastionId,
        facilityId: libraryId,
        name: 'Library',
        kind: 'basic',
        space: 'cramped',
      } satisfies BastionFacilityAddedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'BastionHirelingAdded',
        bastionId,
        hirelingId: garrisonChief,
        name: 'Sergeant Halric',
        role: 'Captain of the Guard',
      } satisfies BastionHirelingAddedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'BastionTurnTaken',
        bastionId,
        order: 'trade',
        treasuryDeltaGp: 50,
        summary: 'Sold smelted iron to the nearby village.',
      } satisfies BastionTurnTakenEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'BastionDamaged',
        bastionId,
        amount: 15,
        source: 'orcish raiding party',
      } satisfies BastionDamagedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'BastionLevelChanged',
        bastionId,
        fromLevel: 1,
        toLevel: 2,
      } satisfies BastionLevelChangedEvent,
    ]);

    const bastion = campaign.state.bastions[bastionId];
    expect(bastion).toBeDefined();
    expect(bastion!.level).toBe(2);
    expect(bastion!.facilities).toHaveLength(2);
    expect(bastion!.hirelings).toHaveLength(1);
    expect(bastion!.treasuryGp).toBe(50);
    expect(bastion!.hpCurrent).toBe(65);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 44: Stoneheart Keep',
      }),
    ).toMatchFileSnapshot('./transcripts/s44-bastions.transcript.md');
  });

  it('rejects a level-change that does not match the current level', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(44) });
    const alyx = buildFighter({ name: 'Alyx' });
    const bastionId = newJournalEntryId();
    let campaign = engine.createCampaign({ name: 'reject' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'BastionFounded',
        bastionId,
        name: 'Test',
        ownerCharacterId: alyx.id,
        level: 1,
        hpMax: 10,
      } satisfies BastionFoundedEvent,
    ]);
    expect(() =>
      commit(campaign, [
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'BastionLevelChanged',
          bastionId,
          fromLevel: 3,
          toLevel: 4,
        } satisfies BastionLevelChangedEvent,
      ]),
    ).toThrow(/level mismatch/);
  });
});
