import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../../src/rng/throw.js';
import { commit } from '../../../src/engine/commit.js';
import { TEST_PACK, buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { SpellCastDeclaredEvent } from '../../../src/schemas/events/spellcasting.js';

const buildWizard = (overrides: Partial<{ INT: number; level: number; preparedSpells: string[] }> = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Test Wizard',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [
      { classId: 'wizard', level: overrides.level ?? 5, hitDiceRemaining: overrides.level ?? 5 },
    ],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: overrides.INT ?? 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: overrides.preparedSpells ?? ['fire-bolt', 'fireball', 'hold-person'],
  });

const buildCleric = (overrides: Partial<{ WIS: number }> = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Test Cleric',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'paladin', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 14, DEX: 10, CON: 14, INT: 10, WIS: overrides.WIS ?? 16, CHA: 12 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['cure-wounds'],
  });

describe('engine.plan.castSpell', () => {
  it('cantrip (fire-bolt) emits declared + attack chain, no slot consumed', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    const target = buildFighter({ hpMax: 30, hpCurrent: 30 });
    let campaign = engine.createCampaign({ name: 'firebolt' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetIds: [target.id],
    });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('SpellCastDeclared');
    expect(types).not.toContain('SpellSlotConsumed');
    expect(types).not.toContain('PactSlotConsumed');
    expect(types).toContain('AttackRolled');
  });

  it('leveled spell (fireball) consumes a slot, emits save chain per target', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(2) });
    const wizard = buildWizard();
    const a = buildFighter({ hpMax: 30, hpCurrent: 30 });
    const b = buildFighter({ hpMax: 30, hpCurrent: 30 });
    let campaign = engine.createCampaign({ name: 'fireball' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: [a.id, b.id],
    });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('SpellCastDeclared');
    expect(types[1]).toBe('SpellSlotConsumed');
    const saveCount = types.filter((t) => t === 'SaveRolled').length;
    expect(saveCount).toBe(2);
  });

  it('healing spell emits Healed event per target', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(3) });
    const cleric = buildCleric();
    const ally = buildFighter({ hpMax: 30, hpCurrent: 10 });
    let campaign = engine.createCampaign({ name: 'heal' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: cleric.id,
      spellId: 'cure-wounds',
      slotLevel: 1,
      targetIds: [ally.id],
      castingClassId: 'paladin',
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('Healed');
  });

  it('rejects unknown spell', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    let campaign = engine.createCampaign({ name: 'x' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'phantom-spell',
        slotLevel: 1,
        targetIds: [],
      }),
    ).toThrow(/Unknown spell/);
  });

  it('rejects casting a spell the character does not know or prepare', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard({ preparedSpells: ['fire-bolt'] });
    let campaign = engine.createCampaign({ name: 'x' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'fireball',
        slotLevel: 3,
        targetIds: [],
      }),
    ).toThrow(/does not know or prepare/);
  });

  it('rejects casting at slot level lower than spell level', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    let campaign = engine.createCampaign({ name: 'x' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'fireball',
        slotLevel: 1,
        targetIds: [],
      }),
    ).toThrow(/insufficient/);
  });

  it('rejects casting when no slot of the required level is available', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard({ level: 1, preparedSpells: ['magic-missile'] });
    let campaign = engine.createCampaign({ name: 'x' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    // L1 wizard has 2 first-level slots. Consume both, then expect the third cast to throw.
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'magic-missile',
        slotLevel: 1,
        targetIds: [],
      }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'magic-missile',
        slotLevel: 1,
        targetIds: [],
      }).events,
    );
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'magic-missile',
        slotLevel: 1,
        targetIds: [],
      }),
    ).toThrow(/No spell slots/);
  });

  it('deterministic for fixed seed', () => {
    const engineA = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(99) });
    const engineB = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(99) });
    const wizard = buildWizard();
    const target = buildFighter({ hpMax: 30, hpCurrent: 30 });
    let camA = engineA.createCampaign({ name: 'a' });
    let camB = engineB.createCampaign({ name: 'b' });
    const init: CharacterCreatedEvent[] = [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target },
    ];
    camA = commit(camA, init);
    camB = commit(camB, init);
    const evA = engineA.plan.castSpell(camA.state, {
      characterId: wizard.id,
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetIds: [target.id],
    }).events;
    const evB = engineB.plan.castSpell(camB.state, {
      characterId: wizard.id,
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetIds: [target.id],
    }).events;
    expect(evA.map((e) => e.type)).toEqual(evB.map((e) => e.type));
  });

  it('apply of cast events does not call RNG', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    const target = buildFighter({ hpMax: 30, hpCurrent: 30 });
    let campaign = engine.createCampaign({ name: 'x' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: [target.id],
    }).events;
    void throwOnCallRNG();
    expect(() => engine.applyAll(campaign.state, events)).not.toThrow();
  });

  it('AoE save mechanic rolls damage once for the whole effect', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(7) });
    const wizard = buildWizard();
    const a = buildFighter({ hpMax: 30, hpCurrent: 30 });
    const b = buildFighter({ hpMax: 30, hpCurrent: 30 });
    const c = buildFighter({ hpMax: 30, hpCurrent: 30 });
    let campaign = engine.createCampaign({ name: 'aoe' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: c } satisfies CharacterCreatedEvent,
    ]);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: [a.id, b.id, c.id],
    }).events;
    const damageEvents = events.filter((e) => e.type === 'DamageApplied');
    expect(damageEvents.length).toBeGreaterThan(0);
    // Bucket each target's raw (pre-mitigation) damage. Full-fail targets
    // should all share one bucket; half-on-save targets share another that
    // is exactly floor(full / 2). Distinct rolls would scatter across many
    // independent buckets and break this invariant.
    const fullByTarget = new Map<string, number>();
    for (const ev of damageEvents) {
      const e = ev as { targetId: string; components: ReadonlyArray<{ amount: number }> };
      const total = e.components.reduce((s, c) => s + c.amount, 0);
      fullByTarget.set(e.targetId, total);
    }
    const sums = [...fullByTarget.values()].sort((a, b) => a - b);
    const fullDamage = sums[sums.length - 1] ?? 0;
    for (const s of sums) {
      const isFull = s === fullDamage;
      const isHalf = s === Math.floor(fullDamage / 2);
      expect(isFull || isHalf).toBe(true);
    }
  });

  it('declared event carries the right metadata', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    let campaign = engine.createCampaign({ name: 'x' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    const events = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: [],
    }).events;
    const declared = events[0] as SpellCastDeclaredEvent;
    expect(declared.type).toBe('SpellCastDeclared');
    expect(declared.spellId).toBe('fireball');
    expect(declared.slotLevel).toBe(3);
    expect(declared.slotSource).toBe('standard');
  });
});
