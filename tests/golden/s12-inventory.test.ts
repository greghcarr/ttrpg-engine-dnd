import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import {
  TEST_PACK,
  TEST_CONTENT,
  buildFighter,
  eventId,
  isoTimestamp,
  makeItemInstance,
} from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

describe('golden: inventory mechanics', () => {
  it('equip armor, attune three items, fourth attunement throws, unattune frees a slot', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alyx = buildFighter({ name: 'Alyx' });
    const chain = makeItemInstance('chain-mail');
    const longsword = makeItemInstance('longsword');
    const potion1 = makeItemInstance('healing-potion');
    const potion2 = makeItemInstance('healing-potion');
    const potion3 = makeItemInstance('healing-potion');
    const potion4 = makeItemInstance('healing-potion');

    let campaign = engine.createCampaign({ name: 'inventory' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: chain },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion1 },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion2 },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion3 },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: potion4 },
    ]);

    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemEquipped',
        characterId: alyx.id,
        instanceId: chain.id,
        slot: 'armor',
      },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemEquipped',
        characterId: alyx.id,
        instanceId: longsword.id,
        slot: 'mainHand',
      },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemAttuned',
        characterId: alyx.id,
        instanceId: potion1.id,
      },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemAttuned',
        characterId: alyx.id,
        instanceId: potion2.id,
      },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemAttuned',
        characterId: alyx.id,
        instanceId: potion3.id,
      },
    ]);

    expect(campaign.state.characters[alyx.id]?.equipped.armor).toBe(chain.id);
    expect(campaign.state.characters[alyx.id]?.equipped.mainHand).toBe(longsword.id);
    expect(campaign.state.characters[alyx.id]?.equipped.attuned).toHaveLength(3);

    // Fourth attunement throws.
    expect(() =>
      engine.apply(campaign.state, {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemAttuned',
        characterId: alyx.id,
        instanceId: potion4.id,
      }),
    ).toThrow(/maximum of 3/);

    // Unattune one, then attune the fourth.
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemUnattuned',
        characterId: alyx.id,
        instanceId: potion2.id,
      },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemAttuned',
        characterId: alyx.id,
        instanceId: potion4.id,
      },
    ]);

    expect(campaign.state.itemInstances[potion2.id]?.attuned).toBe(false);
    expect(campaign.state.itemInstances[potion4.id]?.attuned).toBe(true);
    expect(campaign.state.characters[alyx.id]?.equipped.attuned).toHaveLength(3);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Equipping, attuning, hitting the 3-slot attunement limit',
      }),
    ).toMatchFileSnapshot('./transcripts/s12-inventory.transcript.rtf');
  });
});
