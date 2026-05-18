import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ConditionAppliedEvent,
} from '../../../src/schemas/events/combat.js';
import type { ResourceSpentEvent } from '../../../src/schemas/events/resources.js';
import type { ActionEconomyConsumedEvent } from '../../../src/schemas/events/action-economy.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import { mitigateDamage } from '../../../src/derive/damage-mitigation.js';

// Slice 209: Monk L18 Superior Defense. RAW: as a Bonus Action,
// spend 3 Focus Points (engine: `ki`) to gain Resistance to all
// damage except Force for 1 minute (10 rounds). Implemented via
// `planSuperiorDefense` + the `superior-defense-active` condition
// (12 GrantResistance entries covering every non-Force damage type).

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildMonk = (opts: { level?: number; kiCurrent?: number } = {}): Character => {
  const level = opts.level ?? 18;
  return CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Kai',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level, hitDiceRemaining: level }],
    abilityScores: { STR: 14, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    hp: { current: 100, max: 100, temp: 0 },
    featsTaken: [],
    resources: [{ resourceId: 'ki', current: opts.kiCurrent ?? 18, max: 18 }],
  });
};

describe('engine.plan.superiorDefense', () => {
  it('L18 monk with sufficient ki spends 3 + applies superior-defense-active', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(209) });
    const kai = buildMonk();
    let campaign: Campaign = engine.createCampaign({ name: 'superior-defense' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: kai } satisfies CharacterCreatedEvent,
    ]);
    const result = engine.plan.superiorDefense(campaign.state, { monkId: kai.id });
    const spend = result.events.find(
      (e): e is ResourceSpentEvent =>
        e.type === 'ResourceSpent' && (e as ResourceSpentEvent).resourceId === 'ki',
    );
    expect(spend?.amount).toBe(3);
    const applied = result.events.find(
      (e): e is ConditionAppliedEvent =>
        e.type === 'ConditionApplied' && (e as ConditionAppliedEvent).conditionId === 'superior-defense-active',
    );
    expect(applied).toBeDefined();

    campaign = commit(campaign, result.events);
    const after = campaign.state.characters[kai.id]!;
    expect(after.resources.find((r) => r.resourceId === 'ki')!.current).toBe(15);
    expect(after.appliedConditions.some((c) => c.conditionId === 'superior-defense-active')).toBe(true);
  });

  it('throws when ki is below the 3-point cost', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(209) });
    const kai = buildMonk({ kiCurrent: 2 });
    let campaign: Campaign = engine.createCampaign({ name: 'no-ki' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: kai } satisfies CharacterCreatedEvent,
    ]);
    expect(() => engine.plan.superiorDefense(campaign.state, { monkId: kai.id })).toThrow(/3 Focus Points/);
  });

  it('the active condition grants resistance to every non-Force damage type via mitigateDamage', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(209) });
    const kai = buildMonk();
    let campaign: Campaign = engine.createCampaign({ name: 'resistance' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: kai } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(campaign, engine.plan.superiorDefense(campaign.state, { monkId: kai.id }).events);

    const afterChar = campaign.state.characters[kai.id]!;
    const checkType = (type: 'fire' | 'force' | 'thunder' | 'psychic'): number => {
      const mitigated = mitigateDamage({
        character: afterChar,
        itemInstances: campaign.state.itemInstances,
        content: CONTENT,
        rawComponents: [{ amount: 20, type }],
      });
      return mitigated[0]!.amount;
    };
    // Non-force: halved.
    expect(checkType('fire')).toBe(10);
    expect(checkType('thunder')).toBe(10);
    expect(checkType('psychic')).toBe(10);
    // Force: NOT halved (the lone exception).
    expect(checkType('force')).toBe(20);
  });

  it('a non-Monk (L18) without the feature cannot invoke it (no ki resource)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(209) });
    const fighter = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Bob',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 18, hitDiceRemaining: 18 }],
      abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 100, max: 100, temp: 0 },
      featsTaken: [],
    });
    let campaign: Campaign = engine.createCampaign({ name: 'wrong-class' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    expect(() => engine.plan.superiorDefense(campaign.state, { monkId: fighter.id })).toThrow(/3 Focus Points/);
  });
});
