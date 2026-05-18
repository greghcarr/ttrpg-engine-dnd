import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { computeAvailableSpellSlots } from '../../../src/derive/spell-slots.js';
import { resolveContent } from '../../../src/content/pack.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 219: `noSlotCost` flag on CastSpellIntent. When true, the
// cast skips both the slot-availability gate and the
// SpellSlotConsumed / PactSlotConsumed emission. Unlocks free-cast
// features: Cleric Divine Intervention (L10 + L20 Wish variant),
// Warlock Contact Patron (slice 217's oncePerLongRest preparation),
// magic-item "casts X without expending a slot" riders.

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildCleric = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Solace',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'cleric', level, hitDiceRemaining: level, subclassId: 'life-domain' }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    preparedSpells: ['cure-wounds'],
    spellSlotsUsed: {},
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

describe('slice 219: CastSpellIntent.noSlotCost', () => {
  it('emits a SpellCastDeclared event but no SpellSlotConsumed when noSlotCost is true', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(219) });
    const cleric = buildCleric(5);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'no-slot-cost' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: cleric.id,
      spellId: 'cure-wounds',
      slotLevel: 1,
      targetIds: [ally.id],
      noSlotCost: true,
    });
    expect(events.some((e) => e.type === 'SpellCastDeclared')).toBe(true);
    expect(events.some((e) => e.type === 'SpellSlotConsumed')).toBe(false);
    expect(events.some((e) => e.type === 'PactSlotConsumed')).toBe(false);
  });

  it("does not deplete the caster's slot pool when noSlotCost is true", () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(219) });
    const cleric = buildCleric(5);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'no-slot-drain' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const slotsBefore = computeAvailableSpellSlots(
      campaign.state.characters[cleric.id]!,
      CONTENT.classes,
    );
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: cleric.id,
      spellId: 'cure-wounds',
      slotLevel: 1,
      targetIds: [ally.id],
      noSlotCost: true,
    });
    campaign = commit(campaign, events);
    const slotsAfter = computeAvailableSpellSlots(
      campaign.state.characters[cleric.id]!,
      CONTENT.classes,
    );
    expect(slotsAfter.standardByLevel).toEqual(slotsBefore.standardByLevel);
  });

  it('still emits SpellSlotConsumed in the default (paid-cast) path', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(219) });
    const cleric = buildCleric(5);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'paid-cast' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: cleric.id,
      spellId: 'cure-wounds',
      slotLevel: 1,
      targetIds: [ally.id],
    });
    expect(events.some((e) => e.type === 'SpellSlotConsumed')).toBe(true);
  });

  it('bypasses the no-slots-available gate when noSlotCost is true', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(219) });
    // Exhaust all L1 slots up front so a paid cast would fail.
    const cleric: Character = {
      ...buildCleric(5),
      spellSlotsUsed: { '1': 4, '2': 3, '3': 2 },
    };
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'exhausted-bypass' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'cure-wounds',
        slotLevel: 1,
        targetIds: [ally.id],
      }),
    ).toThrow(/No spell slots/);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'cure-wounds',
        slotLevel: 1,
        targetIds: [ally.id],
        noSlotCost: true,
      }),
    ).not.toThrow();
  });
});
