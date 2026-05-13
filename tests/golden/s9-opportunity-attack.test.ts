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
import { newEncounterId } from '../../src/ids.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnEndedEvent,
  TurnStartedEvent,
  RoundEndedEvent,
} from '../../src/schemas/events/encounter.js';

describe('golden: opportunity attack as a reaction', () => {
  it('reactor strikes when the active combatant tries to flee, second OA same round throws, fresh round resets', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(42) });
    const fleeingLongsword = makeItemInstance('longsword');
    const reactorLongsword = makeItemInstance('longsword');
    const armor = makeItemInstance('leather-armor');

    const fleeing = buildFighter({
      name: 'Goblin Scout',
      hpMax: 14,
      hpCurrent: 14,
      STR: 12,
      DEX: 16,
      armorInstanceId: armor.id,
    });
    const reactor = buildFighter({
      name: 'Sir Borin',
      level: 3,
      hpMax: 26,
      hpCurrent: 26,
      STR: 18,
    });

    let campaign = engine.createCampaign({ name: 'opportunity-attack' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: fleeingLongsword },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: reactorLongsword },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: armor },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fleeing } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: reactor } satisfies CharacterCreatedEvent,
    ]);

    const encounterId = newEncounterId();
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterCreated',
        encounterId,
        name: 'Goblin Tries to Flee',
        combatantIds: [fleeing.id, reactor.id],
      } satisfies EncounterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: fleeing.id, d20: 17, modifier: 3, total: 20 },
          { combatantId: reactor.id, d20: 12, modifier: 1, total: 13 },
        ],
      } satisfies InitiativeRolledEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterStarted',
        encounterId,
      } satisfies EncounterStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: fleeing.id,
        round: 1,
      } satisfies TurnStartedEvent,
    ]);

    // The Goblin Scout tries to leave Sir Borin's reach. Sir Borin reacts with an opportunity attack.
    campaign = commit(
      campaign,
      engine.plan.opportunityAttack(campaign.state, {
        reactorId: reactor.id,
        targetId: fleeing.id,
        weaponInstanceId: reactorLongsword.id,
      }).events,
    );

    // The reactor cannot react again this round.
    expect(() =>
      engine.plan.opportunityAttack(campaign.state, {
        reactorId: reactor.id,
        targetId: fleeing.id,
        weaponInstanceId: reactorLongsword.id,
      }),
    ).toThrow(/already used their reaction/);

    // Advance turn to Sir Borin, end his turn, end the round to refresh reactions.
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnEnded',
        encounterId,
        combatantId: fleeing.id,
        round: 1,
      } satisfies TurnEndedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: reactor.id,
        round: 1,
      } satisfies TurnStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnEnded',
        encounterId,
        combatantId: reactor.id,
        round: 1,
      } satisfies TurnEndedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'RoundEnded',
        encounterId,
        round: 1,
      } satisfies RoundEndedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: fleeing.id,
        round: 2,
      } satisfies TurnStartedEvent,
    ]);

    // Round 2: Goblin tries to flee again. Reaction is fresh.
    campaign = commit(
      campaign,
      engine.plan.opportunityAttack(campaign.state, {
        reactorId: reactor.id,
        targetId: fleeing.id,
        weaponInstanceId: reactorLongsword.id,
      }).events,
    );

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Opportunity attack: once per round, refreshes at round boundary',
      }),
    ).toMatchFileSnapshot('./transcripts/s9-opportunity-attack.transcript.rtf');
  });
});
