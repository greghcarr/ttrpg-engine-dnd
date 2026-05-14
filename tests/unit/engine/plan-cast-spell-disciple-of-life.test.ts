import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { HealedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Cleric L3 Life Domain "Disciple of Life": healing spells of
// level 1+ restore an additional `2 + slotLevel` HP. Bug this prevents:
// a Life Cleric's Healing Word should heal `1d4 + WIS + (2 + slotLevel)`,
// not just `1d4 + WIS`. Without wiring, the boost is dropped.

const PACK = loadStarterPack();

const buildCleric = (opts: { life: boolean; level?: number }): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: opts.life ? 'Vasha (Life)' : 'Vasha (Plain)',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [
      {
        classId: 'cleric',
        level: opts.level ?? 3,
        hitDiceRemaining: opts.level ?? 3,
        ...(opts.life ? { subclassId: 'life-domain' } : {}),
      },
    ],
    abilityScores: { STR: 10, DEX: 10, CON: 14, INT: 10, WIS: 16, CHA: 10 },
    hp: { current: 24, max: 24, temp: 0 },
    featsTaken: [],
    preparedSpells: ['healing-word'],
  });

const buildWoundedAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Wounded',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 5, max: 30, temp: 0 },
    featsTaken: [],
  });

const cast = (
  cleric: Character,
  slotLevel: number,
  seed = 0,
): HealedEvent => {
  const ally = buildWoundedAlly();
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  let campaign: Campaign = engine.createCampaign({ name: 'dol-test' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
  ]);
  const events = engine.plan.castSpell(campaign.state, {
    characterId: cleric.id,
    spellId: 'healing-word',
    slotLevel,
    targetIds: [ally.id],
  }).events;
  const healed = events.find((e) => e.type === 'Healed') as HealedEvent | undefined;
  if (!healed) throw new Error('Healed event not emitted');
  return healed;
};

describe('Disciple of Life (Life Cleric L3)', () => {
  it('Life Cleric L3 Healing Word at slot 1 adds +3 (2 + 1) to the heal', () => {
    const life = cast(buildCleric({ life: true }), 1);
    const plain = cast(buildCleric({ life: false }), 1);
    expect(life.amount - plain.amount).toBe(3);
  });

  it('Healing Word at slot 2 adds +4 to the heal', () => {
    const life = cast(buildCleric({ life: true }), 2);
    const plain = cast(buildCleric({ life: false }), 2);
    expect(life.amount - plain.amount).toBe(4);
  });

  it('Healing Word at slot 5 adds +7 to the heal', () => {
    const life = cast(buildCleric({ life: true, level: 9 }), 5);
    const plain = cast(buildCleric({ life: false, level: 9 }), 5);
    expect(life.amount - plain.amount).toBe(7);
  });

  it('a plain (non-Life) Cleric does NOT get the Disciple boost', () => {
    const heal = cast(buildCleric({ life: false }), 1);
    // 1d4 (1..4) + WIS mod (+3) = 4..7. No DoL boost.
    expect(heal.amount).toBeGreaterThanOrEqual(4);
    expect(heal.amount).toBeLessThanOrEqual(7);
  });

  it('a Life Cleric heal at slot 1 adds the boost on top of dice + WIS mod', () => {
    const heal = cast(buildCleric({ life: true }), 1);
    // 1d4 (1..4) + WIS mod (+3) + DoL (+3) = 7..10.
    expect(heal.amount).toBeGreaterThanOrEqual(7);
    expect(heal.amount).toBeLessThanOrEqual(10);
  });
});
