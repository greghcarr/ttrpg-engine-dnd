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
import { newPartyId } from '../../src/ids.js';
import { totalInCopper } from '../../src/schemas/runtime/currency.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  PartyCreatedEvent,
  PartyMembersChangedEvent,
  CurrencyAcquiredEvent,
  CurrencySpentEvent,
  ItemDepositedToPartyEvent,
  ItemWithdrawnFromPartyEvent,
} from '../../src/schemas/events/party.js';
import type { ItemAcquiredEvent } from '../../src/schemas/events/inventory.js';

describe('golden: party + treasure ledger (Slice 17)', () => {
  it('party forms, acquires gold, deposits loot, distributes spoils', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(7) });
    const alyx = buildFighter({ name: 'Alyx', hpMax: 30, hpCurrent: 30 });
    const borin = buildFighter({ name: 'Borin', hpMax: 30, hpCurrent: 30 });
    const cassia = buildFighter({ name: 'Cassia', hpMax: 30, hpCurrent: 30 });
    const longsword = makeItemInstance('longsword');
    const partyId = newPartyId();

    let campaign = engine.createCampaign({ name: 'treasure' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: borin } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cassia } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword } satisfies ItemAcquiredEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PartyCreated',
        partyId,
        name: 'The Bold Three',
        memberIds: [alyx.id, borin.id],
      } satisfies PartyCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PartyMembersChanged',
        partyId,
        added: [cassia.id],
        removed: [],
      } satisfies PartyMembersChangedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CurrencyAcquired',
        partyId,
        amounts: { cp: 0, sp: 5, ep: 0, gp: 120, pp: 2 },
        source: 'goblin hoard',
      } satisfies CurrencyAcquiredEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemDepositedToParty',
        partyId,
        itemInstanceId: longsword.id,
      } satisfies ItemDepositedToPartyEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CurrencySpent',
        partyId,
        amounts: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 },
        purpose: 'inn and supplies',
      } satisfies CurrencySpentEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemWithdrawnFromParty',
        partyId,
        itemInstanceId: longsword.id,
        recipientCharacterId: cassia.id,
      } satisfies ItemWithdrawnFromPartyEvent,
    ]);

    const party = campaign.state.parties[partyId];
    expect(party).toBeDefined();
    expect(party?.memberIds).toEqual([alyx.id, borin.id, cassia.id]);
    expect(party?.purse).toEqual({ cp: 0, sp: 5, ep: 0, gp: 70, pp: 2 });
    expect(party?.sharedInventory).toEqual([]);
    expect(campaign.state.characters[cassia.id]?.inventory).toContain(longsword.id);
    expect(totalInCopper(party!.purse)).toBe(0 + 50 + 0 + 7000 + 2000);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'A party forms, hauls loot, and divvies the spoils',
      }),
    ).toMatchFileSnapshot('./transcripts/s17-party-treasure.transcript.rtf');
  });

  it('rejects spending more than the purse holds', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const a = buildFighter({ name: 'Anyone' });
    const partyId = newPartyId();
    let campaign = engine.createCampaign({ name: 'broke' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PartyCreated',
        partyId,
        name: 'Broke',
        memberIds: [a.id],
      } satisfies PartyCreatedEvent,
    ]);
    expect(() =>
      commit(campaign, [
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'CurrencySpent',
          partyId,
          amounts: { cp: 0, sp: 0, ep: 0, gp: 1, pp: 0 },
        } satisfies CurrencySpentEvent,
      ]),
    ).toThrow(/Insufficient/);
  });
});
