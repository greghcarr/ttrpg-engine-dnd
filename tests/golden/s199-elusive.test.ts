// Golden scenario: Rogue L18 Elusive.
//
// RAW (SRD 5.2.1): "No attack roll can have Advantage against you
// unless you have the Incapacitated condition."
//
// This scenario walks the two halves of the rule:
//   1. An Invisible attacker (which grants the attacker advantage on
//      attack rolls) takes a swing at the Elusive Rogue. Elusive
//      cancels the advantage; the attack rolls a single d20.
//   2. The Rogue is then Stunned (a condition that includes
//      Incapacitated per RAW). The same Invisible attacker takes
//      another swing; Elusive is suppressed and the attacker rolls
//      with advantage.
//
// The transcript snapshot captures the [advantage] tag flipping
// between the two attacks, so a future change that breaks Elusive
// would surface as a diff against the checked-in markdown.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../src/schemas/runtime/item-instance.js';
import {
  newCharacterId,
  newItemInstanceId,
  newAppliedConditionId,
} from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../src/schemas/events/combat.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildAttacker = (longswordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Veska',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [longswordId],
    equipped: { mainHand: longswordId, attuned: [] },
  });

const buildElusiveRogue = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Marien',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'rogue', level: 18, hitDiceRemaining: 18 }],
    abilityScores: { STR: 10, DEX: 18, CON: 12, INT: 14, WIS: 10, CHA: 10 },
    hp: { current: 90, max: 90, temp: 0 },
    featsTaken: [],
  });

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

const applyConditionTo = (
  bearerId: string,
  conditionId: string,
): ConditionAppliedEvent => ({
  id: eventId(),
  at: isoTimestamp(),
  type: 'ConditionApplied',
  targetId: bearerId,
  conditionId,
  appliedConditionId: newAppliedConditionId(),
});

describe('golden: Rogue L18 Elusive', () => {
  it('cancels an Invisible attacker advantage; Stunned bearer loses the suppression', async () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(199) });
    const sword = longsword();
    const veska = buildAttacker(sword.id);
    const marien = buildElusiveRogue();

    let campaign = engine.createCampaign({ name: 'elusive' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: veska } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: marien } satisfies CharacterCreatedEvent,
      applyConditionTo(veska.id, 'invisible'),
    ]);

    // First swing: Elusive cancels Invisible's advantage; attacker
    // rolls a single d20.
    const firstSwing = engine.plan.attack(campaign.state, {
      attackerId: veska.id,
      targetId: marien.id,
      weaponInstanceId: sword.id,
    });
    campaign = commit(campaign, firstSwing.events);

    // Stun the Rogue (Stunned RAW-includes Incapacitated).
    campaign = commit(campaign, [applyConditionTo(marien.id, 'stunned')]);

    // Second swing: Elusive suppressed; attacker rolls with advantage.
    const secondSwing = engine.plan.attack(campaign.state, {
      attackerId: veska.id,
      targetId: marien.id,
      weaponInstanceId: sword.id,
    });
    campaign = commit(campaign, secondSwing.events);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, CONTENT, {
        title: "Rogue L18 Elusive: advantage suppressed unless Incapacitated",
      }),
    ).toMatchFileSnapshot('./transcripts/s199-elusive.transcript.md');
  });
});
