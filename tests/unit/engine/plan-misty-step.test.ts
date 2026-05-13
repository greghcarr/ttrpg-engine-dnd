import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildSorcerer = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Sorcerer',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'sorcerer', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: 38, max: 38, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildDummy = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Dummy',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 12, max: 12, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const seedMistyStepEncounter = () => {
  const PACK = loadStarterPack();
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
  const caster = buildSorcerer(['misty-step']);
  const dummy = buildDummy();
  let campaign = engine.createCampaign({ name: 'misty' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dummy } satisfies CharacterCreatedEvent,
  ]);
  const created = engine.plan.createEncounter(campaign.state, {
    combatantIds: [caster.id, dummy.id],
  });
  campaign = commit(campaign, created.events);
  campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events);
  // Set the caster's position before encounter starts so movement has a frame of reference.
  // For starter encounters there's a CombatantMoved we can issue post-start.
  campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events);
  campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId }).events);
  // Set caster position manually via CombatantMoved (or initial seed).
  const encounter = campaign.state.encounters[created.encounterId]!;
  const activeId = encounter.combatants[encounter.activeIndex]?.combatantId;
  // Make sure caster is the active combatant.
  if (activeId !== caster.id) {
    campaign = commit(campaign, engine.plan.advanceTurn(campaign.state, { encounterId: created.encounterId }).events);
  }
  // Initial position for the caster.
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CombatantMoved',
      encounterId: created.encounterId,
      combatantId: caster.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 5, y: 5 },
      feetTraveled: 0,
    },
  ]);
  return { engine, campaign, encounterId: created.encounterId, casterId: caster.id };
};

describe('planMistyStep', () => {
  it('emits cast + slot + bonus-action + CombatantMoved within 30 ft', () => {
    const { engine, campaign, casterId } = seedMistyStepEncounter();
    const { events } = engine.plan.mistyStep(campaign.state, {
      casterId,
      to: { x: 10, y: 5 }, // 5 cells = 25 ft from (5,5) — within range
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'SpellCastDeclared',
      'SpellSlotConsumed',
      'ActionEconomyConsumed',
      'CombatantMoved',
    ]);
    const moved = events.find((e) => e.type === 'CombatantMoved');
    if (moved?.type === 'CombatantMoved') {
      expect(moved.feetTraveled).toBe(0); // teleport doesn't spend normal movement
    }
  });

  it('rejects destinations beyond 30 ft', () => {
    const { engine, campaign, casterId } = seedMistyStepEncounter();
    expect(() =>
      engine.plan.mistyStep(campaign.state, {
        casterId,
        to: { x: 50, y: 50 },
      }),
    ).toThrow(/30/);
  });

  it('rejects when the caster does not know Misty Step', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildSorcerer([]); // no misty-step prepared
    let campaign = engine.createCampaign({ name: 'no-misty' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.mistyStep(campaign.state, {
        casterId: caster.id,
        to: { x: 5, y: 5 },
      }),
    ).toThrow(/Misty Step/);
  });
});
