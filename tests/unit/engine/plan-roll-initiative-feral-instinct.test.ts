import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { InitiativeRolledEvent } from '../../../src/schemas/events/encounter.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Barbarian L7 Feral Instinct: advantage on initiative rolls.
// Bug this prevents: a L7+ Barbarian should be rolling 2 d20s for
// initiative and taking the higher.

const PACK = loadStarterPack();

const buildBarbarian = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: `Korg L${level}`,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'barbarian', level, hitDiceRemaining: level }],
    abilityScores: { STR: 18, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 10 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const buildFighter = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Alyx',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 7, hitDiceRemaining: 7 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const rollInit = (charA: Character, charB: Character, seed: number): InitiativeRolledEvent => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
  let campaign: Campaign = engine.createCampaign({ name: 'init' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: charA } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: charB } satisfies CharacterCreatedEvent,
  ]);
  const enc = engine.plan.createEncounter(campaign.state, { combatantIds: [charA.id, charB.id] });
  campaign = commit(campaign, enc.events);
  const events = engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events;
  return events[0] as InitiativeRolledEvent;
};

describe('Feral Instinct (Barbarian L7)', () => {
  it('a Barbarian L7 has a higher *average* initiative roll than a Fighter L7 with matching DEX', () => {
    // Average d20 = 10.5. Advantage average ≈ 13.825. With identical
    // DEX modifiers, the barbarian should consistently outroll a plain
    // fighter across many seeds. Tally seeds; assert majority.
    const barb = buildBarbarian(7);
    const fighter = buildFighter();
    let barbWins = 0;
    let fighterWins = 0;
    for (let seed = 0; seed < 200; seed++) {
      const ev = rollInit(barb, fighter, seed);
      const barbRoll = ev.rolls.find((r) => r.combatantId === barb.id)!;
      const fighterRoll = ev.rolls.find((r) => r.combatantId === fighter.id)!;
      if (barbRoll.d20 > fighterRoll.d20) barbWins += 1;
      else if (fighterRoll.d20 > barbRoll.d20) fighterWins += 1;
    }
    // Advantage advantage: barbarian should win the majority of seeds.
    expect(barbWins).toBeGreaterThan(fighterWins);
  });

  it('a Barbarian L6 (pre-Feral-Instinct) does NOT roll with advantage', () => {
    const barbL6 = buildBarbarian(6);
    const fighter = buildFighter();
    // Across 200 seeds the win-rate should be ~50/50 (DEX is identical).
    let barbWins = 0;
    let fighterWins = 0;
    for (let seed = 0; seed < 200; seed++) {
      const ev = rollInit(barbL6, fighter, seed);
      const barbRoll = ev.rolls.find((r) => r.combatantId === barbL6.id)!;
      const fighterRoll = ev.rolls.find((r) => r.combatantId === fighter.id)!;
      if (barbRoll.d20 > fighterRoll.d20) barbWins += 1;
      else if (fighterRoll.d20 > barbRoll.d20) fighterWins += 1;
    }
    // Without advantage, win-rate is ~ symmetric. Allow 35-65 split.
    expect(barbWins / fighterWins).toBeGreaterThan(0.5);
    expect(barbWins / fighterWins).toBeLessThan(2);
  });
});
