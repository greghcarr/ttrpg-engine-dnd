// Golden scenario: Monk L18 Superior Defense (slice 209).
//
// RAW: "As a Bonus Action, you can spend 3 Focus Points to give
// yourself Resistance to all damage except Force damage for 1
// minute."
//
// Sequence:
//   1. L18 Monk spends 3 ki, applies `superior-defense-active`.
//   2. An attacker hits the Monk with a fire-bolt (fire damage): the
//      damage is halved (the resistance applies).
//   3. A second attacker hits with a force-damage spell-attack: the
//      damage is NOT halved (force is the lone exception in RAW).
//
// Engine-side, the resistance is expressed as 12 `GrantResistance`
// entries on the bearing condition (one per non-Force damage type).
// Auto-expiry rides on the slice-102 turn-end sweep when in an
// encounter (this golden runs out-of-encounter so the condition
// persists until commit; consumer-managed otherwise).

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit, type Campaign } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import { mitigateDamage } from '../../src/derive/damage-mitigation.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildMonk = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Kai',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level: 18, hitDiceRemaining: 18 }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    hp: { current: 100, max: 100, temp: 0 },
    featsTaken: [],
    resources: [{ resourceId: 'ki', current: 18, max: 18 }],
  });

describe('golden: Monk L18 Superior Defense', () => {
  it('spends 3 ki, applies the bearing condition, halves non-force damage but not force', async () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(209) });
    const kai = buildMonk();
    let campaign: Campaign = engine.createCampaign({ name: 'superior-defense' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: kai } satisfies CharacterCreatedEvent,
    ]);

    const activation = engine.plan.superiorDefense(campaign.state, { monkId: kai.id });
    campaign = commit(campaign, activation.events);

    const after = campaign.state.characters[kai.id]!;
    expect(after.resources.find((r) => r.resourceId === 'ki')!.current).toBe(15);
    expect(after.appliedConditions.some((c) => c.conditionId === 'superior-defense-active')).toBe(true);

    // Spot-check the mitigation behavior via the derive helper.
    const fireMitigated = mitigateDamage({
      character: after,
      itemInstances: campaign.state.itemInstances,
      content: CONTENT,
      rawComponents: [{ amount: 24, type: 'fire' }],
    });
    expect(fireMitigated[0]!.amount).toBe(12);

    const forceMitigated = mitigateDamage({
      character: after,
      itemInstances: campaign.state.itemInstances,
      content: CONTENT,
      rawComponents: [{ amount: 24, type: 'force' }],
    });
    expect(forceMitigated[0]!.amount).toBe(24);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, CONTENT, {
        title: 'Superior Defense (Monk L18): spend 3 ki for resistance to all-but-force',
      }),
    ).toMatchFileSnapshot('./transcripts/s209-superior-defense.transcript.md');
  });
});
