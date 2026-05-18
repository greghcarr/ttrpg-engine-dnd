import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId, newAppliedConditionId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent, ConditionRemovedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 202: Monk L10 Self-Restoration. RAW: "you can remove one of
// the following conditions from yourself at the end of each of your
// turns: Charmed, Frightened, or Poisoned."

const PACK = loadStarterPack();

const buildMonk = (level: number = 10): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Kai',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level, hitDiceRemaining: level }],
    abilityScores: { STR: 12, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const setup = (
  conditionsToApply: ReadonlyArray<string> = [],
  level: number = 10,
) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
  const monk = buildMonk(level);
  let campaign: Campaign = engine.createCampaign({ name: 'self-restoration' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: monk } satisfies CharacterCreatedEvent,
    ...conditionsToApply.map<ConditionAppliedEvent>((conditionId) => ({
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: monk.id,
      conditionId,
      appliedConditionId: newAppliedConditionId(),
    })),
  ]);
  return { engine, campaign, monk };
};

describe('engine.plan.selfRestoration', () => {
  it('removes Charmed when the monk is currently Charmed', () => {
    const { engine, campaign, monk } = setup(['charmed']);
    const result = engine.plan.selfRestoration(campaign.state, {
      characterId: monk.id,
      conditionId: 'charmed',
    });
    const removed = result.events.find((e) => e.type === 'ConditionRemoved') as ConditionRemovedEvent | undefined;
    expect(removed).toBeDefined();
    expect(removed!.conditionId).toBe('charmed');
    const next = commit(campaign, result.events);
    expect(next.state.characters[monk.id]!.appliedConditions.some((c) => c.conditionId === 'charmed')).toBe(false);
  });

  it('removes Frightened and Poisoned on independent invocations', () => {
    const { engine, campaign: c0, monk } = setup(['frightened', 'poisoned']);
    const r1 = engine.plan.selfRestoration(c0.state, { characterId: monk.id, conditionId: 'frightened' });
    const c1 = commit(c0, r1.events);
    expect(c1.state.characters[monk.id]!.appliedConditions.some((c) => c.conditionId === 'frightened')).toBe(false);
    expect(c1.state.characters[monk.id]!.appliedConditions.some((c) => c.conditionId === 'poisoned')).toBe(true);

    const r2 = engine.plan.selfRestoration(c1.state, { characterId: monk.id, conditionId: 'poisoned' });
    const c2 = commit(c1, r2.events);
    expect(c2.state.characters[monk.id]!.appliedConditions.some((c) => c.conditionId === 'poisoned')).toBe(false);
  });

  it('throws when asked to remove a condition outside Charmed/Frightened/Poisoned', () => {
    const { engine, campaign, monk } = setup(['stunned']);
    expect(() =>
      engine.plan.selfRestoration(campaign.state, {
        characterId: monk.id,
        conditionId: 'stunned',
      }),
    ).toThrow(/Charmed, Frightened, or Poisoned/);
  });

  it('throws when the monk does not currently carry the requested condition', () => {
    const { engine, campaign, monk } = setup([]);
    expect(() =>
      engine.plan.selfRestoration(campaign.state, {
        characterId: monk.id,
        conditionId: 'charmed',
      }),
    ).toThrow(/not currently affected/);
  });

  it('throws on a Monk L9 (no Self-Restoration yet)', () => {
    const { engine, campaign, monk } = setup(['poisoned'], 9);
    expect(() =>
      engine.plan.selfRestoration(campaign.state, {
        characterId: monk.id,
        conditionId: 'poisoned',
      }),
    ).toThrow(/does not have Self-Restoration/);
  });
});
