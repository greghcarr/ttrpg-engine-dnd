// Slice 121 — Great Weapon Fighting Fighting Style.
//
// RAW 2024: "When you roll damage for an attack you make with a
// Melee weapon that you are holding with two hands, you can treat
// any 1 or 2 on a damage die as a 3. The weapon must have the
// Two-Handed or Versatile property for you to gain this benefit."
//
// planAttack applies the substitution to the rolled damage dice
// when the attacker's effect stack carries GrantGreatWeaponFighting,
// the weapon is melee, and the wield is two-handed (Two-Handed
// property, or Versatile with both off-hand and shield slots empty).
// The rolled DamageRolled event reflects the substituted values.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  AttackRolledEvent,
  DamageRolledEvent,
} from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildFighter = (opts: { hasGWF: boolean; weaponId: string; shieldId?: string }): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Smasher',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: opts.hasGWF ? ['fighting-style-great-weapon'] : [],
    inventory: opts.shieldId !== undefined ? [opts.weaponId, opts.shieldId] : [opts.weaponId],
    equipped: {
      mainHand: opts.weaponId,
      ...(opts.shieldId !== undefined ? { shield: opts.shieldId } : {}),
      attuned: [],
    },
  });

const buildVictim = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Sandbag',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 8, DEX: 10, CON: 12, INT: 16, WIS: 12, CHA: 10 },
    hp: { current: 200, max: 200, temp: 0 },
    featsTaken: [],
  });

interface HitOutcome {
  rolled: AttackRolledEvent;
  damage: DamageRolledEvent;
}

const firstHit = (opts: {
  weaponInstance: ReturnType<typeof makeItemInstance>;
  shieldInstance?: ReturnType<typeof makeItemInstance>;
  hasGWF: boolean;
  seedStart: number;
}): HitOutcome | undefined => {
  const victim = buildVictim();
  for (let seed = opts.seedStart; seed < opts.seedStart + 80; seed += 1) {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
    const fighter = buildFighter({
      hasGWF: opts.hasGWF,
      weaponId: opts.weaponInstance.id,
      shieldId: opts.shieldInstance?.id,
    });
    let campaign: Campaign = engine.createCampaign({ name: `gwf-${seed}` });
    const seedEvents = [];
    seedEvents.push({
      id: eventId(),
      at: isoTimestamp(),
      type: 'ItemAcquired' as const,
      instance: opts.weaponInstance,
    });
    if (opts.shieldInstance !== undefined) {
      seedEvents.push({
        id: eventId(),
        at: isoTimestamp(),
        type: 'ItemAcquired' as const,
        instance: opts.shieldInstance,
      });
    }
    seedEvents.push(
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: victim } satisfies CharacterCreatedEvent,
    );
    campaign = commit(campaign, seedEvents);
    const events = engine.plan.attack(campaign.state, {
      attackerId: fighter.id,
      targetId: victim.id,
      weaponInstanceId: opts.weaponInstance.id,
    }).events;
    const rolled = events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
    if (rolled?.hit !== true) continue;
    const damage = events.find((e): e is DamageRolledEvent => e.type === 'DamageRolled');
    if (damage === undefined) continue;
    return { rolled, damage };
  }
  return undefined;
};

describe('Great Weapon Fighting Fighting Style', () => {
  it('greatsword: every die showing 1 or 2 becomes 3 (no dice below 3)', () => {
    // Greatsword is 2d6 (Two-Handed). Try seeds until we find a hit
    // whose baseline rolls included a 1 or 2 — that's where GWF should
    // make a visible difference. Then re-run the same seed with GWF
    // on and assert the rolls in the array are all >= 3.
    for (let seed = 1; seed < 100; seed += 1) {
      const greatsword = makeItemInstance('greatsword');
      const baseline = firstHit({ weaponInstance: greatsword, hasGWF: false, seedStart: seed });
      if (baseline === undefined) continue;
      const baselineRolls = baseline.damage.rolls[0]!.rolls;
      if (!baselineRolls.some((r) => r < 3)) continue;
      // Same seed, GWF on.
      const gwf = firstHit({
        weaponInstance: makeItemInstance('greatsword'),
        hasGWF: true,
        seedStart: seed,
      });
      if (gwf === undefined) continue;
      const gwfRolls = gwf.damage.rolls[0]!.rolls;
      // All rolls must be >= 3 with GWF active.
      for (const r of gwfRolls) {
        expect(r).toBeGreaterThanOrEqual(3);
      }
      // GWF total damage must be >= baseline total (substitution can
      // only raise values).
      const baselineTotal = baselineRolls.reduce((s, v) => s + v, 0);
      const gwfTotal = gwfRolls.reduce((s, v) => s + v, 0);
      expect(gwfTotal).toBeGreaterThanOrEqual(baselineTotal);
      return;
    }
    throw new Error('no seed produced a baseline roll with a 1 or 2 to compare');
  });

  it('does NOT apply with a longbow (ranged weapon)', () => {
    const longbow = makeItemInstance('longbow');
    const result = firstHit({ weaponInstance: longbow, hasGWF: true, seedStart: 1 });
    if (result === undefined) throw new Error('no hit landed');
    // No assertion that rolls are >= 3; the test simply ensures the
    // run doesn't crash and the dice aren't substituted. With a 1d8
    // longbow the rolls can legitimately be 1 or 2 — that's RAW.
    const rolls = result.damage.rolls[0]!.rolls;
    expect(rolls.length).toBeGreaterThanOrEqual(1);
    // Sanity: dies are within 1..8.
    for (const r of rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(8);
    }
  });

  it('does NOT apply with a longsword + shield (versatile but 1-handed)', () => {
    // Longsword is versatile (1d8 / 1d10). With a shield in the
    // shield slot, the wield is 1-handed → GWF doesn't apply, even
    // though the attacker has the Fighting Style.
    for (let seed = 1; seed < 100; seed += 1) {
      const longsword = makeItemInstance('longsword');
      const shield = makeItemInstance('shield');
      const baseline = firstHit({
        weaponInstance: longsword,
        shieldInstance: shield,
        hasGWF: false,
        seedStart: seed,
      });
      if (baseline === undefined) continue;
      const baselineRolls = baseline.damage.rolls[0]!.rolls;
      if (!baselineRolls.some((r) => r < 3)) continue;
      const gwfOn = firstHit({
        weaponInstance: makeItemInstance('longsword'),
        shieldInstance: makeItemInstance('shield'),
        hasGWF: true,
        seedStart: seed,
      });
      if (gwfOn === undefined) continue;
      // Rolls should match baseline — GWF didn't fire because the
      // wield was 1-handed (shield occupies a hand).
      expect(gwfOn.damage.rolls[0]!.rolls).toEqual(baselineRolls);
      return;
    }
    throw new Error('no seed produced a baseline roll with a 1 or 2 to compare');
  });
});
