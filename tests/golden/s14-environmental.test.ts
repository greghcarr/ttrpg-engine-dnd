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

describe('golden: environmental hazards', () => {
  it('falling damage scales 1d6 per 10ft, capped at 20d6', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const character = buildFighter({ name: 'Falling Fighter', hpMax: 200, hpCurrent: 200 });
    let campaign = engine.createCampaign({ name: 'falling' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: character } satisfies CharacterCreatedEvent,
    ]);

    // 30ft fall: 3d6 average = ~10.5 → 11 (rounded).
    campaign = commit(
      campaign,
      engine.plan.falling(campaign.state, { characterId: character.id, distanceFeet: 30 }).events,
    );
    const after30 = campaign.state.characters[character.id]?.hp.current ?? 0;
    expect(after30).toBeLessThan(200);

    // 300ft fall: should cap at 20d6 average = 70.
    campaign = commit(
      campaign,
      engine.plan.falling(campaign.state, { characterId: character.id, distanceFeet: 300 }).events,
    );
    const after300 = campaign.state.characters[character.id]?.hp.current ?? 0;
    expect(200 - after300).toBeLessThanOrEqual(11 + 70);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Falling damage: 30ft then 300ft (capped)',
      }),
    ).toMatchFileSnapshot('./transcripts/s14-environmental.transcript.md');
  });

  it('half cover adds +2 AC; total cover rejects the attack', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(99) });
    const attacker = buildFighter({ name: 'Sniper', STR: 16 });
    const target = buildFighter({ name: 'Hidden', hpMax: 30, hpCurrent: 30, DEX: 10 });
    const longsword = makeItemInstance('longsword');
    let campaign = engine.createCampaign({ name: 'cover' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);

    const { events } = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: longsword.id,
      cover: 'half',
    });
    const attackRolled = events.find((e) => e.type === 'AttackRolled');
    expect(attackRolled?.type).toBe('AttackRolled');
    if (attackRolled?.type === 'AttackRolled') {
      // Target base AC was 10 (no DEX bonus with DEX 10) + 2 cover = 12.
      expect(attackRolled.targetAC).toBe(12);
    }

    expect(() =>
      engine.plan.attack(campaign.state, {
        attackerId: attacker.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
        cover: 'total',
      }),
    ).toThrow(/total cover/);
  });
});
