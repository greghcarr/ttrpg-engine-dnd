import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Tests Feather Fall protection. Bug this prevents: a character under
// the feather-fall spell's effect should take 0 falling damage. Without
// the GrantFallingProtection check, planFalling treats them like any
// other faller.

const PACK = loadStarterPack();

const buildCommoner = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Commoner',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
  });

const buildCampaignWith = (character: Character) => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
  let campaign: Campaign = engine.createCampaign({ name: 'feather-fall-test' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: character } satisfies CharacterCreatedEvent,
  ]);
  return { engine, campaign };
};

describe('Feather Fall protection (GrantFallingProtection effect)', () => {
  it('a character with feather-falling-active takes no falling damage', () => {
    const target = buildCommoner();
    const { engine, campaign: c0 } = buildCampaignWith(target);
    const campaign = commit(c0, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ConditionApplied',
        targetId: target.id,
        conditionId: 'feather-falling-active',
      } satisfies ConditionAppliedEvent,
    ]);
    const events = engine.plan.falling(campaign.state, {
      characterId: target.id,
      distanceFeet: 200,
    }).events;
    expect(events).toEqual([]);
  });

  it('without protection, the same fall produces damage', () => {
    const target = buildCommoner();
    const { engine, campaign } = buildCampaignWith(target);
    const events = engine.plan.falling(campaign.state, {
      characterId: target.id,
      distanceFeet: 200,
    }).events;
    const damage = events.find((e) => e.type === 'DamageApplied') as DamageAppliedEvent | undefined;
    expect(damage).toBeDefined();
    expect(damage!.components.reduce((sum, c) => sum + c.amount, 0)).toBeGreaterThan(0);
  });

  it('casting feather-fall applies feather-falling-active, then a 200ft fall is harmless', () => {
    const caster = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Wizard',
      speciesId: 'human',
      backgroundId: 'sage',
      classes: [{ classId: 'wizard', level: 3, hitDiceRemaining: 3 }],
      abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 10, CHA: 10 },
      hp: { current: 20, max: 20, temp: 0 },
      featsTaken: [],
      preparedSpells: ['feather-fall'],
    });
    const faller = buildCommoner();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(0) });
    let campaign: Campaign = engine.createCampaign({ name: 'cast-then-fall' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: faller } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId: 'feather-fall',
        slotLevel: 1,
        targetIds: [faller.id],
      }).events,
    );
    const events = engine.plan.falling(campaign.state, {
      characterId: faller.id,
      distanceFeet: 200,
    }).events;
    expect(events).toEqual([]);
  });
});
