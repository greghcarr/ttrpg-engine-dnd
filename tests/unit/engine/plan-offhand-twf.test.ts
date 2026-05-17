// Slice 119 — Two-Weapon Fighting Fighting Style.
//
// Without TWF: off-hand attacks add the ability modifier to damage
// only if negative (RAW 2024). With TWF: the modifier is added
// regardless of sign. The Fighting Style ships a new
// `GrantTwoWeaponFighting` marker effect; planOffHandAttack
// consults the attacker's effect stack for the flag and toggles
// the modifier behavior.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { DamageRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

const PACK = loadStarterPack();

const buildFighter = (mainHandId: string, offHandId: string, hasTWF: boolean): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Dualist',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: hasTWF ? ['fighting-style-two-weapon'] : [],
    inventory: [mainHandId, offHandId],
    equipped: { mainHand: mainHandId, offHand: offHandId, attuned: [] },
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 8, DEX: 12, CON: 12, INT: 16, WIS: 12, CHA: 10 },
    hp: { current: 200, max: 200, temp: 0 },
    featsTaken: [],
  });

const seedEncounter = (hasTWF: boolean): {
  engine: ReturnType<typeof createEngine>;
  campaign: Campaign;
  attackerId: string;
  targetId: string;
  offHandId: string;
} => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(7) });
  const mainDagger = makeItemInstance('dagger');
  const offDagger = makeItemInstance('dagger');
  const attacker = buildFighter(mainDagger.id, offDagger.id, hasTWF);
  const target = buildTarget();
  let campaign: Campaign = engine.createCampaign({ name: hasTWF ? 'twf-on' : 'twf-off' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: mainDagger },
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: offDagger },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
  ]);
  const created = engine.plan.createEncounter(campaign.state, {
    combatantIds: [attacker.id, target.id],
  });
  campaign = commit(campaign, created.events);
  campaign = commit(
    campaign,
    engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events,
  );
  campaign = commit(
    campaign,
    engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events,
  );
  campaign = commit(
    campaign,
    engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId }).events,
  );
  // Advance until the attacker has the turn.
  const enc = campaign.state.encounters[created.encounterId]!;
  if (enc.combatants[enc.activeIndex]?.combatantId !== attacker.id) {
    campaign = commit(
      campaign,
      engine.plan.advanceTurn(campaign.state, { encounterId: created.encounterId }).events,
    );
  }
  return {
    engine,
    campaign,
    attackerId: attacker.id,
    targetId: target.id,
    offHandId: offDagger.id,
  };
};

const damageModifier = (
  state: Campaign,
  engineFactory: () => ReturnType<typeof createEngine>,
  attackerId: string,
  targetId: string,
  weaponId: string,
): number => {
  // Walk seeds until we get a hit. The damage roll's `modifier`
  // includes the ability-mod contribution (the only var of interest
  // here — the dice roll is the same for the same seed).
  for (let seed = 1; seed < 80; seed += 1) {
    const engine = engineFactory();
    const events = engine.plan.offHandAttack(state.state, {
      attackerId,
      targetId,
      weaponInstanceId: weaponId,
    }).events;
    const dmgRoll = events.find(
      (e): e is DamageRolledEvent => e.type === 'DamageRolled',
    );
    if (dmgRoll === undefined) continue;
    return dmgRoll.rolls[0]!.modifier;
  }
  throw new Error('no hit landed in 80 seeds');
};

describe('Two-Weapon Fighting Fighting Style', () => {
  it('without TWF: off-hand damage modifier is 0 (positive STR mod stripped)', () => {
    const scene = seedEncounter(false);
    const modifier = damageModifier(
      scene.campaign,
      () => createEngine({ contentPacks: [PACK], rng: seededRNG(1) }),
      scene.attackerId,
      scene.targetId,
      scene.offHandId,
    );
    // STR 16 = +3 mod, finesse weapon picks max(STR, DEX) = max(+3, +2) = +3.
    // Without TWF, positive mods are dropped → modifier = 0.
    expect(modifier).toBe(0);
  });

  it('with TWF: off-hand damage modifier includes the ability mod', () => {
    const scene = seedEncounter(true);
    const modifier = damageModifier(
      scene.campaign,
      () => createEngine({ contentPacks: [PACK], rng: seededRNG(1) }),
      scene.attackerId,
      scene.targetId,
      scene.offHandId,
    );
    // STR 16 = +3 mod, finesse weapon picks max(STR, DEX) = +3.
    // With TWF, the +3 lands on the damage modifier.
    expect(modifier).toBe(3);
  });
});
