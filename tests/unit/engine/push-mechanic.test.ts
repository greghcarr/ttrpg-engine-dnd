// Unit test for the `pushedFeetOnFail` extension to the save spell
// mechanic shipped in slice 78. Gust of Wind casts a STR save and
// emits a `CreaturePushed` informational event for each target that
// fails. The engine doesn't mutate position state — the event is a
// log entry consumers apply to their own position model.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';

const PACK = loadStarterPack();

const buildCaster = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Caster',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
    preparedSpells: ['gust-of-wind'],
  });

const buildTarget = (str: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: str, DEX: 12, CON: 12, INT: 10, WIS: 8, CHA: 8 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

describe('save mechanic: pushedFeetOnFail (Gust of Wind)', () => {
  it('emits CreaturePushed when a target fails the save', () => {
    let proven = false;
    for (let seed = 1; seed < 100 && !proven; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const caster = buildCaster();
      const target = buildTarget(6); // weak STR -> high chance of fail
      let campaign = engine.createCampaign({ name: 'gw' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const events = engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'gust-of-wind',
        slotLevel: 2,
        targetIds: [target.id],
      }).events;
      const save = events.find((e) => e.type === 'SaveRolled') as SaveRolledEvent | undefined;
      if (save?.success !== false) continue;
      const push = events.find((e) => e.type === 'CreaturePushed');
      expect(push).toBeDefined();
      expect(push!.distanceFeet).toBe(15);
      expect(push!.targetId).toBe(target.id);
      expect(push!.source).toBe('gust-of-wind');
      proven = true;
    }
    expect(proven, 'no failed save observed across seeds').toBe(true);
  });

  it('does NOT emit CreaturePushed when the save succeeds', () => {
    let proven = false;
    for (let seed = 1; seed < 100 && !proven; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const caster = buildCaster();
      const target = buildTarget(18); // strong STR -> high chance of success
      let campaign = engine.createCampaign({ name: 'gw-pass' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const events = engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'gust-of-wind',
        slotLevel: 2,
        targetIds: [target.id],
      }).events;
      const save = events.find((e) => e.type === 'SaveRolled') as SaveRolledEvent | undefined;
      if (save?.success !== true) continue;
      const push = events.find((e) => e.type === 'CreaturePushed');
      expect(push).toBeUndefined();
      proven = true;
    }
    expect(proven, 'no successful save observed across seeds').toBe(true);
  });
});
