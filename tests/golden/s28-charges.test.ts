import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp, makeItemInstance } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ItemAcquiredEvent } from '../../src/schemas/events/inventory.js';
import type {
  ItemChargeConsumedEvent,
  ItemRechargedEvent,
  SentientItemConflictEvent,
} from '../../src/schemas/events/charges.js';

describe('golden: magic item charges, recharge, sentient conflict (Slice 28)', () => {
  it('wand consumes charges, recharges at dawn; sentient sword opposes wielder', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(28) });
    const alyx = buildFighter({ name: 'Alyx' });
    const wand = makeItemInstance('longsword', {
      customName: 'Wand of Sparks',
      chargesRemaining: 7,
      maxCharges: 7,
    });
    const sentientSword = makeItemInstance('longsword', {
      customName: 'Vow-Breaker',
      sentient: { ego: 16, alignment: 'lawful evil', personality: 'jealous, possessive' },
    });

    let campaign = engine.createCampaign({ name: 's28' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: wand } satisfies ItemAcquiredEvent,
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sentientSword } satisfies ItemAcquiredEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemChargeConsumed',
        itemInstanceId: wand.id,
        amount: 3,
        byCharacterId: alyx.id,
        forEffect: 'Lightning Bolt',
      } satisfies ItemChargeConsumedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemChargeConsumed',
        itemInstanceId: wand.id,
        amount: 2,
        byCharacterId: alyx.id,
      } satisfies ItemChargeConsumedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemRecharged',
        itemInstanceId: wand.id,
        amount: 5,
        cadence: 'dawn',
      } satisfies ItemRechargedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'SentientItemConflict',
        itemInstanceId: sentientSword.id,
        wielderId: alyx.id,
        winner: 'item',
        description: 'compels Alyx to spare a defeated foe',
      } satisfies SentientItemConflictEvent,
    ]);

    expect(campaign.state.itemInstances[wand.id]?.chargesRemaining).toBe(7);
    expect(campaign.state.itemInstances[sentientSword.id]?.sentient?.ego).toBe(16);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 28: Magic Item Charges and Sentient Items',
      }),
    ).toMatchFileSnapshot('./transcripts/s28-charges.transcript.md');
  });

  it('refuses to consume more charges than remain', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(28) });
    const alyx = buildFighter({ name: 'Alyx' });
    const wand = makeItemInstance('longsword', { chargesRemaining: 1, maxCharges: 3 });
    let campaign = engine.createCampaign({ name: 's28-empty' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: wand } satisfies ItemAcquiredEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      commit(campaign, [
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'ItemChargeConsumed',
          itemInstanceId: wand.id,
          amount: 2,
          byCharacterId: alyx.id,
        } satisfies ItemChargeConsumedEvent,
      ]),
    ).toThrow(/charges/);
  });
});
