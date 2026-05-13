import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const ELK_FORM = {
  name: 'Elk',
  hp: 13,
  ac: 10,
  abilityScores: { STR: 16, DEX: 10, CON: 12, INT: 2, WIS: 10, CHA: 6 },
  speedFeet: 50,
};

const WOLF_FORM = {
  name: 'Wolf',
  hp: 11,
  ac: 13,
  abilityScores: { STR: 12, DEX: 15, CON: 12, INT: 3, WIS: 12, CHA: 6 },
  speedFeet: 40,
};

const TYRANNOSAURUS_FORM = {
  name: 'Tyrannosaurus Rex',
  hp: 136,
  ac: 13,
  abilityScores: { STR: 25, DEX: 10, CON: 19, INT: 2, WIS: 10, CHA: 9 },
  speedFeet: 50,
};

const buildWizard = (level: number, preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Wizard',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level, hitDiceRemaining: level }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: level * 6, max: level * 6, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildDruid = (level: number, wildShapeRemaining = 2): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Druid',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'druid', level, hitDiceRemaining: level }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 12, WIS: 18, CHA: 10 },
    hp: { current: level * 7, max: level * 7, temp: 0 },
    featsTaken: ['savage-attacker'],
    resources: [{ resourceId: 'wild-shape', current: wildShapeRemaining, max: 2 }],
  });

const buildTarget = (name: string, level = 3): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level, hitDiceRemaining: level }],
    abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 8 },
    hp: { current: level * 8, max: level * 8, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('planPolymorph', () => {
  it('willing target: emits cast + slot + concentration + PolymorphApplied', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildWizard(7, ['polymorph']);
    const ally = buildTarget('Ally', 3);
    let campaign = engine.createCampaign({ name: 'poly-willing' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const outcome = engine.plan.polymorph(campaign.state, {
      casterId: caster.id,
      targetId: ally.id,
      form: ELK_FORM,
      formCR: 0.25,
    });
    expect(outcome.resisted).toBe(false);
    const types = outcome.events.map((e) => e.type);
    expect(types).toContain('SpellCastDeclared');
    expect(types).toContain('SpellSlotConsumed');
    expect(types).toContain('ConcentrationStarted');
    expect(types).toContain('PolymorphApplied');
    expect(types).not.toContain('SaveRolled');
  });

  it('unwilling target with failed save: PolymorphApplied still fires', () => {
    const PACK = loadStarterPack();
    let found = false;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const caster = buildWizard(7, ['polymorph']);
      const enemy = buildTarget('Enemy', 3);
      let campaign = engine.createCampaign({ name: 'poly-unwilling' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: enemy } satisfies CharacterCreatedEvent,
      ]);
      const outcome = engine.plan.polymorph(campaign.state, {
        casterId: caster.id,
        targetId: enemy.id,
        form: WOLF_FORM,
        formCR: 0.25,
        unwilling: true,
      });
      const save = outcome.events.find((e) => e.type === 'SaveRolled');
      if (save?.type === 'SaveRolled' && save.success === false) {
        expect(outcome.resisted).toBe(false);
        expect(outcome.events.some((e) => e.type === 'PolymorphApplied')).toBe(true);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('unwilling target with successful save: no PolymorphApplied, slot still consumed', () => {
    const PACK = loadStarterPack();
    let found = false;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const caster = buildWizard(7, ['polymorph']);
      const enemy = buildTarget('Enemy', 3);
      let campaign = engine.createCampaign({ name: 'poly-resist' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: enemy } satisfies CharacterCreatedEvent,
      ]);
      const outcome = engine.plan.polymorph(campaign.state, {
        casterId: caster.id,
        targetId: enemy.id,
        form: WOLF_FORM,
        formCR: 0.25,
        unwilling: true,
      });
      const save = outcome.events.find((e) => e.type === 'SaveRolled');
      if (save?.type === 'SaveRolled' && save.success === true) {
        expect(outcome.resisted).toBe(true);
        expect(outcome.events.some((e) => e.type === 'PolymorphApplied')).toBe(false);
        expect(outcome.events.some((e) => e.type === 'SpellSlotConsumed')).toBe(true);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('rejects when form CR exceeds target level', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildWizard(7, ['polymorph']);
    const tiny = buildTarget('Tiny', 1); // level 1 — max CR = 1
    let campaign = engine.createCampaign({ name: 'poly-cap' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: tiny } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.polymorph(campaign.state, {
        casterId: caster.id,
        targetId: tiny.id,
        form: TYRANNOSAURUS_FORM,
        formCR: 8,
      }),
    ).toThrow(/exceeds/);
  });
});

describe('planWildShape', () => {
  it('emits bonus action + ResourceSpent + PolymorphApplied(wild-shape)', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const druid = buildDruid(2, 2);
    let campaign = engine.createCampaign({ name: 'ws' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.wildShape(campaign.state, {
      druidId: druid.id,
      form: WOLF_FORM,
      formCR: 0.25,
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('ResourceSpent');
    expect(types).toContain('PolymorphApplied');
    const poly = events.find((e) => e.type === 'PolymorphApplied');
    if (poly?.type === 'PolymorphApplied') {
      expect(poly.kind).toBe('wild-shape');
    }
  });

  it('rejects forms above the level CR cap (L2 → CR ≤ 1/4)', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const druid = buildDruid(2, 2);
    let campaign = engine.createCampaign({ name: 'ws-cap' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.wildShape(campaign.state, {
        druidId: druid.id,
        form: WOLF_FORM,
        formCR: 0.5, // > L2 cap of 0.25
      }),
    ).toThrow(/cap/);
  });

  it('rejects flying-speed forms below L8', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const druid = buildDruid(4, 2);
    let campaign = engine.createCampaign({ name: 'ws-fly' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.wildShape(campaign.state, {
        druidId: druid.id,
        form: ELK_FORM,
        formCR: 0.5,
        formHasFlyingSpeed: true,
      }),
    ).toThrow(/flying/i);
  });

  it('rejects when no Wild Shape uses remain', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const druid = buildDruid(2, 0); // 0 uses
    let campaign = engine.createCampaign({ name: 'ws-empty' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: druid } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.wildShape(campaign.state, {
        druidId: druid.id,
        form: WOLF_FORM,
        formCR: 0.25,
      }),
    ).toThrow(/Wild Shape/);
  });
});
