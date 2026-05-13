import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import { newCharacterId } from '../../src/ids.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  PolymorphAppliedEvent,
  PolymorphRevertedEvent,
  SimulacrumCreatedEvent,
  WishGrantedEvent,
} from '../../src/schemas/events/transformations.js';

describe('golden: transformations (Slice 30)', () => {
  it('Polymorph swaps stats and saves a snapshot, reverting restores them', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(30) });
    const alyx = buildFighter({ name: 'Alyx', hpMax: 30, hpCurrent: 20, STR: 16, DEX: 14, CON: 14 });
    const wizard = buildFighter({ name: 'Mira' });
    const simulacrumId = newCharacterId();

    let campaign = engine.createCampaign({ name: 's30' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PolymorphApplied',
        targetId: alyx.id,
        casterId: wizard.id,
        kind: 'polymorph',
        form: {
          name: 'Giant Ape',
          hp: 157,
          ac: 12,
          abilityScores: { STR: 23, DEX: 14, CON: 18, INT: 7, WIS: 12, CHA: 7 },
          speedFeet: 40,
        },
      } satisfies PolymorphAppliedEvent,
    ]);

    expect(campaign.state.characters[alyx.id]?.hp.current).toBe(157);
    expect(campaign.state.characters[alyx.id]?.abilityScores.STR).toBe(23);
    expect(campaign.state.characters[alyx.id]?.polymorphedSnapshot?.formName).toBe('Giant Ape');

    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PolymorphReverted',
        targetId: alyx.id,
        reason: 'voluntary',
      } satisfies PolymorphRevertedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'SimulacrumCreated',
        simulacrumId,
        originalId: wizard.id,
        hpMax: Math.floor(wizard.hp.max / 2),
      } satisfies SimulacrumCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'WishGranted',
        granterId: wizard.id,
        description: 'duplicates Cure Wounds at 3rd level on all party members',
        stressApplied: false,
      } satisfies WishGrantedEvent,
    ]);

    expect(campaign.state.characters[alyx.id]?.hp.current).toBe(20);
    expect(campaign.state.characters[alyx.id]?.abilityScores.STR).toBe(16);
    expect(campaign.state.characters[alyx.id]?.polymorphedSnapshot).toBeUndefined();
    expect(campaign.state.characters[simulacrumId]?.name).toContain('Simulacrum');

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 30: Polymorph, Simulacrum, Wish',
      }),
    ).toMatchFileSnapshot('./transcripts/s30-transformations.transcript.md');
  });

  it('Wild Shape uses the same Polymorph machinery with a different kind tag', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(30) });
    const druid = buildFighter({ name: 'Druid' });
    let campaign = engine.createCampaign({ name: 's30-wildshape' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PolymorphApplied',
        targetId: druid.id,
        kind: 'wild-shape',
        form: {
          name: 'Brown Bear',
          hp: 34,
          ac: 11,
          abilityScores: { STR: 19, DEX: 10, CON: 16, INT: 2, WIS: 13, CHA: 7 },
          speedFeet: 40,
        },
      } satisfies PolymorphAppliedEvent,
    ]);
    expect(campaign.state.characters[druid.id]?.polymorphedSnapshot?.kind).toBe('wild-shape');
  });

  it('Wish with stress applied bumps exhaustion', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(30) });
    const wizard = buildFighter({ name: 'Mira' });
    let campaign = engine.createCampaign({ name: 's30-wish-stress' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'WishGranted',
        granterId: wizard.id,
        description: 'restructures the timeline',
        stressApplied: true,
      } satisfies WishGrantedEvent,
    ]);
    expect(campaign.state.characters[wizard.id]?.exhaustion).toBe(1);
  });
});
