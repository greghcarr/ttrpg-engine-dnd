import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 220: planDivineIntervention. Cleric L10 free-cast of any
// Cleric spell L5 or lower. Uses slice-219's noSlotCost flag and
// slice-220's new ignorePreparation flag on CastSpellIntent.

const PACK = loadStarterPack();

const buildCleric = (
  level: number,
  divineInterventionCurrent: number,
  preparedSpells: ReadonlyArray<string> = [],
): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Solace',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level, hitDiceRemaining: level, subclassId: 'life-domain' }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 80, max: 80, temp: 0 },
    featsTaken: [],
    preparedSpells,
    spellSlotsUsed: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 },
    resources: [
      {
        resourceId: 'divine-intervention',
        current: divineInterventionCurrent,
        max: 1,
      },
    ],
  });

const buildAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ally',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 10, max: 30, temp: 0 },
    featsTaken: [],
  });

describe('Cleric L10 Divine Intervention (slice 220)', () => {
  it('casts any Cleric spell without expending a slot or requiring preparation', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(220) });
    const cleric = buildCleric(10, 1);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'di-cast' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.divineIntervention(campaign.state, {
      clericId: cleric.id,
      spellId: 'cure-wounds',
      slotLevel: 1,
      targetIds: [ally.id],
    });
    expect(events.some((e) => e.type === 'SpellCastDeclared')).toBe(true);
    expect(events.some((e) => e.type === 'SpellSlotConsumed')).toBe(false);
    const spent = events.find(
      (e) => e.type === 'ResourceSpent' && (e as { resourceId: string }).resourceId === 'divine-intervention',
    );
    expect(spent).toBeDefined();
  });

  it('depletes the divine-intervention resource', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(220) });
    const cleric = buildCleric(10, 1);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'di-deplete' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.divineIntervention(campaign.state, {
      clericId: cleric.id,
      spellId: 'cure-wounds',
      slotLevel: 1,
      targetIds: [ally.id],
    });
    campaign = commit(campaign, events);
    const resource = campaign.state.characters[cleric.id]!.resources.find(
      (r) => r.resourceId === 'divine-intervention',
    );
    expect(resource?.current).toBe(0);
  });

  it('throws when the cleric has no Divine Intervention uses remaining', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(220) });
    const cleric = buildCleric(10, 0);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'di-exhausted' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.divineIntervention(campaign.state, {
        clericId: cleric.id,
        spellId: 'cure-wounds',
        slotLevel: 1,
        targetIds: [ally.id],
      }),
    ).toThrow(/no Divine Intervention uses/);
  });

  it('rejects a non-Cleric spell', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(220) });
    const cleric = buildCleric(10, 1);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'di-wrong-class' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    // Fire Bolt is a wizard/sorcerer cantrip, not on the Cleric list.
    expect(() =>
      engine.plan.divineIntervention(campaign.state, {
        clericId: cleric.id,
        spellId: 'fire-bolt',
        slotLevel: 0,
        targetIds: [ally.id],
      }),
    ).toThrow(/not on the Cleric list/);
  });

  it('rejects a Cleric spell above level 5', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(220) });
    const cleric = buildCleric(10, 1);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'di-too-high' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    // Mass Cure Wounds is a level-5 cleric spell; Heal is level-6.
    expect(() =>
      engine.plan.divineIntervention(campaign.state, {
        clericId: cleric.id,
        spellId: 'heal',
        slotLevel: 6,
        targetIds: [ally.id],
      }),
    ).toThrow(/level 5 or lower/);
  });

  it('does not require the spell to be in the cleric preparedSpells list', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(220) });
    // preparedSpells is empty — yet the cast should succeed.
    const cleric = buildCleric(10, 1, []);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'di-no-prep' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.divineIntervention(campaign.state, {
        clericId: cleric.id,
        spellId: 'aid',
        slotLevel: 2,
        targetIds: [ally.id],
      }),
    ).not.toThrow();
  });
});
