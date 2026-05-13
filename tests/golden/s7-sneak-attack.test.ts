import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp, makeItemInstance } from '../fixtures/index.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId, newEncounterId } from '../../src/ids.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  RoundEndedEvent,
  TurnEndedEvent,
  TurnStartedEvent,
  EncounterEndedEvent,
} from '../../src/schemas/events/encounter.js';
import type { AttackRolledEvent } from '../../src/schemas/events/attack.js';

const buildRogue = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Vex',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'rogue', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 18, CON: 12, INT: 12, WIS: 10, CHA: 10 },
    hp: { current: 14, max: 14, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const findRetryingAdvantageHit = (
  baseEngine: ReturnType<typeof createEngine>,
  campaign: ReturnType<typeof createEngine>['createCampaign'] extends (...args: never[]) => infer R ? R : never,
  rogueId: string,
  targetId: string,
  weaponId: string,
  startSeed: number,
): { engine: ReturnType<typeof createEngine>; events: ReadonlyArray<unknown> } => {
  for (let seed = startSeed; seed < startSeed + 80; seed++) {
    const engine = createEngine({ contentPacks: [ROGUE_WITH_EXTRA_ATTACK_PACK], rng: seededRNG(seed) });
    const events = engine.plan.attack(campaign.state, {
      attackerId: rogueId,
      targetId,
      weaponInstanceId: weaponId,
      advantage: 'advantage',
    }).events;
    const attack = events.find((e) => e.type === 'AttackRolled') as AttackRolledEvent | undefined;
    if (attack?.hit === true) return { engine, events };
  }
  throw new Error('could not find a hitting seed');
};

const ROGUE_WITH_EXTRA_ATTACK_PACK = {
  ...TEST_PACK,
  classes: TEST_PACK.classes.map((c) =>
    c.id === 'rogue'
      ? {
          ...c,
          levelTable: {
            ...c.levelTable,
            '1': {
              ...c.levelTable['1']!,
              features: [
                ...c.levelTable['1']!.features,
                {
                  id: 'practice-yard-extra-attack',
                  name: 'Practice Yard Extra Attack',
                  effects: [
                    {
                      kind: 'ModifyActionEconomy' as const,
                      op: 'extraAttack' as const,
                      count: 1,
                    },
                  ],
                },
              ],
            },
          },
        }
      : c,
  ),
};

describe('golden: rogue Sneak Attack across turns', () => {
  it('first turn fires Sneak Attack, second attack same turn does not, next turn fires again', async () => {
    const baseEngine = createEngine({ contentPacks: [ROGUE_WITH_EXTRA_ATTACK_PACK], rng: seededRNG(100) });
    const rapier = makeItemInstance('rapier');
    const vex = buildRogue();
    const dummy = buildFighter({ name: 'Training Dummy', hpMax: 100, hpCurrent: 100, DEX: 8 });
    const filler = buildFighter({ name: 'Filler', hpMax: 1, hpCurrent: 1 });

    let campaign = baseEngine.createCampaign({ name: 'sneak' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: rapier },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: vex } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dummy } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: filler } satisfies CharacterCreatedEvent,
    ]);

    const encounterId = newEncounterId();
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterCreated',
        encounterId,
        name: 'Practice Yard',
        combatantIds: [vex.id, dummy.id, filler.id],
      } satisfies EncounterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: vex.id, d20: 20, modifier: 4, total: 24 },
          { combatantId: dummy.id, d20: 10, modifier: 1, total: 11 },
          { combatantId: filler.id, d20: 5, modifier: 1, total: 6 },
        ],
      } satisfies InitiativeRolledEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterStarted',
        encounterId,
      } satisfies EncounterStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: vex.id,
        round: 1,
      } satisfies TurnStartedEvent,
    ]);

    const firstHit = findRetryingAdvantageHit(baseEngine, campaign, vex.id, dummy.id, rapier.id, 1);
    campaign = commit(campaign, firstHit.events as never);
    expect(
      firstHit.events.some(
        (e) => (e as { type: string }).type === 'TriggerFired',
      ),
    ).toBe(true);

    const secondHit = findRetryingAdvantageHit(baseEngine, campaign, vex.id, dummy.id, rapier.id, 200);
    campaign = commit(campaign, secondHit.events as never);
    expect(
      secondHit.events.some(
        (e) => (e as { type: string }).type === 'TriggerFired',
      ),
    ).toBe(false);

    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnEnded',
        encounterId,
        combatantId: vex.id,
        round: 1,
      } satisfies TurnEndedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: dummy.id,
        round: 1,
      } satisfies TurnStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnEnded',
        encounterId,
        combatantId: dummy.id,
        round: 1,
      } satisfies TurnEndedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: filler.id,
        round: 1,
      } satisfies TurnStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnEnded',
        encounterId,
        combatantId: filler.id,
        round: 1,
      } satisfies TurnEndedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'RoundEnded',
        encounterId,
        round: 1,
      } satisfies RoundEndedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: vex.id,
        round: 2,
      } satisfies TurnStartedEvent,
    ]);

    const thirdHit = findRetryingAdvantageHit(baseEngine, campaign, vex.id, dummy.id, rapier.id, 400);
    campaign = commit(campaign, thirdHit.events as never);
    expect(
      thirdHit.events.some(
        (e) => (e as { type: string }).type === 'TriggerFired',
      ),
    ).toBe(true);

    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterEnded',
        encounterId,
        outcome: 'victory',
      } satisfies EncounterEndedEvent,
    ]);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Rogue Sneak Attack: once per turn cadence',
      }),
    ).toMatchFileSnapshot('./transcripts/s7-sneak-attack.transcript.rtf');
  });
});
