import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const buildShieldCaster = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Shield Wiz',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 18, max: 18, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['shield'],
  });

describe('Shield: reactive +5 AC', () => {
  it('preventedHit=true when +5 AC closes the gap to a miss', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildShieldCaster();
    let campaign = engine.createCampaign({ name: 'shield-prev' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    ]);
    // Attack total = 15 (just barely hits AC 14). With +5 AC -> 19, it misses.
    const outcome = engine.plan.shield(campaign.state, {
      casterId: caster.id,
      triggeringAttackEventId: eventId(),
      triggeringAttackTotal: 15,
      originalAC: 14,
      slotLevel: 1,
    });
    expect(outcome.preventedHit).toBe(true);
    const types = outcome.events.map((e) => e.type);
    expect(types).toContain('SpellSlotConsumed');
    expect(types).toContain('ConditionApplied');
    expect(types).toContain('ShieldCast');
    const cond = outcome.events.find((e) => e.type === 'ConditionApplied');
    if (cond?.type === 'ConditionApplied') {
      expect(cond.conditionId).toBe('shielded');
      expect(cond.targetId).toBe(caster.id);
    }
  });

  it('preventedHit=false when +5 AC is still not enough', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildShieldCaster();
    let campaign = engine.createCampaign({ name: 'shield-nope' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    ]);
    // Crit-level attack total = 25 vs AC 14. With +5 AC -> 19, still hit.
    const outcome = engine.plan.shield(campaign.state, {
      casterId: caster.id,
      triggeringAttackEventId: eventId(),
      triggeringAttackTotal: 25,
      originalAC: 14,
    });
    expect(outcome.preventedHit).toBe(false);
    // Even when it doesn't prevent, the slot and reaction are still spent
    // (RAW: Shield is reactive — committing to cast it consumes resources
    // regardless of the outcome).
    const types = outcome.events.map((e) => e.type);
    expect(types).toContain('SpellSlotConsumed');
    expect(types).toContain('ShieldCast');
  });

  it('applies the +5 AC via the shielded condition (replay-equivalent)', () => {
    const PACK = loadStarterPack();
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const caster = buildShieldCaster();
    let campaign = engine.createCampaign({ name: 'shield-apply' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
    ]);
    const outcome = engine.plan.shield(campaign.state, {
      casterId: caster.id,
      triggeringAttackEventId: eventId(),
      triggeringAttackTotal: 15,
      originalAC: 14,
    });
    campaign = commit(campaign, outcome.events);
    const c = campaign.state.characters[caster.id];
    expect(c?.appliedConditions.some((cnd) => cnd.conditionId === 'shielded')).toBe(true);
  });
});
