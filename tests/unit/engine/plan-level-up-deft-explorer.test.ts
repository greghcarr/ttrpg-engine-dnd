import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { computeAbilityCheck } from '../../../src/derive/ability-check.js';
import { resolveContent } from '../../../src/content/pack.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ChoiceRequiredEvent } from '../../../src/schemas/events/level-up.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Ranger L2 Deft Explorer: OfferChoice for one skill expertise.
// Bug this prevents: a Ranger reaching L2 should be offered an
// expertise choice and the resolved choice should grant the picked
// skill at expertise level on derivation.

const PACK = loadStarterPack();

const buildRanger = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Sylas',
    speciesId: 'elf',
    backgroundId: 'outlander',
    classes: [{ classId: 'ranger', level, hitDiceRemaining: level }],
    abilityScores: { STR: 12, DEX: 16, CON: 14, INT: 10, WIS: 14, CHA: 10 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: [],
  });

describe('Deft Explorer (Ranger L2)', () => {
  it('Ranger leveling 1 → 2 emits both Fighting Style and Deft Explorer choices', () => {
    const ranger = buildRanger(1);
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'rng-de' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
    ]);
    const levelEvents = engine.plan.levelUp(campaign.state, {
      characterId: ranger.id,
      classId: 'ranger',
      hpStrategy: 'average',
    }).events;
    const choices = levelEvents.filter((e) => e.type === 'ChoiceRequired') as ChoiceRequiredEvent[];
    const promptKeys = choices.map((c) => c.promptKey).sort();
    expect(promptKeys).toEqual(['deft-explorer-expertise', 'fighting-style-ranger']);
  });

  it('resolving Deft Explorer with Survival adds expertise on Survival', () => {
    const ranger = buildRanger(1);
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'rng-de-resolve' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ranger } satisfies CharacterCreatedEvent,
    ]);
    const levelEvents = engine.plan.levelUp(campaign.state, {
      characterId: ranger.id,
      classId: 'ranger',
      hpStrategy: 'average',
    }).events;
    campaign = commit(campaign, levelEvents);
    const deftChoice = levelEvents.find(
      (e) => e.type === 'ChoiceRequired' && e.promptKey === 'deft-explorer-expertise',
    ) as ChoiceRequiredEvent;
    campaign = commit(
      campaign,
      engine.plan.resolveChoice(campaign.state, {
        choiceId: deftChoice.choiceId,
        characterId: ranger.id,
        selectedOptionIds: ['survival'],
      }).events,
    );

    // Verify via WIS (survival) ability check breakdown: should now
    // have skill-prof(expertise) source.
    const content = resolveContent([PACK]);
    const updated = campaign.state.characters[ranger.id]!;
    const check = computeAbilityCheck({
      character: updated,
      itemInstances: campaign.state.itemInstances,
      content,
      ability: 'WIS',
      skill: 'survival',
      pendingChoices: campaign.state.pendingChoices,
    });
    expect(check.breakdown.some((b) => b.source === 'skill-prof(expertise)')).toBe(true);
  });
});
