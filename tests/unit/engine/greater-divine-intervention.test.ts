import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 221: Cleric L20 Greater Divine Intervention via the
// `GrantDivineInterventionWish` marker primitive. Allows
// planDivineIntervention to cast Wish despite Wish being level 9
// and not on the Cleric list. The 2d4-long-rest cooldown when Wish
// is the chosen spell is a separate concern (pending a
// `ResourceCooldownExtended` primitive).

const PACK = loadStarterPack();

const buildCleric = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Solace',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level, hitDiceRemaining: level, subclassId: 'life-domain' }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 20, CHA: 10 },
    hp: { current: 160, max: 160, temp: 0 },
    featsTaken: [],
    preparedSpells: [],
    spellSlotsUsed: {},
    resources: [
      {
        resourceId: 'divine-intervention',
        current: 1,
        max: 1,
      },
    ],
  });

describe('Cleric L20 Greater Divine Intervention (slice 221)', () => {
  it('an L20 cleric can cast Wish via Divine Intervention', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(221) });
    const cleric = buildCleric(20);
    let campaign: Campaign = engine.createCampaign({ name: 'wish-via-di' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.divineIntervention(campaign.state, {
      clericId: cleric.id,
      spellId: 'wish',
      slotLevel: 9,
      targetIds: [cleric.id],
    });
    expect(events.some((e) => e.type === 'SpellCastDeclared')).toBe(true);
    expect(events.some((e) => e.type === 'SpellSlotConsumed')).toBe(false);
  });

  it('an L10 cleric (no Greater Divine Intervention) cannot cast Wish', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(221) });
    const cleric = buildCleric(10);
    let campaign: Campaign = engine.createCampaign({ name: 'no-wish-l10' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.divineIntervention(campaign.state, {
        clericId: cleric.id,
        spellId: 'wish',
        slotLevel: 9,
        targetIds: [cleric.id],
      }),
    ).toThrow(/without Greater Divine Intervention/);
  });

  it('an L20 cleric still cannot cast a non-Cleric / non-Wish spell above level 5', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(221) });
    const cleric = buildCleric(20);
    let campaign: Campaign = engine.createCampaign({ name: 'still-gated' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    ]);
    // Fire Bolt is a wizard/sorcerer cantrip, not on the Cleric list.
    expect(() =>
      engine.plan.divineIntervention(campaign.state, {
        clericId: cleric.id,
        spellId: 'fire-bolt',
        slotLevel: 0,
        targetIds: [cleric.id],
      }),
    ).toThrow(/not on the Cleric list/);
  });

  it('an L20 cleric can still cast a normal Cleric L5-or-lower spell', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(221) });
    const cleric = buildCleric(20);
    let campaign: Campaign = engine.createCampaign({ name: 'normal-di-l20' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.divineIntervention(campaign.state, {
        clericId: cleric.id,
        spellId: 'cure-wounds',
        slotLevel: 1,
        targetIds: [cleric.id],
      }),
    ).not.toThrow();
  });
});
