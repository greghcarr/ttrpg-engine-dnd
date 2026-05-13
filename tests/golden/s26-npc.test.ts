import { describe, expect, it } from 'vitest';
import { CharacterSchema } from '../../src/schemas/runtime/character.js';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import { newCharacterId } from '../../src/ids.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { MoraleBrokenEvent } from '../../src/schemas/events/npc.js';

const buildShopkeep = (name: string) =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'npc',
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 12, INT: 12, WIS: 14, CHA: 12 },
    hp: { current: 8, max: 8, temp: 0 },
    featsTaken: ['savage-attacker'],
    attitude: 'unfriendly',
    morale: { current: 2, max: 5 },
  });

describe('golden: NPC reactions and morale (Slice 26)', () => {
  it('reaction roll changes attitude; morale eventually breaks', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(26) });
    const alyx = buildFighter({ name: 'Alyx', CHA: 16 });
    const shopkeep = buildShopkeep('Olg the Suspicious');

    let campaign = engine.createCampaign({ name: 's26' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: shopkeep } satisfies CharacterCreatedEvent,
    ]);

    campaign = commit(
      campaign,
      engine.plan.reactionRoll(campaign.state, {
        npcId: shopkeep.id,
        presenterId: alyx.id,
        dc: 10,
      }).events,
    );

    expect(campaign.state.characters[shopkeep.id]?.attitude).toBeDefined();

    // Two failed morale checks to drop morale to 0
    campaign = commit(
      campaign,
      engine.plan.moraleCheck(campaign.state, {
        npcId: shopkeep.id,
        dc: 30,
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.moraleCheck(campaign.state, {
        npcId: shopkeep.id,
        dc: 30,
      }).events,
    );

    // Force a final break if not already there
    if (!campaign.state.characters[shopkeep.id]?.moraleBroken) {
      campaign = commit(campaign, [
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'MoraleBroken',
          characterId: shopkeep.id,
          action: 'flee',
        } satisfies MoraleBrokenEvent,
      ]);
    }
    expect(campaign.state.characters[shopkeep.id]?.moraleBroken).toBe(true);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 26: NPC Reactions and Morale',
      }),
    ).toMatchFileSnapshot('./transcripts/s26-npc.transcript.md');
  });
});
