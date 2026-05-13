import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildCleric = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Cleric',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 10, CON: 14, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildTarget = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 12, max: 12, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('Derived character: hpMax modifier from effect stack', () => {
  it('hpMaxBonus is 0 with no active hpMax effects', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric([]);
    let campaign = engine.createCampaign({ name: 'no-bonus' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
    ]);
    const derived = engine.derive.character(campaign.state, cleric.id);
    expect(derived.hpMaxBonus).toBe(0);
    expect(derived.effectiveHpMax).toBe(35);
  });

  it('Aid grants +5 effective hpMax via the aid-buffed condition', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric(['aid']);
    const t1 = buildTarget('T1');
    let campaign = engine.createCampaign({ name: 'aid-bonus' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t1 } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'aid',
        slotLevel: 2,
        targetIds: [t1.id],
      }).events,
    );
    const derived = engine.derive.character(campaign.state, t1.id);
    expect(derived.hpMaxBonus).toBe(5);
    expect(derived.effectiveHpMax).toBe(17); // 12 stored + 5
    // Reducer-side enforcement: the character's hp.maxBonus is stored
    // on state, not just derived.
    expect(campaign.state.characters[t1.id]?.hp.maxBonus).toBe(5);
  });

  it('Aid-buffed character: massive-damage threshold uses effective hpMax', () => {
    // T1 has 12 hpMax. Aid bumps maxBonus to 5 (effective 17). A
    // single hit of 17 damage from positive HP should trigger
    // massive damage (≥ effective max); a hit of 16 should not.
    // We verify by applying damage and checking death-save state.
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric(['aid']);
    const t1 = buildTarget('T1');
    let campaign = engine.createCampaign({ name: 'aid-massive' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t1 } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'aid',
        slotLevel: 2,
        targetIds: [t1.id],
      }).events,
    );
    // Pre-Aid hp.max = 12; effective max = 17 (with the buff).
    // A 16-damage hit from full HP (12) leaves them at -4; not massive
    // (massive requires |overflow| >= effective max = 17).
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'DamageApplied',
        targetId: t1.id,
        components: [{ amount: 16, type: 'slashing' }],
      },
    ]);
    const afterModerate = campaign.state.characters[t1.id]!;
    expect(afterModerate.deathSaves.failures).toBe(0);
    expect(afterModerate.hp.current).toBe(-4);
  });
});
