import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp, makeItemInstance } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { DowntimeActivityResolvedEvent } from '../../src/schemas/events/downtime.js';
import type { ItemAcquiredEvent } from '../../src/schemas/events/inventory.js';

describe('golden: downtime, crafting, training (Slice 27)', () => {
  it('three downtime activities: crafting, training, recuperating', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(27) });
    const alyx = buildFighter({ name: 'Alyx' });
    const borin = buildFighter({ name: 'Borin' });
    const mira = buildFighter({ name: 'Mira' });
    const craftedSword = makeItemInstance('longsword', { customName: 'Alyx-forged Longsword' });

    let campaign = engine.createCampaign({ name: 's27' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: borin } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: mira } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: craftedSword } satisfies ItemAcquiredEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DowntimeActivityResolved',
        characterId: alyx.id,
        kind: 'crafting',
        days: 10,
        outcome: 'success',
        summary: 'Forged a longsword from raw ingots.',
        producedItemDefinitionId: 'longsword',
      } satisfies DowntimeActivityResolvedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DowntimeActivityResolved',
        characterId: borin.id,
        kind: 'training',
        days: 30,
        outcome: 'success',
        summary: 'Studied carpentry with a master in town.',
        toolProficiencyGained: 'carpenters-tools',
      } satisfies DowntimeActivityResolvedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DowntimeActivityResolved',
        characterId: mira.id,
        kind: 'research',
        days: 7,
        outcome: 'partial',
        summary: 'Spent the week in the wizards\' library; found three of five references.',
      } satisfies DowntimeActivityResolvedEvent,
    ]);

    expect(campaign.state.downtimeLog).toHaveLength(3);
    expect(campaign.state.toolProficienciesByCharacter[borin.id]).toEqual(['carpenters-tools']);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 27: Downtime, Crafting, Training',
      }),
    ).toMatchFileSnapshot('./transcripts/s27-downtime.transcript.md');
  });
});
