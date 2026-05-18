// Golden scenario: Monk L10 Self-Restoration (slice 202).
//
// RAW (SRD 5.2.1): "Through sheer force of will, you can remove one
// of the following conditions from yourself at the end of each of
// your turns: Charmed, Frightened, or Poisoned."
//
// Sequence:
//   1. L10 Monk picks up the Poisoned condition (from an enemy
//      attack, narratively).
//   2. At the end of their turn, they invoke Self-Restoration to
//      remove Poisoned.
//   3. Later, they get Frightened from a different source and remove
//      it the same way.
//
// The transcript captures both condition removals so a future change
// that breaks Self-Restoration surfaces as a diff.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId, newAppliedConditionId } from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../src/schemas/events/combat.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildMonk = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Kai',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level: 10, hitDiceRemaining: 10 }],
    abilityScores: { STR: 12, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const applyCondition = (targetId: string, conditionId: string): ConditionAppliedEvent => ({
  id: eventId(),
  at: isoTimestamp(),
  type: 'ConditionApplied',
  targetId,
  conditionId,
  appliedConditionId: newAppliedConditionId(),
});

describe('golden: Monk L10 Self-Restoration', () => {
  it('removes Poisoned and Frightened on subsequent turns', async () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(202) });
    const kai = buildMonk();
    let campaign = engine.createCampaign({ name: 'self-restoration' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: kai } satisfies CharacterCreatedEvent,
      applyCondition(kai.id, 'poisoned'),
    ]);

    const r1 = engine.plan.selfRestoration(campaign.state, {
      characterId: kai.id,
      conditionId: 'poisoned',
    });
    campaign = commit(campaign, r1.events);

    expect(campaign.state.characters[kai.id]!.appliedConditions.some((c) => c.conditionId === 'poisoned')).toBe(false);

    campaign = commit(campaign, [applyCondition(kai.id, 'frightened')]);
    const r2 = engine.plan.selfRestoration(campaign.state, {
      characterId: kai.id,
      conditionId: 'frightened',
    });
    campaign = commit(campaign, r2.events);

    expect(campaign.state.characters[kai.id]!.appliedConditions.some((c) => c.conditionId === 'frightened')).toBe(false);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, CONTENT, {
        title: 'Monk L10 Self-Restoration: turn-end condition shed',
      }),
    ).toMatchFileSnapshot('./transcripts/s202-self-restoration.transcript.md');
  });
});
