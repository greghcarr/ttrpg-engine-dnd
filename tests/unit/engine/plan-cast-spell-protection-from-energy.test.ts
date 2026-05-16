import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { mitigateDamage } from '../../../src/derive/damage-mitigation.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildCleric = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Warden',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 16, CHA: 12 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: [],
    preparedSpells: ['protection-from-energy'],
  });

const buildAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ally',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

describe('engine.plan.castSpell (Protection from Energy: caster-chosen variant)', () => {
  it('applies the chosen-element protection condition to the target', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric();
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'pfe' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: cleric.id,
      spellId: 'protection-from-energy',
      slotLevel: 3,
      targetIds: [ally.id],
      casterChoice: { kind: 'variant', value: 'fire' },
    }).events;
    const applied = events.find(
      (e): e is Extract<typeof events[number], { type: 'ConditionApplied' }> =>
        e.type === 'ConditionApplied' && e.conditionId === 'protection-fire-active',
    );
    expect(applied).toBeDefined();
    expect(applied!.targetId).toBe(ally.id);
  });

  it('halves Fire damage applied to the target while the condition is active', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(2) });
    const cleric = buildCleric();
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'pfe-mitigate' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(campaign, engine.plan.castSpell(campaign.state, {
      characterId: cleric.id,
      spellId: 'protection-from-energy',
      slotLevel: 3,
      targetIds: [ally.id],
      casterChoice: { kind: 'variant', value: 'fire' },
    }).events);

    const protectedAlly = campaign.state.characters[ally.id]!;
    const result = mitigateDamage({
      character: protectedAlly,
      itemInstances: campaign.state.itemInstances,
      content: engine.content,
      rawComponents: [
        { amount: 20, type: 'fire' },
        { amount: 20, type: 'cold' },
      ],
    });
    expect(result[0]).toEqual({ amount: 10, type: 'fire', rawAmount: 20, mitigation: 'resisted' });
    expect(result[1]).toEqual({ amount: 20, type: 'cold' });
  });

  it('rejects an unknown variant key', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(3) });
    const cleric = buildCleric();
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'pfe-bad' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'protection-from-energy',
        slotLevel: 3,
        targetIds: [ally.id],
        casterChoice: { kind: 'variant', value: 'radiant' },
      }),
    ).toThrow(/radiant/);
  });
});
