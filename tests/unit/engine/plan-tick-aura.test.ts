import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildCleric = (level: number, preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Cleric',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'cleric', level, hitDiceRemaining: level }],
    abilityScores: { STR: 12, DEX: 10, CON: 14, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildEnemy = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 10, CON: 12, INT: 8, WIS: 8, CHA: 8 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('Spirit Guardians: aura ticks', () => {
  it('casting registers an aura-damage spell; cast itself emits no damage', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric(5, ['spirit-guardians']);
    let campaign = engine.createCampaign({ name: 'sg-cast' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: cleric.id,
      spellId: 'spirit-guardians',
      slotLevel: 3,
      targetIds: [cleric.id],
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('SpellCastDeclared');
    expect(types).toContain('ConcentrationStarted');
    expect(types).not.toContain('SaveRolled');
    expect(types).not.toContain('DamageApplied');
  });

  it('tickAura rolls a WIS save per target and applies radiant damage', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(7) });
    const cleric = buildCleric(5, ['spirit-guardians']);
    const e1 = buildEnemy('E1');
    const e2 = buildEnemy('E2');
    let campaign = engine.createCampaign({ name: 'sg-tick' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: e1 } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: e2 } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'spirit-guardians',
        slotLevel: 3,
        targetIds: [cleric.id],
      }).events,
    );
    const { events } = engine.plan.tickAura(campaign.state, {
      casterId: cleric.id,
      targetIds: [e1.id, e2.id],
    });
    const saves = events.filter((e) => e.type === 'SaveRolled');
    expect(saves).toHaveLength(2);
    for (const save of saves) {
      if (save.type === 'SaveRolled') {
        expect(save.ability).toBe('WIS');
      }
    }
    // At least one of the two failed saves should produce a DamageApplied.
    const dmgs = events.filter((e) => e.type === 'DamageApplied');
    if (saves.every((s) => s.type === 'SaveRolled' && s.success === false)) {
      expect(dmgs.length).toBeGreaterThanOrEqual(1);
    }
    for (const dmg of dmgs) {
      if (dmg.type === 'DamageApplied') {
        expect(dmg.components[0]?.type).toBe('radiant');
      }
    }
  });

  it('rejects when caster is not concentrating on an aura spell', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric(5, []);
    let campaign = engine.createCampaign({ name: 'sg-none' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.tickAura(campaign.state, { casterId: cleric.id, targetIds: [] }),
    ).toThrow(/concentration/);
  });

  it('upcasting scales damage (slot 5 has +2d8 over the 3d8 base)', () => {
    // Verify by checking that the aura at slot 5 deals more damage on
    // average than at slot 3. Use a large sample to smooth variance.
    const PACK = loadStarterPack();
    let baseTotal = 0;
    let upcastTotal = 0;
    const ITERATIONS = 30;
    for (let seed = 0; seed < ITERATIONS; seed++) {
      for (const slotLevel of [3, 5] as const) {
        const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed * 10 + slotLevel) });
        const cleric = buildCleric(9, ['spirit-guardians']);
        const enemy = buildEnemy('E');
        let campaign = engine.createCampaign({ name: 'sg-up' });
        campaign = commit(campaign, [
          { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
          { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: enemy } satisfies CharacterCreatedEvent,
        ]);
        campaign = commit(
          campaign,
          engine.plan.castSpell(campaign.state, {
            characterId: cleric.id,
            spellId: 'spirit-guardians',
            slotLevel,
            targetIds: [cleric.id],
          }).events,
        );
        const { events } = engine.plan.tickAura(campaign.state, {
          casterId: cleric.id,
          targetIds: [enemy.id],
        });
        for (const e of events) {
          if (e.type === 'DamageApplied') {
            for (const c of e.components) {
              if (slotLevel === 3) baseTotal += c.amount;
              else upcastTotal += c.amount;
            }
          }
        }
      }
    }
    expect(upcastTotal).toBeGreaterThan(baseTotal);
  });
});
