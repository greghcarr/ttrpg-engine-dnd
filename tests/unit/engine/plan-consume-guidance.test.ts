import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildCleric = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Cleric',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'cleric', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 12, DEX: 10, CON: 14, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 24, max: 24, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildAlly = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'rogue', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 12, DEX: 16, CON: 12, INT: 12, WIS: 12, CHA: 10 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const seedGuidance = (rng = seededRNG(42)) => {
  const PACK = loadStarterPack();
  const engine = createEngine({ contentPacks: [PACK], rng });
  const cleric = buildCleric(['guidance']);
  const ally = buildAlly('Ally');
  let campaign = engine.createCampaign({ name: 'guidance' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
  ]);
  campaign = commit(
    campaign,
    engine.plan.castSpell(campaign.state, {
      characterId: cleric.id,
      spellId: 'guidance',
      slotLevel: 0,
      targetIds: [ally.id],
    }).events,
  );
  return { engine, campaign, casterId: cleric.id, targetId: ally.id };
};

describe('Guidance: consume-on-use', () => {
  it('applies the guided condition on cast', () => {
    const { campaign, targetId } = seedGuidance();
    const t = campaign.state.characters[targetId];
    expect(t?.appliedConditions.some((c) => c.conditionId === 'guided')).toBe(true);
  });

  it('consuming guidance rolls a d4 (1..4) and emits GuidanceUsed + ConcentrationBroken', () => {
    const { engine, campaign, targetId } = seedGuidance();
    const outcome = engine.plan.consumeGuidance(campaign.state, { targetId });
    expect(outcome.d4).toBeGreaterThanOrEqual(1);
    expect(outcome.d4).toBeLessThanOrEqual(4);
    const types = outcome.events.map((e) => e.type);
    expect(types).toEqual(['GuidanceUsed', 'ConcentrationBroken']);
    const broken = outcome.events.find((e) => e.type === 'ConcentrationBroken');
    if (broken?.type === 'ConcentrationBroken') {
      expect(broken.reason).toBe('used');
    }
  });

  it('committing the consume events clears the guided condition and caster concentration', () => {
    const { engine, campaign, casterId, targetId } = seedGuidance();
    const outcome = engine.plan.consumeGuidance(campaign.state, { targetId });
    const after = commit(campaign, outcome.events);
    expect(
      after.state.characters[targetId]?.appliedConditions.some((c) => c.conditionId === 'guided'),
    ).toBe(false);
    expect(after.state.characters[casterId]?.concentrationEffectId).toBeUndefined();
  });

  it('rejects when target does not have the guided condition', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const ally = buildAlly('Ally');
    let campaign = engine.createCampaign({ name: 'no-guidance' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    expect(() => engine.plan.consumeGuidance(campaign.state, { targetId: ally.id })).toThrow(/guided/);
  });
});
