import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

describe('golden: grapple, shove, hide (Slice 21)', () => {
  it('Fighter grapples a goblin, shoves another, then hides', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(21) });
    const alyx = buildFighter({ name: 'Alyx', STR: 18, DEX: 16, level: 5 });
    const grappleVictim = buildFighter({ name: 'Goblin Boss', STR: 12, level: 1 });
    const shoveVictim = buildFighter({ name: 'Goblin Cutter', STR: 8, level: 1 });

    let campaign = engine.createCampaign({ name: 's21' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: grappleVictim } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: shoveVictim } satisfies CharacterCreatedEvent,
    ]);

    campaign = commit(
      campaign,
      engine.plan.grapple(campaign.state, {
        attackerId: alyx.id,
        targetId: grappleVictim.id,
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.shove(campaign.state, {
        attackerId: alyx.id,
        targetId: shoveVictim.id,
        mode: 'prone',
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.hide(campaign.state, {
        characterId: alyx.id,
        dc: 10,
      }).events,
    );

    const grappled = campaign.state.characters[grappleVictim.id]?.appliedConditions.some(
      (c) => c.conditionId === 'grappled',
    );
    const proned = campaign.state.characters[shoveVictim.id]?.appliedConditions.some(
      (c) => c.conditionId === 'prone',
    );
    const invisible = campaign.state.characters[alyx.id]?.appliedConditions.some(
      (c) => c.conditionId === 'invisible',
    );

    expect(grappled).toBe(true);
    expect(proned).toBe(true);
    expect(invisible).toBe(true);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 21: Grapple, Shove, Hide',
      }),
    ).toMatchFileSnapshot('./transcripts/s21-contested.transcript.rtf');
  });
});
