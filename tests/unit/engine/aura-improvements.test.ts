// Unit test for Paladin Aura Improvements (L18) -- the range bump
// from 10ft to 30ft on Aura of Protection and Aura of Courage.
//
// Wired via the `dedupeFeaturesByLatestLevel` helper in
// `src/derive/effect-stack.ts`: when two class features at different
// levels share the same `id`, the engine keeps only the highest-level
// instance. The L18 entries here re-use ids `aura-of-protection` and
// `aura-of-courage` (matching L6 and L10), so an L18+ paladin's
// effect stack contains the 30-ft versions instead of the 10-ft ones.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { collectEffectsFromCharacter } from '../../../src/derive/effect-stack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildPaladin = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ariadne',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'paladin', level, hitDiceRemaining: level }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 16 },
    hp: { current: 22 + level * 6, max: 22 + level * 6, temp: 0 },
    featsTaken: [],
  });

const PACK = loadStarterPack();

const findAura = (
  character: Character,
  pack: ReturnType<typeof loadStarterPack>,
  auraId: string,
): { rangeFeet: number } | undefined => {
  const engine = createEngine({ contentPacks: [pack], rng: seededRNG(1) });
  const effects = collectEffectsFromCharacter({
    character,
    content: engine.content,
    itemInstances: {},
  });
  const aura = effects.find((e) => e.kind === 'GrantAura' && e.auraId === auraId);
  return aura?.kind === 'GrantAura' ? { rangeFeet: aura.rangeFeet } : undefined;
};

describe('Paladin Aura Improvements (L18)', () => {
  it('L6 paladin has 10-ft Aura of Protection', () => {
    const aura = findAura(buildPaladin(6), PACK, 'aura-of-protection');
    expect(aura?.rangeFeet).toBe(10);
  });

  it('L10 paladin has 10-ft Aura of Courage', () => {
    const aura = findAura(buildPaladin(10), PACK, 'aura-of-courage');
    expect(aura?.rangeFeet).toBe(10);
  });

  it('L18 paladin has 30-ft Aura of Protection', () => {
    const aura = findAura(buildPaladin(18), PACK, 'aura-of-protection');
    expect(aura?.rangeFeet).toBe(30);
  });

  it('L18 paladin has 30-ft Aura of Courage', () => {
    const aura = findAura(buildPaladin(18), PACK, 'aura-of-courage');
    expect(aura?.rangeFeet).toBe(30);
  });

  it('L18 paladin still gains the self-effects (Frightened immunity + CHA-mod to saves)', () => {
    // The L18 dedupe replaces the whole feature, not just the
    // GrantAura entry, so the sibling self-effects (six save
    // modifiers, Frightened immunity) must be duplicated on the
    // L18 feature. Verify they survive.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const paladin = buildPaladin(18);
    let campaign = engine.createCampaign({ name: 'l18-paladin' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: paladin,
      } satisfies CharacterCreatedEvent,
    ]);
    const effects = collectEffectsFromCharacter({
      character: campaign.state.characters[paladin.id]!,
      content: engine.content,
      itemInstances: campaign.state.itemInstances,
    });
    const frightenedImmunity = effects.find(
      (e) => e.kind === 'GrantConditionImmunity' && e.conditionId === 'frightened',
    );
    expect(frightenedImmunity).toBeDefined();
    const wisSaveBuff = effects.find(
      (e) =>
        e.kind === 'AddModifier' &&
        typeof e.target === 'object' &&
        e.target.kind === 'save' &&
        e.target.ability === 'WIS',
    );
    expect(wisSaveBuff).toBeDefined();
  });
});
