// Unit test for Paladin Aura of Protection (L6) — the first consumer
// of the `sourceAbilityMod` Formula extension shipped in slice 64.
//
// Aura of Protection RAW: "While you are conscious, you and friendly
// creatures within 10 feet of you gain a bonus to saving throws equal
// to your CHA modifier (minimum +1)."
//
// Wiring:
// - The Paladin L6 feature adds `abilityMod CHA` (max with +1) to each
//   of the paladin's own saves -- the source IS the paladin, so the
//   formula reads the target's own CHA.
// - The `aura-of-protection-active` condition adds `sourceAbilityMod
//   CHA` (max with +1) to each save of whoever the condition is
//   applied to, sourced from the condition's `sourceCharacterId`.
// - The consumer (dndbnb / DM tool) applies the condition to in-range
//   allies via `ConditionApplied` with `sourceCharacterId = paladinId`.
//
// This test:
// 1. Builds an L6 paladin with CHA 16 (mod +3) and verifies they get
//    +3 on their own saves from the L6 feature.
// 2. Builds an ally, applies `aura-of-protection-active` with the
//    paladin as the source, and verifies the ally's saves get +3.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { computeSavingThrow } from '../../../src/derive/save.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newAppliedConditionId, newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import type { ULID } from '../../../src/engine/ids-utils.js';

const buildPaladin = (charisma: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ariadne',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'paladin', level: 6, hitDiceRemaining: 6 }],
    abilityScores: { STR: 16, DEX: 10, CON: 14, INT: 10, WIS: 10, CHA: charisma },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bran',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 8 },
    hp: { current: 25, max: 25, temp: 0 },
    featsTaken: [],
  });

const PACK = loadStarterPack();

describe('Aura of Protection', () => {
  it("Paladin's own L6 saves include +CHA-mod (their own)", () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const paladin = buildPaladin(16); // CHA mod +3
    let campaign = engine.createCampaign({ name: 'aop' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: paladin,
      } satisfies CharacterCreatedEvent,
    ]);

    const wisSave = computeSavingThrow({
      character: campaign.state.characters[paladin.id]!,
      itemInstances: campaign.state.itemInstances,
      content: engine.content,
      ability: 'WIS',
      characters: campaign.state.characters,
    });

    const auraEntry = wisSave.breakdown.find((b) => b.source === 'modifier');
    expect(auraEntry).toBeDefined();
    expect(auraEntry!.value).toBe(3); // +CHA mod (16 → +3) from the paladin's own L6 feature
  });

  it('Ally with aura-of-protection-active condition gains +CHA-mod-of-source', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const paladin = buildPaladin(18); // CHA mod +4
    const ally = buildAlly();
    let campaign = engine.createCampaign({ name: 'aop-ally' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: paladin,
      } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: ally,
      } satisfies CharacterCreatedEvent,
    ]);

    // Consumer applies the aura's ally condition with sourceCharacterId
    // pointing at the paladin -- this is what dndbnb / DM tool would do
    // when the ally enters the paladin's 10 ft range.
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: ally.id as ULID,
        conditionId: 'aura-of-protection-active',
        appliedConditionId: newAppliedConditionId(),
        sourceCharacterId: paladin.id as ULID,
      } satisfies ConditionAppliedEvent,
    ]);

    const allyState = campaign.state.characters[ally.id]!;
    expect(
      allyState.appliedConditions.find((c) => c.conditionId === 'aura-of-protection-active')
        ?.sourceCharacterId,
    ).toBe(paladin.id);

    const wisSave = computeSavingThrow({
      character: allyState,
      itemInstances: campaign.state.itemInstances,
      content: engine.content,
      ability: 'WIS',
      characters: campaign.state.characters,
    });

    const auraEntry = wisSave.breakdown.find((b) => b.source === 'modifier');
    expect(auraEntry).toBeDefined();
    expect(auraEntry!.value).toBe(4); // +CHA mod of source paladin (18 → +4)
  });

  it('Ally without characters lookup falls back to no aura bonus', () => {
    // Without `characters` threaded through the derive call, source-
    // relative formulas evaluate to 0 -- the `max(1, 0)` floor kicks
    // in instead, so the aura still grants +1 (the RAW minimum).
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const paladin = buildPaladin(18);
    const ally = buildAlly();
    let campaign = engine.createCampaign({ name: 'aop-no-chars' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: paladin,
      } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: ally,
      } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: ally.id as ULID,
        conditionId: 'aura-of-protection-active',
        appliedConditionId: newAppliedConditionId(),
        sourceCharacterId: paladin.id as ULID,
      } satisfies ConditionAppliedEvent,
    ]);

    const wisSave = computeSavingThrow({
      character: campaign.state.characters[ally.id]!,
      itemInstances: campaign.state.itemInstances,
      content: engine.content,
      ability: 'WIS',
      // Deliberately omit `characters` -- proves the fallback.
    });
    const auraEntry = wisSave.breakdown.find((b) => b.source === 'modifier');
    expect(auraEntry).toBeDefined();
    expect(auraEntry!.value).toBe(1); // max(1, sourceAbilityMod=0) = +1 floor per RAW
  });
});
