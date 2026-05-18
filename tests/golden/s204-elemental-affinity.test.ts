// Golden scenario: Draconic Sorcery L6 Elemental Affinity (slice 204).
//
// RAW: "When you cast a spell that deals damage of the chosen type,
// add your Charisma modifier to one damage roll of that spell."
//
// Sequence:
//   1. L6 Sorcerer (CHA 18, +4 mod) picks Elemental Affinity (Fire).
//   2. Casts Fire Bolt at a target.
//   3. Engine consults the caster's effect stack via
//      modifierSum('damage', {event.damageType: 'fire'}) and adds +4
//      to the DamageRoll.modifier.
//
// The transcript captures the boosted modifier on the DamageRolled
// event so a future change that breaks the cast-spell damage-facts
// plumbing surfaces as a diff.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId, newChoiceId } from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ChoiceRequiredEvent, ChoiceResolvedEvent } from '../../src/schemas/events/level-up.js';
import type { AttackRolledEvent } from '../../src/schemas/events/attack.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildSorcerer = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ember',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'sorcerer', level: 6, hitDiceRemaining: 6, subclassId: 'draconic-sorcery' }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: 38, max: 38, temp: 0 },
    featsTaken: [],
    preparedSpells: ['fire-bolt'],
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 8, DEX: 8, CON: 14, INT: 8, WIS: 8, CHA: 8 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
  });

const elementalAffinityEvents = (characterId: string): [ChoiceRequiredEvent, ChoiceResolvedEvent] => {
  const choiceId = newChoiceId();
  return [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'elemental-affinity',
      prompt: 'Choose your draconic damage type.',
      options: [
        {
          id: 'fire',
          label: 'Fire',
          effects: [
            { kind: 'GrantResistance', damageType: 'fire' },
            {
              kind: 'AddModifier',
              target: 'damage',
              value: { kind: 'abilityMod', ability: 'CHA' },
              condition: { kind: 'eq', path: 'event.damageType', value: 'fire' },
            },
          ],
        },
      ],
      oneOf: 1,
    },
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: ['fire'],
    },
  ];
};

describe('golden: Draconic Sorcery L6 Elemental Affinity', () => {
  it('adds +CHA-mod to fire-bolt damage when fire affinity is selected', async () => {
    for (let seed = 1; seed < 80; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed + 1000) });
      const ember = buildSorcerer();
      const goblin = buildTarget();
      let campaign = engine.createCampaign({ name: `elemental-affinity-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ember } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: goblin } satisfies CharacterCreatedEvent,
        ...elementalAffinityEvents(ember.id),
      ]);

      const cast = engine.plan.castSpell(campaign.state, {
        characterId: ember.id,
        spellId: 'fire-bolt',
        slotLevel: 0,
        targetIds: [goblin.id],
      });
      const attack = cast.events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (attack?.hit !== true) continue;
      campaign = commit(campaign, cast.events);

      const replayed = replay(campaign.events);
      expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
      void throwOnCallRNG();
      expect(() => replay(campaign.events)).not.toThrow();

      await expect(
        formatTranscript(campaign.events, CONTENT, {
          title: 'Elemental Affinity (Fire): +CHA-mod on fire-bolt damage',
        }),
      ).toMatchFileSnapshot('./transcripts/s204-elemental-affinity.transcript.md');
      return;
    }
    throw new Error('no hitting seed found across 80 attempts');
  });
});
