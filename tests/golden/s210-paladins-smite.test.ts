// Golden scenario: Paladin L2 Paladin's Smite (slice 210).
//
// RAW 2024: "When you hit a creature with a melee weapon or an
// Unarmed Strike, you can use a Bonus Action to expend a Paladin
// spell slot to deal Radiant damage to the target, in addition to
// the weapon's damage. The extra damage is 2d8 plus 1d8 for each
// spell slot level higher than 1st. The damage increases by 1d8 if
// the target is an Undead or a Fiend."
//
// Sequence:
//   1. L5 Paladin attacks a goblin with a longsword.
//   2. After the hit lands, paladin invokes planPaladinsSmite at
//      slot level 2, declaring the target Undead-or-Fiend.
//   3. 3d8 base + 1d8 type-bonus = 4d8 radiant lands on the goblin
//      as a separate DamageApplied event chained to the original
//      attack via causedByEventId.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit, type Campaign } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { AttackRolledEvent } from '../../src/schemas/events/attack.js';
import type { DamageAppliedEvent } from '../../src/schemas/events/combat.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildPaladin = (swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Aria',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'paladin', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 12, CHA: 16 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const buildUndead = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Wight',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 15, DEX: 14, CON: 16, INT: 10, WIS: 13, CHA: 15 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

describe('golden: Paladin L2 Paladin\'s Smite', () => {
  it("hit + smite at slot 2 against an Undead applies 4d8 radiant on top of the longsword damage", async () => {
    for (let seed = 1; seed < 80; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed + 7000) });
      const sword = longsword();
      const aria = buildPaladin(sword.id);
      const wight = buildUndead();
      let campaign: Campaign = engine.createCampaign({ name: `paladins-smite-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: aria } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wight } satisfies CharacterCreatedEvent,
      ]);

      const attack = engine.plan.attack(campaign.state, {
        attackerId: aria.id,
        targetId: wight.id,
        weaponInstanceId: sword.id,
      });
      const rolled = attack.events.find((e): e is AttackRolledEvent => e.type === 'AttackRolled');
      if (rolled?.hit !== true) continue;
      campaign = commit(campaign, attack.events);

      const smite = engine.plan.paladinsSmite(campaign.state, {
        paladinId: aria.id,
        targetId: wight.id,
        slotLevel: 2,
        triggeringAttackEventId: rolled.id,
        targetIsUndeadOrFiend: true,
      });
      campaign = commit(campaign, smite.events);

      const smiteDamage = smite.events.find((e): e is DamageAppliedEvent => e.type === 'DamageApplied')!;
      const radiantTotal = smiteDamage.components
        .filter((c) => c.type === 'radiant')
        .reduce((s, c) => s + c.amount, 0);
      // Slot 2 = 3d8 base, +1d8 for Undead = 4d8 → 4..32.
      expect(radiantTotal).toBeGreaterThanOrEqual(4);
      expect(radiantTotal).toBeLessThanOrEqual(32);

      const replayed = replay(campaign.events);
      expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
      void throwOnCallRNG();
      expect(() => replay(campaign.events)).not.toThrow();

      await expect(
        formatTranscript(campaign.events, CONTENT, {
          title: "Paladin's Smite (L2): bonus-action slot-2 smite for 4d8 radiant on an Undead",
        }),
      ).toMatchFileSnapshot('./transcripts/s210-paladins-smite.transcript.md');
      return;
    }
    throw new Error('no hitting seed found across 80 attempts');
  });
});
