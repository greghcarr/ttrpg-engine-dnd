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

// Tests Enlarge/Reduce's cast-time variant choice. Bug this prevents:
// without the casterChoosesVariant plumbing, a buff spell with two
// possible target conditions either silently applies the wrong one
// or fails to validate. With the primitive in place, the caster picks
// 'enlarge' or 'reduce' at cast and the planner routes to the matching
// condition.

const PACK = loadStarterPack();

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Variant Tester',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
    preparedSpells: ['enlarge-reduce'],
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildCampaign = (caster: Character, target: Character) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
  let campaign: Campaign = engine.createCampaign({ name: 'enlarge-reduce' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign };
};

describe('Enlarge/Reduce caster-chosen variant', () => {
  it("the 'enlarge' variant applies enlarged-active", () => {
    const caster = buildWizard();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: caster.id,
      spellId: 'enlarge-reduce',
      slotLevel: 2,
      targetIds: [target.id],
      casterChoice: { kind: 'variant', value: 'enlarge' },
    }).events;
    const applied = events.find((e) => e.type === 'ConditionApplied') as ConditionAppliedEvent | undefined;
    expect(applied).toBeDefined();
    expect(applied!.conditionId).toBe('enlarged-active');
  });

  it("the 'reduce' variant applies reduced-active", () => {
    const caster = buildWizard();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: caster.id,
      spellId: 'enlarge-reduce',
      slotLevel: 2,
      targetIds: [target.id],
      casterChoice: { kind: 'variant', value: 'reduce' },
    }).events;
    const applied = events.find((e) => e.type === 'ConditionApplied') as ConditionAppliedEvent | undefined;
    expect(applied).toBeDefined();
    expect(applied!.conditionId).toBe('reduced-active');
  });

  it('throws when no casterChoice is supplied', () => {
    const caster = buildWizard();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'enlarge-reduce',
        slotLevel: 2,
        targetIds: [target.id],
      }),
    ).toThrow(/casterChoice/);
  });

  it("throws when the variant key isn't in the spell's list", () => {
    const caster = buildWizard();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'enlarge-reduce',
        slotLevel: 2,
        targetIds: [target.id],
        casterChoice: { kind: 'variant', value: 'huge' },
      }),
    ).toThrow(/not in allowed list/);
  });

  it("throws when the choice kind is wrong (damageType instead of variant)", () => {
    const caster = buildWizard();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'enlarge-reduce',
        slotLevel: 2,
        targetIds: [target.id],
        casterChoice: { kind: 'damageType', value: 'fire' },
      }),
    ).toThrow(/'variant'/);
  });
});
