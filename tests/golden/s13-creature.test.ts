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
  buildOgre,
  eventId,
  isoTimestamp,
  makeItemInstance,
} from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

describe('golden: creature as a first-class combatant', () => {
  it('Ogre uses multiattack to make two longsword swings in one action', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(42) });
    const longsword = makeItemInstance('longsword');
    const ogre = buildOgre({ name: 'Grimtooth', mainWeaponInstanceId: longsword.id, multiattackCount: 2 });
    const target = buildFighter({ name: 'Cassius', hpMax: 40, hpCurrent: 40 });

    let campaign = engine.createCampaign({ name: 'creature' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ogre } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);

    expect(campaign.state.characters[ogre.id]?.kind).toBe('creature');
    expect(campaign.state.characters[ogre.id]?.multiattack?.attacks).toHaveLength(1);

    campaign = commit(
      campaign,
      engine.plan.multiattack(campaign.state, {
        attackerId: ogre.id,
        targetId: target.id,
      }).events,
    );

    const attackEvents = campaign.events.filter((e) => e.type === 'AttackRolled');
    expect(attackEvents.length).toBe(2);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Ogre multiattack: two longsword swings in one action',
      }),
    ).toMatchFileSnapshot('./transcripts/s13-creature.transcript.rtf');
  });

  it('rejects multiattack on a character with no multiattack pattern', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const a = buildFighter({ name: 'Alyx' });
    const b = buildFighter({ name: 'Borin' });
    let campaign = engine.createCampaign({ name: 'no-multi' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.multiattack(campaign.state, { attackerId: a.id, targetId: b.id }),
    ).toThrow(/no multiattack pattern/);
  });
});
