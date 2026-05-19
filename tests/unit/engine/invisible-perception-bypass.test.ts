// Slice 273 — Invisible condition perception-bypass on both arms.
//
// RAW (SRD 5.2.1 Invisible): "Attack rolls against you have
// Disadvantage, and your attack rolls have Advantage. If a creature
// can somehow see you, you don't gain this benefit against that
// creature."
//
// Pre-273 only the bearer's-own-advantage arm was wired and it
// applied unconditionally. This slice (a) gates the bearer's
// advantage on `target.canLocateInvisible=false` and (b) adds the
// missing ImposeDisadvantageOnAttackers arm, gated on
// `attacker.canLocateInvisible=false`. Both facts populated
// symmetrically in the attack planner (blindsight / tremorsense /
// truesight; Blinded does NOT bypass — it can't see anything).
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

const buildCombatant = (name: string, swordId: string, featsTaken: string[] = []): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken,
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const applyInvisible = (targetId: string): ConditionAppliedEvent => ({
  id: eventId(),
  at: isoTimestamp(),
  type: 'ConditionApplied',
  targetId: targetId as never,
  conditionId: 'invisible',
  appliedConditionId: newAppliedConditionId(),
});

const planAttack = (
  attacker: Character,
  target: Character,
  swordId: string,
  extraEvents: ReadonlyArray<ConditionAppliedEvent> = [],
): AttackRolledEvent => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(273) });
  let campaign: Campaign = engine.createCampaign({ name: 'invisible-bypass' });
  const sword = makeItemInstance('longsword', { id: swordId });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ...extraEvents,
  ]);
  const { events } = engine.plan.attack(campaign.state, {
    attackerId: attacker.id,
    targetId: target.id,
    weaponInstanceId: swordId,
  });
  return events.find((e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled')!;
};

describe('slice 273: Invisible condition perception-bypass', () => {
  describe('bearer-attacks-someone (SetAdvantage on attack)', () => {
    it('an invisible attacker rolls with advantage against a sight-only target', () => {
      const swordId = newCharacterId();
      const attacker = buildCombatant('Invisible attacker', swordId);
      const target = buildCombatant('Sight-only target', swordId);
      const attack = planAttack(attacker, target, swordId, [applyInvisible(attacker.id)]);
      expect(attack.used).toBe('advantage');
      expect(attack.d20).toHaveLength(2);
    });

    it('an invisible attacker rolls with NO advantage when the target has truesight', () => {
      const swordId = newCharacterId();
      const attacker = buildCombatant('Invisible attacker', swordId);
      const target = buildCombatant('Truesight target', swordId, ['boon-of-truesight']);
      const attack = planAttack(attacker, target, swordId, [applyInvisible(attacker.id)]);
      expect(attack.used).toBe('none');
      expect(attack.d20).toHaveLength(1);
    });
  });

  describe('attacker-targets-bearer (ImposeDisadvantageOnAttackers)', () => {
    it('a sight-only attacker rolls with disadvantage against an invisible target', () => {
      const swordId = newCharacterId();
      const attacker = buildCombatant('Sight-only attacker', swordId);
      const target = buildCombatant('Invisible target', swordId);
      const attack = planAttack(attacker, target, swordId, [applyInvisible(target.id)]);
      expect(attack.used).toBe('disadvantage');
      expect(attack.d20).toHaveLength(2);
    });

    it('a truesight attacker rolls with NO disadvantage against an invisible target', () => {
      const swordId = newCharacterId();
      const attacker = buildCombatant('Truesight attacker', swordId, ['boon-of-truesight']);
      const target = buildCombatant('Invisible target', swordId);
      const attack = planAttack(attacker, target, swordId, [applyInvisible(target.id)]);
      expect(attack.used).toBe('none');
      expect(attack.d20).toHaveLength(1);
    });
  });

  describe('baseline (no Invisible)', () => {
    it('neither party invisible produces a flat 1-d20 roll', () => {
      const swordId = newCharacterId();
      const attacker = buildCombatant('Attacker', swordId);
      const target = buildCombatant('Target', swordId);
      const attack = planAttack(attacker, target, swordId);
      expect(attack.used).toBe('none');
      expect(attack.d20).toHaveLength(1);
    });
  });
});
