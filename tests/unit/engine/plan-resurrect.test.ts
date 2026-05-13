import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { CharacterResurrectedEvent } from '../../../src/schemas/events/resurrection.js';
import type { SpellSlotConsumedEvent } from '../../../src/schemas/events/spellcasting.js';

const buildCaster = (
  overrides: { preparedSpells?: string[]; classLevel?: number; classId?: string } = {},
): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Caster',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [
      {
        classId: overrides.classId ?? 'wizard',
        level: overrides.classLevel ?? 5,
        hitDiceRemaining: overrides.classLevel ?? 5,
      },
    ],
    abilityScores: { STR: 10, DEX: 10, CON: 12, INT: 18, WIS: 14, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: overrides.preparedSpells ?? ['revivify'],
  });

const setup = (caster: Character) => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
  const downed = buildFighter({ hpMax: 30, hpCurrent: 0 });
  let campaign = engine.createCampaign({ name: 'resurrect' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: downed } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign, downed };
};

describe('engine.plan.resurrect', () => {
  it('via spell-slot: emits declared, slot consumed, and resurrected', () => {
    const caster = buildCaster();
    const { engine, campaign, downed } = setup(caster);
    const { events } = engine.plan.resurrect(campaign.state, {
      casterId: caster.id,
      targetId: downed.id,
      spell: 'revivify',
      slotLevel: 3,
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual(['SpellCastDeclared', 'SpellSlotConsumed', 'CharacterResurrected']);
    const consumed = events[1] as SpellSlotConsumedEvent;
    expect(consumed.slotLevel).toBe(3);
    const resurrected = events[2] as CharacterResurrectedEvent;
    expect(resurrected.hpAfter).toBe(1);
    expect(resurrected.byCharacterId).toBe(caster.id);
  });

  it('via scroll: emits only the resurrected event, no slot consumed', () => {
    const caster = buildCaster({ preparedSpells: [] });
    const { engine, campaign, downed } = setup(caster);
    const { events } = engine.plan.resurrect(campaign.state, {
      casterId: caster.id,
      targetId: downed.id,
      spell: 'revivify',
      via: 'scroll',
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual(['CharacterResurrected']);
  });

  it('rejects when caster does not know or prepare the spell', () => {
    const caster = buildCaster({ preparedSpells: ['fire-bolt'] });
    const { engine, campaign, downed } = setup(caster);
    expect(() =>
      engine.plan.resurrect(campaign.state, {
        casterId: caster.id,
        targetId: downed.id,
        spell: 'revivify',
        slotLevel: 3,
      }),
    ).toThrow(/does not know or prepare/);
  });

  it('rejects when slot level is below the spell minimum', () => {
    const caster = buildCaster();
    const { engine, campaign, downed } = setup(caster);
    expect(() =>
      engine.plan.resurrect(campaign.state, {
        casterId: caster.id,
        targetId: downed.id,
        spell: 'revivify',
        slotLevel: 2,
      }),
    ).toThrow(/requires a level 3 slot/);
  });

  it('rejects when no slot of the required level is available', () => {
    // Wizard level 1 only has level-1 slots, so revivify (min level 3) is impossible.
    const caster = buildCaster({ classLevel: 1 });
    const { engine, campaign, downed } = setup(caster);
    expect(() =>
      engine.plan.resurrect(campaign.state, {
        casterId: caster.id,
        targetId: downed.id,
        spell: 'revivify',
        slotLevel: 3,
      }),
    ).toThrow(/No spell slots of level 3/);
  });

  it('rejects when target is not at 0 HP', () => {
    const caster = buildCaster();
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const alive = buildFighter({ hpMax: 30, hpCurrent: 10 });
    let campaign = engine.createCampaign({ name: 'resurrect' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alive } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.resurrect(campaign.state, {
        casterId: caster.id,
        targetId: alive.id,
        spell: 'revivify',
        slotLevel: 3,
      }),
    ).toThrow(/not at 0 HP/);
  });

  it('higher-tier spells require higher minimum slot levels', () => {
    const caster = buildCaster({ preparedSpells: ['true-resurrection'] });
    const { engine, campaign, downed } = setup(caster);
    expect(() =>
      engine.plan.resurrect(campaign.state, {
        casterId: caster.id,
        targetId: downed.id,
        spell: 'true-resurrection',
        slotLevel: 5,
      }),
    ).toThrow(/requires a level 9 slot/);
  });
});
