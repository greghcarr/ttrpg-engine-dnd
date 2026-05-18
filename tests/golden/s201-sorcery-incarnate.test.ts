// Golden scenario: Sorcerer L7 Sorcery Incarnate (slice 201).
//
// RAW (SRD 5.2.1): "If you have no uses of Innate Sorcery left, you
// can use it if you spend 2 Sorcery Points when you take the Bonus
// Action to activate it."
//
// Sequence:
//   1. L7 Sorcerer enters an encounter with 0 Innate Sorcery uses
//      remaining and 5 Sorcery Points.
//   2. On their turn, they activate Innate Sorcery via Sorcery
//      Incarnate's alternative cost (2 Sorcery Points).
//   3. The transcript captures the bonus action, the SP spend, and
//      the `innate-sorcery-active` condition becoming active.
//
// The "doubled Metamagic per spell while active" arm of Sorcery
// Incarnate is deferred (the metamagic planner doesn't enforce a
// once-per-spell cap yet) and the "Advantage on Sorcerer spell
// attack rolls" arm of Innate Sorcery itself is deferred (needs an
// `event.spellSourceClassId` fact). Both are documented in the
// CHANGELOG.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId, newEncounterId } from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  EncounterCreatedEvent,
  InitiativeRolledEvent,
  EncounterStartedEvent,
  TurnStartedEvent,
} from '../../src/schemas/events/encounter.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildSorcerer = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ember',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'sorcerer', level: 7, hitDiceRemaining: 7 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: 45, max: 45, temp: 0 },
    featsTaken: [],
    resources: [
      { resourceId: 'innate-sorcery', current: 0, max: 2 },
      { resourceId: 'sorcery-points', current: 5, max: 7 },
    ],
  });

const buildEnemy = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 12, DEX: 12, CON: 10, INT: 8, WIS: 8, CHA: 8 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: [],
  });

describe('golden: Sorcery Incarnate (Sorcerer L7) alternative-cost activation', () => {
  it('spends 2 Sorcery Points + a bonus action to activate Innate Sorcery when out of uses', async () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(201) });
    const ember = buildSorcerer();
    const goblin = buildEnemy();

    let campaign = engine.createCampaign({ name: 'sorcery-incarnate' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ember } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: goblin } satisfies CharacterCreatedEvent,
    ]);

    const encounterId = newEncounterId();
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterCreated',
        encounterId,
        name: 'Workshop Skirmish',
        combatantIds: [ember.id, goblin.id],
      } satisfies EncounterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: ember.id, d20: 18, modifier: 2, total: 20 },
          { combatantId: goblin.id, d20: 6, modifier: 1, total: 7 },
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
        combatantId: ember.id,
        round: 1,
      } satisfies TurnStartedEvent,
    ]);

    const activate = engine.plan.innateSorcery(campaign.state, {
      characterId: ember.id,
      useSorceryPoints: true,
    });
    campaign = commit(campaign, activate.events);

    const after = campaign.state.characters[ember.id]!;
    expect(after.resources.find((r) => r.resourceId === 'sorcery-points')!.current).toBe(3);
    expect(after.appliedConditions.some((c) => c.conditionId === 'innate-sorcery-active')).toBe(true);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, CONTENT, {
        title: 'Sorcery Incarnate: 2-SP alternative cost activates Innate Sorcery',
      }),
    ).toMatchFileSnapshot('./transcripts/s201-sorcery-incarnate.transcript.md');
  });
});
