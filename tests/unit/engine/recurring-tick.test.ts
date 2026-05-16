// Unit test for the recurring-rider primitive shipped in slice 79.
// Heroism is the canonical example: at cast, the target gains
// Frightened immunity (via the heroic-active condition) and the
// recurring temp-HP mechanic registers. The consumer then calls
// engine.plan.tickRecurring at the start of each target's turn to
// grant temp HP equal to the caster's CHA modifier.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const PACK = loadStarterPack();

const buildPaladin = (cha: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ariadne',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'paladin', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 16, DEX: 10, CON: 14, INT: 10, WIS: 10, CHA: cha },
    hp: { current: 25, max: 25, temp: 0 },
    featsTaken: [],
    preparedSpells: ['heroism'],
  });

const buildAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bran',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 25, max: 25, temp: 0 },
    featsTaken: [],
  });

describe('recurring-tick: Heroism', () => {
  it('grants caster CHA mod temp HP per tick', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const paladin = buildPaladin(18); // CHA mod +4
    const ally = buildAlly();
    let campaign = engine.createCampaign({ name: 'her' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: paladin } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    const castEvents = engine.plan.castSpell(campaign.state, {
      characterId: paladin.id,
      spellId: 'heroism',
      slotLevel: 1,
      targetIds: [ally.id],
    }).events;
    campaign = commit(campaign, castEvents);
    // Ally should carry the Heroic condition with Frightened immunity.
    expect(
      campaign.state.characters[ally.id]?.appliedConditions.some(
        (c) => c.conditionId === 'heroic-active',
      ),
    ).toBe(true);

    const tickEvents = engine.plan.tickRecurring(campaign.state, {
      casterId: paladin.id,
      targetId: ally.id,
    }).events;
    const tempHP = tickEvents.find((e) => e.type === 'TempHPGranted');
    expect(tempHP).toBeDefined();
    expect(tempHP!.amount).toBe(4); // CHA 18 → +4 mod
  });

  it('grants 0 temp HP (no event) when CHA mod is negative', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const paladin = buildPaladin(6); // CHA mod -2
    const ally = buildAlly();
    let campaign = engine.createCampaign({ name: 'her-neg' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: paladin } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: paladin.id,
        spellId: 'heroism',
        slotLevel: 1,
        targetIds: [ally.id],
      }).events,
    );
    const tickEvents = engine.plan.tickRecurring(campaign.state, {
      casterId: paladin.id,
      targetId: ally.id,
    }).events;
    expect(tickEvents).toHaveLength(0);
  });
});
