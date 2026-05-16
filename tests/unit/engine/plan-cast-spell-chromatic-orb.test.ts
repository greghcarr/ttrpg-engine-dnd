import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent, DamageRolledEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Chromatic Orb's cast-time damage-type choice. Bug this prevents:
// without the casterChoice plumbing, a Chromatic Orb cast either silently
// uses a hard-coded type or throws an opaque schema error. With the
// primitive in place, the caster picks one of six elements at cast time
// and the planner uses the chosen type for damage and mitigation.

const PACK = loadStarterPack();

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Chromatic Tester',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
    preparedSpells: ['chromatic-orb'],
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildCampaign = (caster: Character, target: Character) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
  let campaign: Campaign = engine.createCampaign({ name: 'chromatic-orb' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign };
};

describe('Chromatic Orb caster-chosen damage type', () => {
  it('applies the chosen damage type (fire) to the damage roll and DamageApplied', () => {
    const caster = buildWizard();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    // Seed 7 forces a hit; the exact roll doesn't matter for damage-type assertion.
    const events = engine.plan.castSpell(campaign.state, {
      characterId: caster.id,
      spellId: 'chromatic-orb',
      slotLevel: 1,
      targetIds: [target.id],
      casterChoice: { kind: 'damageType', value: 'fire' },
    }).events;
    const damageRolled = events.find((e) => e.type === 'DamageRolled') as DamageRolledEvent | undefined;
    const damageApplied = events.find((e) => e.type === 'DamageApplied') as DamageAppliedEvent | undefined;
    if (damageRolled !== undefined && damageApplied !== undefined) {
      expect(damageRolled.rolls[0]!.type).toBe('fire');
      expect(damageApplied.components.every((c) => c.type === 'fire')).toBe(true);
    } else {
      // Roll missed; re-seed and retry once.
      const engine2 = createEngine({ contentPacks: [PACK], rng: seededRNG(2) });
      let c2 = engine2.createCampaign({ name: 'chromatic-orb-retry' });
      c2 = commit(c2, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const ev2 = engine2.plan.castSpell(c2.state, {
        characterId: caster.id,
        spellId: 'chromatic-orb',
        slotLevel: 1,
        targetIds: [target.id],
        casterChoice: { kind: 'damageType', value: 'fire' },
      }).events;
      const d2 = ev2.find((e) => e.type === 'DamageApplied') as DamageAppliedEvent | undefined;
      expect(d2, 'expected a hit under at least one seed').toBeDefined();
      expect(d2!.components.every((c) => c.type === 'fire')).toBe(true);
    }
  });

  it('respects a different chosen type (acid)', () => {
    const caster = buildWizard();
    const target = buildTarget();
    // Try a few seeds until one hits; the choice should hold regardless.
    for (const seed of [1, 2, 3, 5, 7, 11, 13, 17]) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      let campaign: Campaign = engine.createCampaign({ name: `chromatic-orb-acid-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const events = engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'chromatic-orb',
        slotLevel: 1,
        targetIds: [target.id],
        casterChoice: { kind: 'damageType', value: 'acid' },
      }).events;
      const damageApplied = events.find((e) => e.type === 'DamageApplied') as DamageAppliedEvent | undefined;
      if (damageApplied !== undefined) {
        expect(damageApplied.components.every((c) => c.type === 'acid')).toBe(true);
        return;
      }
    }
    throw new Error('expected at least one of the seeds to hit');
  });

  it('throws when no casterChoice is supplied', () => {
    const caster = buildWizard();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'chromatic-orb',
        slotLevel: 1,
        targetIds: [target.id],
      }),
    ).toThrow(/casterChoice/);
  });

  it("throws when the chosen damage type isn't in the allowed list (force)", () => {
    const caster = buildWizard();
    const target = buildTarget();
    const { engine, campaign } = buildCampaign(caster, target);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'chromatic-orb',
        slotLevel: 1,
        targetIds: [target.id],
        casterChoice: { kind: 'damageType', value: 'force' },
      }),
    ).toThrow(/not in allowed list/);
  });
});
