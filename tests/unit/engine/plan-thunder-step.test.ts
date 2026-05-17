// Slice 128 — dedicated planThunderStep planner.
//
// RAW 2024: 3rd-level conjuration, Action, range Self. Caster + one
// willing creature within 5 ft teleport up to 90 ft to unoccupied
// spaces. Each creature within 10 ft of the *origin* square (caster
// and ally excluded) makes a CON save against the caster's spell save
// DC, taking 3d10 thunder on a failed save or half on success. Higher
// levels: +1d10 per slot above 3rd.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';
import type { CombatantMovedEvent } from '../../../src/schemas/events/movement.js';
import type { SpellSlotConsumedEvent } from '../../../src/schemas/events/spellcasting.js';

const buildSorcerer = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Caster',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'sorcerer', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: 38, max: 38, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['thunder-step'],
  });

const buildAlly = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 44, max: 44, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const buildBystander = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 20, max: 20, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

interface SeededScene {
  readonly engine: ReturnType<typeof createEngine>;
  readonly campaign: Campaign;
  readonly encounterId: string;
  readonly casterId: string;
  readonly allyId: string;
  readonly bystanderInRangeId: string;
  readonly bystanderOutOfRangeId: string;
}

// Positions are stored in feet (chebyshev distance returns feet, not cells).
// Layout:
//   Caster at (50, 50), Ally at (55, 50)        -> ally 5 ft from caster (RAW max)
//   Bystander in range at (55, 55)              -> 5 ft from caster (within 10 ft AoE)
//   Bystander out of range at (50, 80)          -> 30 ft from caster (outside 10 ft AoE)
const seedScene = (seed = 1): SeededScene => {
  const PACK = loadStarterPack();
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  const caster = buildSorcerer();
  const ally = buildAlly('Ally');
  const inRange = buildBystander('NearBystander');
  const outOfRange = buildBystander('FarBystander');
  let campaign = engine.createCampaign({ name: 'thunder-step' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: inRange } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: outOfRange } satisfies CharacterCreatedEvent,
  ]);
  const created = engine.plan.createEncounter(campaign.state, {
    combatantIds: [caster.id, ally.id, inRange.id, outOfRange.id],
  });
  campaign = commit(campaign, created.events);
  campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events);
  campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events);
  campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId }).events);
  // Advance turns until the caster is active.
  for (let i = 0; i < 4; i++) {
    const enc = campaign.state.encounters[created.encounterId]!;
    const active = enc.combatants[enc.activeIndex]?.combatantId;
    if (active === caster.id) break;
    campaign = commit(campaign, engine.plan.advanceTurn(campaign.state, { encounterId: created.encounterId }).events);
  }
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CombatantMoved',
      encounterId: created.encounterId,
      combatantId: caster.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 50, y: 50 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CombatantMoved',
      encounterId: created.encounterId,
      combatantId: ally.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 55, y: 50 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CombatantMoved',
      encounterId: created.encounterId,
      combatantId: inRange.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 55, y: 55 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CombatantMoved',
      encounterId: created.encounterId,
      combatantId: outOfRange.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 50, y: 80 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
  ]);
  return {
    engine,
    campaign,
    encounterId: created.encounterId,
    casterId: caster.id,
    allyId: ally.id,
    bystanderInRangeId: inRange.id,
    bystanderOutOfRangeId: outOfRange.id,
  };
};

