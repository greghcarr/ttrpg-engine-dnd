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
} from '../fixtures/index.js';
import { newEncounterId } from '../../src/ids.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnStartedEvent,
} from '../../src/schemas/events/encounter.js';

const setupScout = () => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
  const scout = buildFighter({ name: 'Scout', DEX: 16 });
  const goblin = buildFighter({ name: 'Goblin', hpMax: 14, hpCurrent: 14 });
  let campaign = engine.createCampaign({ name: 'movement' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: scout } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: goblin } satisfies CharacterCreatedEvent,
  ]);
  const encounterId = newEncounterId();
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'EncounterCreated',
      encounterId,
      name: 'Open Field',
      combatantIds: [scout.id, goblin.id],
    } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: scout.id, d20: 20, modifier: 3, total: 23 },
        { combatantId: goblin.id, d20: 5, modifier: 1, total: 6 },
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
      combatantId: scout.id,
      round: 1,
    } satisfies TurnStartedEvent,
  ]);
  return { engine, campaign, scoutId: scout.id, encounterId };
};

describe('golden: movement and positioning', () => {
  it('scout starts at origin, moves 20ft, dashes to cover 30ft more, third 30ft move throws', async () => {
    const { engine, campaign: initialCampaign, scoutId, encounterId } = setupScout();
    let campaign = initialCampaign;

    // Set the scout's starting position (consumer-injected). Goblin stays unplaced.
    const fresh = campaign.state.encounters[encounterId]?.combatants.find(
      (c) => c.combatantId === scoutId,
    );
    if (!fresh) throw new Error('no scout');
    campaign = {
      ...campaign,
      state: {
        ...campaign.state,
        encounters: {
          ...campaign.state.encounters,
          [encounterId]: {
            ...campaign.state.encounters[encounterId]!,
            combatants: campaign.state.encounters[encounterId]!.combatants.map((c) =>
              c.combatantId === scoutId
                ? { ...c, position: { x: 0, y: 0 } }
                : c,
            ),
          },
        },
      },
    };

    // Positions are in feet. Default speed is 30ft.
    // Move 20 feet (10 remaining).
    campaign = commit(
      campaign,
      engine.plan.move(campaign.state, { combatantId: scoutId, to: { x: 20, y: 0 } }).events,
    );

    // Trying to move another 15 feet (only 10 remaining) throws.
    expect(() =>
      engine.plan.move(campaign.state, { combatantId: scoutId, to: { x: 35, y: 0 } }),
    ).toThrow(/exceeds remaining movement/);

    // Dash to double the speed budget. Then make a long move.
    campaign = commit(
      campaign,
      engine.plan.dash(campaign.state, { combatantId: scoutId }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.move(campaign.state, { combatantId: scoutId, to: { x: 50, y: 0 } }).events,
    );

    // Total moved: 20 + 30 = 50ft. Speed 30 doubled to 60 by Dash. 10ft remaining.
    const scoutCombatant = campaign.state.encounters[encounterId]?.combatants.find(
      (c) => c.combatantId === scoutId,
    );
    expect(scoutCombatant?.turnUsage.feetMovedThisTurn).toBe(50);
    expect(scoutCombatant?.turnUsage.dashed).toBe(true);

    // A further 20ft move throws because only 10ft remain.
    expect(() =>
      engine.plan.move(campaign.state, { combatantId: scoutId, to: { x: 70, y: 0 } }),
    ).toThrow(/exceeds remaining movement/);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Movement, Dash, and the movement budget enforcement',
      }),
    ).toMatchFileSnapshot('./transcripts/s10-movement.transcript.rtf');
  });

  it('disengaged combatant has the flag set', () => {
    const { engine, campaign: initial, scoutId } = setupScout();
    const after = commit(
      initial,
      engine.plan.disengage(initial.state, { combatantId: scoutId }).events,
    );
    const combatant = after.state.encounters[initial.state.activeEncounterId!]
      ?.combatants.find((c) => c.combatantId === scoutId);
    expect(combatant?.turnUsage.disengaged).toBe(true);
  });
});
