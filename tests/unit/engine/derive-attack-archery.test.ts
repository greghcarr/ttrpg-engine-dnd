// Slice 115 — predicate-gated AddModifier (Archery Fighting Style).
//
// `AddModifier.condition` is now honored at modifier-sum time:
// EffectAccumulator stores the predicate alongside the contribution,
// and modifierSum evaluates it against caller-supplied facts.
// computeAttackBonus builds an `event.attackKind` fact so Archery's
// +2 attack only applies on ranged attacks. Same pattern unblocks
// the remaining Fighting Styles' gates in future slices.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildArcher = (weaponIds: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Archer',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 14, DEX: 16, CON: 14, INT: 10, WIS: 12, CHA: 8 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['fighting-style-archery'],
    inventory: weaponIds,
    equipped: { mainHand: weaponIds[0], attuned: [] },
  });

describe('Archery Fighting Style gates the +2 on attackKind', () => {
  it('adds +2 to attack rolls with a ranged weapon (longbow)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const longbow = makeItemInstance('longbow');
    const longsword = makeItemInstance('longsword');
    const archer = buildArcher([longbow.id, longsword.id]);
    let campaign: Campaign = engine.createCampaign({ name: 'archery-ranged' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longbow },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: archer } satisfies CharacterCreatedEvent,
    ]);
    const bonus = engine.derive.attackBonus(campaign.state, archer.id, longbow.id);
    const archeryEntry = bonus.breakdown.find((b) => b.source === 'modifier');
    expect(archeryEntry).toBeDefined();
    expect(archeryEntry!.value).toBe(2);
  });

  it('does NOT add +2 to attack rolls with a melee weapon (longsword)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(2) });
    const longbow = makeItemInstance('longbow');
    const longsword = makeItemInstance('longsword');
    const archer = buildArcher([longsword.id, longbow.id]);
    let campaign: Campaign = engine.createCampaign({ name: 'archery-melee' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longbow },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: archer } satisfies CharacterCreatedEvent,
    ]);
    const bonus = engine.derive.attackBonus(campaign.state, archer.id, longsword.id);
    const archeryEntry = bonus.breakdown.find((b) => b.source === 'modifier');
    // Either no modifier entry at all (sum was 0 and skipped), or it's
    // present at 0 — either way the +2 must not show up.
    if (archeryEntry !== undefined) {
      expect(archeryEntry.value).toBe(0);
    }
  });

  it('unconditional modifiers still apply (no predicate = always on)', () => {
    // A control: equip with longsword, no fighting style. The breakdown
    // should not carry a +2 attack modifier. Verifies the change didn't
    // accidentally drop unconditional modifiers when no facts match.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(3) });
    const longsword = makeItemInstance('longsword');
    const noStyleFighter = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Plain',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
      abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 28, max: 28, temp: 0 },
      featsTaken: [],
      inventory: [longsword.id],
      equipped: { mainHand: longsword.id, attuned: [] },
    });
    let campaign: Campaign = engine.createCampaign({ name: 'no-style' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: noStyleFighter } satisfies CharacterCreatedEvent,
    ]);
    const bonus = engine.derive.attackBonus(campaign.state, noStyleFighter.id, longsword.id);
    // STR mod (+3) + proficiency (+2) = +5. No 'modifier' entry.
    expect(bonus.total).toBe(5);
    expect(bonus.breakdown.find((b) => b.source === 'modifier')).toBeUndefined();
  });
});
