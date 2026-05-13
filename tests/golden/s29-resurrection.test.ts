import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { DamageAppliedEvent } from '../../src/schemas/events/combat.js';
import type { CharacterResurrectedEvent } from '../../src/schemas/events/resurrection.js';

describe('golden: resurrection (Slice 29)', () => {
  it('Revivify restores a fallen ally to 1 HP, clears death saves', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(29) });
    const alyx = buildFighter({ name: 'Alyx', hpMax: 20, hpCurrent: 20 });
    const cleric = buildFighter({ name: 'Sister Roan' });

    let campaign = engine.createCampaign({ name: 's29-revivify' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DamageApplied',
        targetId: alyx.id,
        components: [{ amount: 100, type: 'slashing' }],
      } satisfies DamageAppliedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterResurrected',
        characterId: alyx.id,
        spell: 'revivify',
        byCharacterId: cleric.id,
        hpAfter: 1,
      } satisfies CharacterResurrectedEvent,
    ]);

    expect(campaign.state.characters[alyx.id]?.hp.current).toBe(1);
    expect(campaign.state.characters[alyx.id]?.deathSaves).toEqual({ successes: 0, failures: 0, stable: false });

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 29: Revivify',
      }),
    ).toMatchFileSnapshot('./transcripts/s29-resurrection.transcript.rtf');
  });

  it('Reincarnate restores at full HP and can change species', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(29) });
    const alyx = buildFighter({ name: 'Alyx', hpMax: 25, hpCurrent: 25 });
    let campaign = engine.createCampaign({ name: 's29-reincarnate' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DamageApplied',
        targetId: alyx.id,
        components: [{ amount: 100, type: 'fire' }],
      } satisfies DamageAppliedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterResurrected',
        characterId: alyx.id,
        spell: 'reincarnate',
        hpAfter: 25,
        newSpeciesId: 'human',
      } satisfies CharacterResurrectedEvent,
    ]);
    expect(campaign.state.characters[alyx.id]?.hp.current).toBe(25);
    expect(campaign.state.characters[alyx.id]?.speciesId).toBe('human');
  });
});
