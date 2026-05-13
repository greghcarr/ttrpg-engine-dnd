import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import { formatTranscript } from '../transcript.js';

describe('golden: save + ability check sequences', () => {
  it('a fighter rolls a save, then a skill check, replays identically', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(99) });
    const fighter = buildFighter({ name: 'Alyx', STR: 18, CON: 14, DEX: 12 });
    let campaign = engine.createCampaign({ name: 'check-scenario' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: fighter,
      } satisfies CharacterCreatedEvent,
    ]);

    campaign = commit(
      campaign,
      engine.plan.save(campaign.state, {
        characterId: fighter.id,
        ability: 'CON',
        dc: 12,
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.abilityCheck(campaign.state, {
        characterId: fighter.id,
        ability: 'STR',
        skill: 'athletics',
        dc: 15,
      }).events,
    );

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));

    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Fighter rolls a CON save then an Athletics check',
      }),
    ).toMatchFileSnapshot('./transcripts/s4-checks.transcript.md');
  });
});
