import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Enhance Ability's six caster-chosen variants. Same shape as
// Command (slice 85) but exercises a 6-variant buff routing list to
// flush out any off-by-one in the resolver's larger-list path.

const PACK = loadStarterPack();

const buildCleric = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Enhancer',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 10, DEX: 12, CON: 12, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
    preparedSpells: ['enhance-ability'],
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildCampaign = (caster: Character, target: Character) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
  let campaign: Campaign = engine.createCampaign({ name: 'enhance-ability' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign };
};

describe('Enhance Ability caster-chosen variant (6-variant buff)', () => {
  it.each([
    ['bears-endurance', 'bears-endurance-active'],
    ['bulls-strength', 'bulls-strength-active'],
    ['cats-grace', 'cats-grace-active'],
    ['eagles-splendor', 'eagles-splendor-active'],
    ['foxs-cunning', 'foxs-cunning-active'],
    ['owls-wisdom', 'owls-wisdom-active'],
  ])("the '%s' variant applies %s", (key, expectedConditionId) => {
    const caster = buildCleric();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: caster.id,
      spellId: 'enhance-ability',
      slotLevel: 2,
      targetIds: [target.id],
      casterChoice: { kind: 'variant', value: key },
    }).events;
    const applied = events.find((e) => e.type === 'ConditionApplied') as ConditionAppliedEvent | undefined;
    expect(applied).toBeDefined();
    expect(applied!.conditionId).toBe(expectedConditionId);
  });

  it('throws when no casterChoice is supplied', () => {
    const caster = buildCleric();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'enhance-ability',
        slotLevel: 2,
        targetIds: [target.id],
      }),
    ).toThrow(/casterChoice/);
  });

  it("throws when the variant key isn't in the spell's list", () => {
    const caster = buildCleric();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'enhance-ability',
        slotLevel: 2,
        targetIds: [target.id],
        casterChoice: { kind: 'variant', value: 'rats-cunning' },
      }),
    ).toThrow(/not in allowed list/);
  });
});
