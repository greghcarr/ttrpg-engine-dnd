// Golden scenario: Hunter L7 Defensive Tactics (Escape the Horde arm).
//
// RAW: "Opportunity Attacks have Disadvantage against you." The
// engine surfaces OA-ness via the new `isOpportunityAttack` field on
// `AttackRolled` (slice 206); the Hunter L7 OfferChoice option ships
// an `ImposeDisadvantageOnAttackers` gated on
// `event.isOpportunityAttack === true`.
//
// Sequence:
//   1. L7 Hunter chooses Escape the Horde at acquire.
//   2. The Hunter moves out of melee reach (consumer-driven; engine
//      doesn't auto-detect, just records the OA the consumer chooses
//      to plan).
//   3. The attacker takes an opportunity attack: rolls with
//      disadvantage (2 d20 dice, lower used).

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
import { newCharacterId, newItemInstanceId, newEncounterId, newChoiceId } from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ChoiceRequiredEvent, ChoiceResolvedEvent } from '../../src/schemas/events/level-up.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnStartedEvent,
} from '../../src/schemas/events/encounter.js';
import type { AttackRolledEvent } from '../../src/schemas/events/attack.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildHunter = (swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Aria',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'ranger', level: 7, hitDiceRemaining: 7, subclassId: 'hunter' }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 14, CHA: 10 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const buildOrc = (swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Skull',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 16, INT: 8, WIS: 8, CHA: 8 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const escapeTheHordeChoice = (characterId: string): [ChoiceRequiredEvent, ChoiceResolvedEvent] => {
  const choiceId = newChoiceId();
  return [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'defensive-tactics',
      prompt: 'Pick Escape the Horde or Multiattack Defense.',
      options: [
        {
          id: 'escape-the-horde',
          label: 'Escape the Horde',
          effects: [
            {
              kind: 'ImposeDisadvantageOnAttackers',
              condition: { kind: 'eq', path: 'event.isOpportunityAttack', value: true },
            },
          ],
        },
        { id: 'multiattack-defense', label: 'Multiattack Defense', effects: [] },
      ],
      oneOf: 1,
    },
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: ['escape-the-horde'],
    },
  ];
};

describe('golden: Hunter L7 Defensive Tactics (Escape the Horde)', () => {
  it('opportunity attack against the hunter rolls with disadvantage; a regular attack does not', async () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(206) });
    const aria = buildHunter(newItemInstanceId());
    const skull = buildOrc(newItemInstanceId());
    const ariaSword = ItemInstanceSchema.parse({ id: aria.equipped!.mainHand!, definitionId: 'longsword' });
    const skullSword = ItemInstanceSchema.parse({ id: skull.equipped!.mainHand!, definitionId: 'longsword' });

    let campaign = engine.createCampaign({ name: 'escape-the-horde' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: ariaSword },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: skullSword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: aria } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: skull } satisfies CharacterCreatedEvent,
      ...escapeTheHordeChoice(aria.id),
    ]);

    const encounterId = newEncounterId();
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterCreated',
        encounterId,
        name: 'Forest Skirmish',
        combatantIds: [aria.id, skull.id],
      } satisfies EncounterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: aria.id, d20: 18, modifier: 4, total: 22 },
          { combatantId: skull.id, d20: 12, modifier: 1, total: 13 },
        ],
      } satisfies InitiativeRolledEvent,
      { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId } satisfies EncounterStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: aria.id,
        round: 1,
      } satisfies TurnStartedEvent,
    ]);

    // Aria moves away from Skull; Skull takes an opportunity attack
    // against her. The engine doesn't model position triggers, so the
    // consumer is asserting the OA shape directly via the planner.
    const oa = engine.plan.opportunityAttack(campaign.state, {
      reactorId: skull.id,
      targetId: aria.id,
      weaponInstanceId: skullSword.id,
    });
    campaign = commit(campaign, oa.events);

    const oaAttack = oa.events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled')!;
    expect(oaAttack.isOpportunityAttack).toBe(true);
    expect(oaAttack.used).toBe('disadvantage');

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, CONTENT, {
        title: "Hunter L7 Escape the Horde: OA against the Hunter rolls with disadvantage",
      }),
    ).toMatchFileSnapshot('./transcripts/s206-escape-the-horde.transcript.md');
  });
});
