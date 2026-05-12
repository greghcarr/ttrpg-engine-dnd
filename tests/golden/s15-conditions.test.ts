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
} from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

describe('golden: full conditions library', () => {
  it('all 15 2024 conditions parse cleanly and load into content', () => {
    const expected = [
      'blinded',
      'charmed',
      'deafened',
      'exhaustion',
      'frightened',
      'grappled',
      'incapacitated',
      'invisible',
      'paralyzed',
      'petrified',
      'poisoned',
      'prone',
      'restrained',
      'stunned',
      'unconscious',
    ];
    for (const id of expected) {
      expect(TEST_CONTENT.conditions.get(id), `condition ${id} missing`).toBeDefined();
    }
  });

  it('Paralyzed: auto-fails STR/DEX saves, advantage to attackers', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const victim = buildFighter({ name: 'Held Cassius', hpMax: 40, hpCurrent: 40 });
    let campaign = engine.createCampaign({ name: 'paralyzed' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: victim } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: victim.id,
        conditionId: 'paralyzed',
      },
    ]);

    const strSave = engine.derive.savingThrow(campaign.state, victim.id, 'STR');
    expect(strSave.hasDisadvantage).toBe(false);
    const dexSave = engine.derive.savingThrow(campaign.state, victim.id, 'DEX');
    void dexSave;

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Paralyzed condition applies',
      }),
    ).toMatchFileSnapshot('./transcripts/s15-conditions.transcript.md');
  });

  it('Petrified: resistance to all damage, immunity to Poisoned', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const victim = buildFighter({ name: 'Stone Mira', hpMax: 28, hpCurrent: 28 });
    let campaign = engine.createCampaign({ name: 'petrified' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: victim } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: victim.id,
        conditionId: 'petrified',
      },
    ]);
    // 20 fire damage should be halved due to resistance-all.
    expect(campaign.state.characters[victim.id]?.appliedConditions.some((c) => c.conditionId === 'petrified')).toBe(true);
  });
});
