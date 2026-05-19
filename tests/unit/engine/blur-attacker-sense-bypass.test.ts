// Slice 271 — Blur spell attacker-sense bypass.
//
// RAW (Blur): "Any creature has Disadvantage on attack rolls against
// it. An attacker is immune to this effect if it doesn't rely on
// sight, as with Blindsight, or can see through illusions, as with
// Truesight." Pre-271 the `blurred-active` condition imposed
// disadvantage unconditionally. This slice gates the
// `ImposeDisadvantageOnAttackers` entry on
// `attacker.bypassesSightIllusion === false`; the attack planner
// populates the fact (blindsight | tremorsense | truesight | Blinded).
// Mirrors the slice-127 Mirror Image bypass logic.
import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId, newAppliedConditionId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bearer',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

const buildAttacker = (weaponId: string, overrides: Partial<Character> = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Attacker',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 8, WIS: 10, CHA: 8 },
    hp: { current: 11, max: 11, temp: 0 },
    featsTaken: [],
    inventory: [weaponId],
    equipped: { mainHand: weaponId, attuned: [] },
    ...overrides,
  });

const applyBlur = (targetId: string): ConditionAppliedEvent => ({
  id: eventId(),
  at: isoTimestamp(),
  type: 'ConditionApplied',
  targetId: targetId as never,
  conditionId: 'blurred-active',
  appliedConditionId: newAppliedConditionId(),
});

const setupAttack = (
  attacker: Character,
  target: Character,
  weapon: ReturnType<typeof makeItemInstance>,
  extraEvents: ReadonlyArray<ConditionAppliedEvent> = [],
) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(271) });
  let campaign: Campaign = engine.createCampaign({ name: 'blur-bypass' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: weapon },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    applyBlur(target.id),
    ...extraEvents,
  ]);
  const { events } = engine.plan.attack(campaign.state, {
    attackerId: attacker.id,
    targetId: target.id,
    weaponInstanceId: weapon.id,
  });
  return events.find((e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled')!;
};

describe('slice 271: Blur ImposeDisadvantageOnAttackers respects attacker-sense bypass', () => {
  it('baseline (sight-only attacker) rolls with disadvantage against a blurred target', () => {
    const weapon = makeItemInstance('longsword');
    const attacker = buildAttacker(weapon.id);
    const target = buildTarget();
    const attack = setupAttack(attacker, target, weapon);
    expect(attack.used).toBe('disadvantage');
    expect(attack.d20).toHaveLength(2);
  });

  it('a truesight attacker (Boon of Truesight) bypasses Blur (no disadvantage)', () => {
    const weapon = makeItemInstance('longsword');
    const attacker = buildAttacker(weapon.id, { featsTaken: ['boon-of-truesight'] });
    const target = buildTarget();
    const attack = setupAttack(attacker, target, weapon);
    expect(attack.used).toBe('none');
    expect(attack.d20).toHaveLength(1);
  });

  it('an attacker without Blur on the target rolls with no advantage state', () => {
    const weapon = makeItemInstance('longsword');
    const attacker = buildAttacker(weapon.id);
    const target = buildTarget();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(271) });
    let campaign: Campaign = engine.createCampaign({ name: 'blur-baseline-no-condition' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: weapon },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    ]);
    const events = engine.plan.attack(campaign.state, {
      attackerId: attacker.id,
      targetId: target.id,
      weaponInstanceId: weapon.id,
    }).events;
    const attack = events.find((e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled')!;
    expect(attack.used).toBe('none');
    expect(attack.d20).toHaveLength(1);
  });
});