describe('planThunderStep', () => {
  it('emits cast + slot + action + per-affected save + damage + caster move + ally move', () => {
    const scene = seedScene();
    const { events } = scene.engine.plan.thunderStep(scene.campaign.state, {
      casterId: scene.casterId,
      to: { x: 125, y: 50 }, // 75 ft from origin (within 90)
      ally: { combatantId: scene.allyId, to: { x: 125, y: 55 } },
    });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('SpellCastDeclared');
    expect(types[1]).toBe('SpellSlotConsumed');
    expect(types[2]).toBe('ActionEconomyConsumed');
    // SaveRolled + DamageApplied land for the in-range bystander only.
    const saves = events.filter((e): e is SaveRolledEvent => e.type === 'SaveRolled');
    expect(saves).toHaveLength(1);
    const [save] = saves;
    expect(save!.targetId).toBe(scene.bystanderInRangeId);
    expect(save!.ability).toBe('CON');
    // Two CombatantMoved at the tail (caster + ally) in that order.
    const moves = events.filter((e): e is CombatantMovedEvent => e.type === 'CombatantMoved');
    expect(moves).toHaveLength(2);
    const [casterMove, allyMove] = moves;
    expect(casterMove!.combatantId).toBe(scene.casterId);
    expect(allyMove!.combatantId).toBe(scene.allyId);
    expect(casterMove!.feetTraveled).toBe(0);
  });

  it('excludes the caster and ally from the AoE; out-of-range bystander also untouched', () => {
    const scene = seedScene();
    const { events } = scene.engine.plan.thunderStep(scene.campaign.state, {
      casterId: scene.casterId,
      to: { x: 125, y: 50 },
      ally: { combatantId: scene.allyId, to: { x: 125, y: 55 } },
    });
    const damages = events.filter((e): e is DamageAppliedEvent => e.type === 'DamageApplied');
    const damagedIds = damages.map((d) => d.targetId);
    expect(damagedIds).not.toContain(scene.casterId);
    expect(damagedIds).not.toContain(scene.allyId);
    expect(damagedIds).not.toContain(scene.bystanderOutOfRangeId);
    expect(damagedIds).toContain(scene.bystanderInRangeId);
  });

  it('no ally argument means no ally move and no enforcement', () => {
    const scene = seedScene();
    const { events } = scene.engine.plan.thunderStep(scene.campaign.state, {
      casterId: scene.casterId,
      to: { x: 125, y: 50 },
    });
    const moves = events.filter((e): e is CombatantMovedEvent => e.type === 'CombatantMoved');
    expect(moves).toHaveLength(1);
    expect(moves[0]!.combatantId).toBe(scene.casterId);
  });

  it('rejects destinations beyond 90 ft from origin', () => {
    const scene = seedScene();
    expect(() =>
      scene.engine.plan.thunderStep(scene.campaign.state, {
        casterId: scene.casterId,
        to: { x: 200, y: 50 }, // 150 ft from (50, 50), well beyond 90
      }),
    ).toThrow(/90ft/);
  });

  it('rejects an ally that is not within 5 ft of the caster', () => {
    const scene = seedScene();
    expect(() =>
      scene.engine.plan.thunderStep(scene.campaign.state, {
        casterId: scene.casterId,
        to: { x: 125, y: 50 },
        // bystanderOutOfRangeId is at (50, 80) = 30 ft from caster's
        // (50, 50) origin, well beyond the 5 ft proximity requirement.
        ally: { combatantId: scene.bystanderOutOfRangeId, to: { x: 125, y: 55 } },
      }),
    ).toThrow(/within 5ft/);
  });

  it('rejects an ally destination identical to the caster destination', () => {
    const scene = seedScene();
    expect(() =>
      scene.engine.plan.thunderStep(scene.campaign.state, {
        casterId: scene.casterId,
        to: { x: 125, y: 50 },
        ally: { combatantId: scene.allyId, to: { x: 125, y: 50 } },
      }),
    ).toThrow(/same space/);
  });

  it('rejects when slotLevel < 3', () => {
    const scene = seedScene();
    expect(() =>
      scene.engine.plan.thunderStep(scene.campaign.state, {
        casterId: scene.casterId,
        to: { x: 125, y: 50 },
        slotLevel: 2,
      }),
    ).toThrow(/3rd-level/);
  });

  it('higher-level slot consumes the higher slot (scaling adds dice per slot above 3rd)', () => {
    const scene = seedScene();
    const { events } = scene.engine.plan.thunderStep(scene.campaign.state, {
      casterId: scene.casterId,
      to: { x: 125, y: 50 },
      slotLevel: 5,
    });
    const slot = events.find((e): e is SpellSlotConsumedEvent => e.type === 'SpellSlotConsumed');
    expect(slot?.slotLevel).toBe(5);
  });

  it('half damage on a successful save, full on failure', () => {
    // Seed-walk to find one of each. With a 10-CON bystander (mod +0,
    // level 1, no prof on CON), and a sorcerer-5 spell DC of 16 (8 + 3
    // prof + 5 CHA mod), the save lands rarely (need natural 16+).
    let foundSuccess = false;
    let foundFailure = false;
    for (let seed = 1; seed < 200 && (!foundSuccess || !foundFailure); seed += 1) {
      const scene = seedScene(seed);
      const { events } = scene.engine.plan.thunderStep(scene.campaign.state, {
        casterId: scene.casterId,
        to: { x: 125, y: 50 },
      });
      const save = events.find(
        (e): e is SaveRolledEvent =>
          e.type === 'SaveRolled' && e.targetId === scene.bystanderInRangeId,
      );
      const damage = events.find(
        (e): e is DamageAppliedEvent =>
          e.type === 'DamageApplied' && e.targetId === scene.bystanderInRangeId,
      );
      if (save === undefined || damage === undefined) continue;
      const total = damage.components.reduce((s, c) => s + c.amount, 0);
      if (save.success) {
        foundSuccess = true;
        // 3d10 minimum=3, max=30; halved range is [1, 15].
        expect(total).toBeGreaterThanOrEqual(1);
        expect(total).toBeLessThanOrEqual(15);
      } else {
        foundFailure = true;
        // 3d10 full damage range is [3, 30].
        expect(total).toBeGreaterThanOrEqual(3);
        expect(total).toBeLessThanOrEqual(30);
      }
    }
    expect(foundSuccess).toBe(true);
    expect(foundFailure).toBe(true);
  });
});
