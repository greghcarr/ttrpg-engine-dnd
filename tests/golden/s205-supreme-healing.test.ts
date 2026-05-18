// Golden scenario: Life Domain L17 Supreme Healing (slice 205).
//
// RAW: "When you would normally roll one or more dice to restore HP
// with a spell or Channel Divinity, you don't roll those dice; you
// use the highest possible value instead."
//
// Sequence:
//   1. L17 Life Domain Cleric (WIS 18, Disciple of Life from L3)
//      heals a wounded ally with Cure Wounds at slot 1.
//   2. The cleric's effect stack carries `GrantMaxHealingDice` from
//      the L17 feature. cast-spell.ts swaps every healing die to its
//      max value: 2d8 → 16. Plus +4 WIS + 3 Disciple of Life = 23.
//   3. Compared to a non-Supreme cleric, the heal is deterministic
//      (no dice roll) and at the max.
//
// The transcript captures the Healed event with the boost folded in.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildCleric = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Solace',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level: 17, hitDiceRemaining: 17, subclassId: 'life-domain' }],
    abilityScores: { STR: 12, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 130, max: 130, temp: 0 },
    featsTaken: [],
    preparedSpells: ['cure-wounds'],
  });

const buildWoundedAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Roan',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 8, hitDiceRemaining: 8 }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 12, max: 60, temp: 0 },
    featsTaken: [],
  });

describe('golden: Life Domain L17 Supreme Healing', () => {
  it('cure-wounds at slot 1 deterministically heals the max value (23 HP)', async () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(205) });
    const solace = buildCleric();
    const roan = buildWoundedAlly();
    let campaign = engine.createCampaign({ name: 'supreme-healing' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: solace } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: roan } satisfies CharacterCreatedEvent,
    ]);

    const hpBefore = campaign.state.characters[roan.id]!.hp.current;
    const cast = engine.plan.castSpell(campaign.state, {
      characterId: solace.id,
      spellId: 'cure-wounds',
      slotLevel: 1,
      targetIds: [roan.id],
    });
    campaign = commit(campaign, cast.events);

    const hpAfter = campaign.state.characters[roan.id]!.hp.current;
    // 2d8 max (16) + 4 WIS + 3 Disciple of Life = 23.
    expect(hpAfter - hpBefore).toBe(23);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, CONTENT, {
        title: 'Supreme Healing (Life Domain L17): cure-wounds heals max value deterministically',
      }),
    ).toMatchFileSnapshot('./transcripts/s205-supreme-healing.transcript.md');
  });
});
