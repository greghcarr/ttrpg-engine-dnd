// Slice 116 — predicate-gated AC modifier (Defense Fighting Style).
//
// Extends slice 115's `AddModifier.condition` plumbing to the AC
// derive path. `computeAC` now builds a `bearer.wearingArmor` fact
// and feeds it to `modifierSum('ac', facts)`. Defense's +1 AC is
// gated on `{ kind: 'eq', path: 'bearer.wearingArmor', value: true }`
// so an unarmored fighter no longer collects the bonus.

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

const buildFighter = (opts: { armorInstanceId?: string; armorInventoryIds?: string[] }): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Fighter',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['fighting-style-defense'],
    inventory: opts.armorInventoryIds ?? [],
    equipped: {
      ...(opts.armorInstanceId !== undefined ? { armor: opts.armorInstanceId } : {}),
      attuned: [],
    },
  });

describe('Defense Fighting Style gates the +1 AC on wearing armor', () => {
  it('adds +1 AC while armor is equipped', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const chain = makeItemInstance('chain-mail');
    const fighter = buildFighter({ armorInstanceId: chain.id, armorInventoryIds: [chain.id] });
    let campaign: Campaign = engine.createCampaign({ name: 'defense-armored' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: chain },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    const ac = engine.derive.ac(campaign.state, fighter.id);
    const modifierEntry = ac.breakdown.find((b) => b.source === 'modifier');
    expect(modifierEntry).toBeDefined();
    expect(modifierEntry!.value).toBe(1);
  });

  it('does NOT add +1 AC when unarmored', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(2) });
    const fighter = buildFighter({});
    let campaign: Campaign = engine.createCampaign({ name: 'defense-unarmored' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    const ac = engine.derive.ac(campaign.state, fighter.id);
    const modifierEntry = ac.breakdown.find((b) => b.source === 'modifier');
    if (modifierEntry !== undefined) {
      expect(modifierEntry.value).toBe(0);
    }
  });
});
