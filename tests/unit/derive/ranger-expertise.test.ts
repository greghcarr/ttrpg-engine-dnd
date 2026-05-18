import { describe, expect, it } from 'vitest';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId, newChoiceId } from '../../../src/ids.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ChoiceRequiredEvent, ChoiceResolvedEvent } from '../../../src/schemas/events/level-up.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 208: Ranger L9 Expertise. Pure-content slice mirroring the
// Rogue L1 / L6 Expertise OfferChoice pattern, scoped to the Ranger
// skill list. RAW: "Choose two skills you have proficiency in. You
// gain Expertise in those skills."
//
// The selected skills feed into the effect stack as
// `GrantProficiency { target: 'skill', level: 'expertise' }` entries.
// This test validates the OfferChoice resolution + accumulator fold;
// total ability-check computation is exercised by the existing
// jack-of-all-trades + bard-expertise tests.

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildRanger = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Pathfinder',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'ranger', level, hitDiceRemaining: level, subclassId: 'hunter' }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const seedExpertiseChoice = (
  characterId: string,
  selected: ReadonlyArray<string>,
): [ChoiceRequiredEvent, ChoiceResolvedEvent] => {
  const choiceId = newChoiceId();
  const skills = ['animal-handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] as const;
  return [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'ranger-expertise-l9',
      prompt: 'Choose two skills.',
      options: skills.map((s) => ({
        id: s,
        label: s,
        effects: [{ kind: 'GrantProficiency', target: 'skill', id: s, level: 'expertise' }],
      })),
      oneOf: 2,
    },
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: [...selected],
    },
  ];
};

describe('Ranger L9 Expertise (slice 208)', () => {
  it('an L8 ranger has no expertise on any skill from the effect stack', () => {
    const ranger = buildRanger(8);
    const acc = buildEffectStack({
      character: ranger,
      content: CONTENT,
      itemInstances: {},
    });
    for (const s of ['survival', 'perception', 'stealth', 'nature']) {
      expect(acc.proficiencyLevel('skill', s)).not.toBe('expertise');
    }
  });

  it('an L9 ranger who picks Survival + Perception folds both into the effect stack as expertise', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(208) });
    const ranger = buildRanger(9);
    let campaign: Campaign = engine.createCampaign({ name: 'ranger-expertise' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
      ...seedExpertiseChoice(ranger.id, ['survival', 'perception']),
    ]);
    const stored = campaign.state.characters[ranger.id]!;
    const acc = buildEffectStack({
      character: stored,
      content: CONTENT,
      itemInstances: campaign.state.itemInstances,
      pendingChoices: campaign.state.pendingChoices,
    });
    expect(acc.proficiencyLevel('skill', 'survival')).toBe('expertise');
    expect(acc.proficiencyLevel('skill', 'perception')).toBe('expertise');
    // Non-selected skills remain at 'none' (or whatever the default).
    expect(acc.proficiencyLevel('skill', 'stealth')).not.toBe('expertise');
  });
});
