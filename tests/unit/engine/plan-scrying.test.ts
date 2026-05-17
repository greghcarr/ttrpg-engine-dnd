// Slice 136: planScrying composes the slice-135 sensor primitive
// with a target WIS save. On a failed save the sensor is placed and
// concentration starts; on a successful save the spell fizzles and
// the slot is still consumed. The save passes sourceIsMagical: true
// so Magic Resistance is honored against scrying attempts.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  RemoteSensorPlacedEvent,
} from '../../../src/schemas/events/sensors.js';
import type {
  ConcentrationStartedEvent,
} from '../../../src/schemas/events/concentration.js';
import type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../../src/schemas/events/spellcasting.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';

const PACK = loadStarterPack();

const buildWizard = (preparedSpells: string[] = ['scrying']): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Diviner',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 9, hitDiceRemaining: 9 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    preparedSpells,
  });

const buildPoorTarget = (): Character =>
  // WIS 6 (mod -2), no proficiency: the target is very unlikely to
  // save against a Wizard-9 spell DC of 16 unadjusted.
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Hapless Mark',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 10, CON: 12, INT: 8, WIS: 6, CHA: 10 },
    hp: { current: 12, max: 12, temp: 0 },
    featsTaken: [],
  });

const buildImp = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Imp Spy',
    statblockId: 'imp',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: [],
  });

const seedCampaign = (wizard: Character, target: Character) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
  let campaign: Campaign = engine.createCampaign({ name: 'scrying' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { campaign, engine };
};

describe('engine.plan.scrying', () => {
  it('target fails the save: full chain emits (declared + slot + save + concentration + sensor)', () => {
    // Seed-walk to find a seed where the poor target rolls badly
    // enough to fail. The poor target has WIS save +(-2) total
    // against DC 16; a roll < 18 fails. Most seeds fail.
    for (let seed = 1; seed < 30; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const wizard = buildWizard();
      const target = buildPoorTarget();
      let campaign: Campaign = engine.createCampaign({ name: `scrying-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const { events, resisted } = engine.plan.scrying(campaign.state, {
        casterId: wizard.id,
        targetId: target.id,
      });
      if (resisted) continue;
      const types = events.map((e) => e.type);
      expect(types).toContain('SpellCastDeclared');
      expect(types).toContain('SpellSlotConsumed');
      expect(types).toContain('SaveRolled');
      expect(types).toContain('ConcentrationStarted');
      expect(types).toContain('RemoteSensorPlaced');
      const save = events.find((e): e is SaveRolledEvent => e.type === 'SaveRolled')!;
      expect(save.targetId).toBe(target.id);
      expect(save.ability).toBe('WIS');
      expect(save.success).toBe(false);
      const placed = events.find(
        (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
      )!;
      expect(placed.sourceSpellId).toBe('scrying');
      expect(placed.casterId).toBe(wizard.id);
      const started = events.find(
        (e): e is ConcentrationStartedEvent => e.type === 'ConcentrationStarted',
      )!;
      expect(placed.sourceEffectInstanceId).toBe(started.effectInstanceId);
      return;
    }
    throw new Error('no seed produced a failed save in the seed window');
  });

  it('target succeeds: spell fizzles, no concentration, no sensor, slot still consumed', () => {
    // Use the +5 dcAdjustment (most favorable to the target by
    // making the DC harder to meet — actually wait, +5 is consumer
    // territory and represents target awareness; in RAW it's the
    // *worst* familiarity case but the spell text uses a signed
    // modifier so +5 here means DC + 5 = harder save). Setting
    // dcAdjustment way down (-30) guarantees the target succeeds
    // even on a low roll.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    const target = buildPoorTarget();
    let campaign: Campaign = engine.createCampaign({ name: 'scrying-resists' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
    ]);
    const { events, resisted } = engine.plan.scrying(campaign.state, {
      casterId: wizard.id,
      targetId: target.id,
      dcAdjustment: -30, // makes DC effectively unmeetable from caster's side; target auto-succeeds
    });
    expect(resisted).toBe(true);
    const types = events.map((e) => e.type);
    expect(types).toContain('SpellCastDeclared');
    expect(types).toContain('SpellSlotConsumed');
    expect(types).toContain('SaveRolled');
    expect(types).not.toContain('ConcentrationStarted');
    expect(types).not.toContain('RemoteSensorPlaced');
    const slot = events.find(
      (e): e is SpellSlotConsumedEvent => e.type === 'SpellSlotConsumed',
    );
    expect(slot!.slotLevel).toBe(5);
  });

  it('Imp target: Magic Resistance contributes advantage to the WIS save', () => {
    // Imp carries GrantMagicResistance via its traits[] (slice 131).
    // planScrying passes sourceIsMagical: true to computeSavingThrow,
    // so the save derivation should report hasAdvantage. The roll
    // shape is 2d20 take-max.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    const imp = buildImp();
    let campaign: Campaign = engine.createCampaign({ name: 'scrying-imp' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: imp } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.scrying(campaign.state, {
      casterId: wizard.id,
      targetId: imp.id,
    });
    const save = events.find((e): e is SaveRolledEvent => e.type === 'SaveRolled')!;
    expect(save.used).toBe('advantage');
    expect(save.d20).toHaveLength(2);
  });

  it('rejects slotLevel < 5', () => {
    const wizard = buildWizard();
    const target = buildPoorTarget();
    const { campaign, engine } = seedCampaign(wizard, target);
    expect(() =>
      engine.plan.scrying(campaign.state, {
        casterId: wizard.id,
        targetId: target.id,
        slotLevel: 4,
      }),
    ).toThrow(/5th-level/);
  });

  it('rejects when the caster does not know Scrying', () => {
    const wizard = buildWizard([]);
    const target = buildPoorTarget();
    const { campaign, engine } = seedCampaign(wizard, target);
    expect(() =>
      engine.plan.scrying(campaign.state, {
        casterId: wizard.id,
        targetId: target.id,
      }),
    ).toThrow(/Scrying/);
  });

  it('dcAdjustment shifts the save DC (positive adjustment makes the save harder)', () => {
    // RAW familiarity table: -10 to +5 against the base DC.
    // Positive means the target has a hair / nail / blood / etc. and
    // is harder to resist. This test isolates the DC adjustment by
    // checking the SaveRolled event's `dc` field, which is the only
    // surface where the adjustment lands.
    const wizard = buildWizard();
    const target = buildPoorTarget();
    const { campaign, engine } = seedCampaign(wizard, target);
    const { events } = engine.plan.scrying(campaign.state, {
      casterId: wizard.id,
      targetId: target.id,
      dcAdjustment: 5,
    });
    const save = events.find((e): e is SaveRolledEvent => e.type === 'SaveRolled')!;
    // Wizard-9 INT 18 spell DC = 8 + 4 prof + 4 INT = 16. +5 adjust = 21.
    expect(save.dc).toBe(21);
  });

  it('on failed save, sensor location includes the target name (consumer display)', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const wizard = buildWizard();
      const target = buildPoorTarget();
      let campaign: Campaign = engine.createCampaign({ name: `scrying-name-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const { events, resisted } = engine.plan.scrying(campaign.state, {
        casterId: wizard.id,
        targetId: target.id,
      });
      if (resisted) continue;
      const placed = events.find(
        (e): e is RemoteSensorPlacedEvent => e.type === 'RemoteSensorPlaced',
      )!;
      expect(placed.location).toContain(target.name);
      return;
    }
  });
});
