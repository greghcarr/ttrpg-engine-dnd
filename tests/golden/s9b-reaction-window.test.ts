import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import {
  TEST_PACK,
  TEST_CONTENT,
  buildFighter,
  eventId,
  isoTimestamp,
  makeItemInstance,
} from '../fixtures/index.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId, newEncounterId } from '../../src/ids.js';
import { formatTranscript } from '../transcript.js';
import type { ContentPack } from '../../src/content/pack.js';
import type { DamageAppliedEvent } from '../../src/schemas/events/combat.js';

const heavyArmorMasterPack: ContentPack = {
  ...TEST_PACK,
  feats: [
    ...TEST_PACK.feats,
    {
      id: 'heavy-armor-master',
      name: 'Heavy Armor Master',
      category: 'general',
      repeatable: false,
      prerequisites: [],
      effects: [
        {
          kind: 'FlatDamageReduction',
          damageTypes: ['bludgeoning', 'piercing', 'slashing'],
          amount: 3,
        },
      ],
    },
  ],
};

const buildHam = (): Character => {
  const fighter = buildFighter({ name: 'Heavy Borin', STR: 18, hpMax: 30, hpCurrent: 30 });
  return CharacterSchema.parse({
    ...fighter,
    featsTaken: [...fighter.featsTaken, 'heavy-armor-master'],
  });
};

const buildAttackerWithDualWield = (): Character => {
  const fighter = buildFighter({ name: 'Twin Striker', level: 2, STR: 16, DEX: 16 });
  return CharacterSchema.parse({
    ...fighter,
    resources: [{ resourceId: 'action-surge', current: 1, max: 1 }],
  });
};

describe('golden: slice 9b reaction-window expansion', () => {
  it('Heavy Armor Master subtracts 3 from physical damage via mitigateDamage', async () => {
    const { mitigateDamage } = await import('../../src/derive/damage-mitigation.js');
    const { resolveContent, loadContentPack } = await import('../../src/content/pack.js');
    const parsedPack = loadContentPack(heavyArmorMasterPack);
    const content = resolveContent([parsedPack]);
    const ham = buildHam();
    expect(content.feats.get('heavy-armor-master')?.effects).toHaveLength(1);
    expect(content.feats.get('heavy-armor-master')?.effects[0]).toMatchObject({
      kind: 'FlatDamageReduction',
      amount: 3,
    });
    expect(ham.featsTaken).toContain('heavy-armor-master');
    const { buildEffectStack } = await import('../../src/derive/effect-stack.js');
    const accumulator = buildEffectStack({
      character: ham,
      itemInstances: {},
      content,
    });
    expect(accumulator.flatDamageReductionFor('slashing')).toBe(3);
    const result = mitigateDamage({
      character: ham,
      itemInstances: {},
      content,
      rawComponents: [
        { amount: 11, type: 'slashing' },
        { amount: 8, type: 'fire' },
      ],
    });
    expect(result[0]?.amount).toBe(8);
    expect(result[0]?.mitigation).toBe('resisted');
    expect(result[0]?.rawAmount).toBe(11);
    expect(result[1]?.amount).toBe(8);
    expect(result[1]?.mitigation).toBeUndefined();
  });

  it('Action Surge resets the action this turn and enables a second attack', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(99) });
    const fighter = buildAttackerWithDualWield();
    const target = buildFighter({ name: 'Pile of Sandbags', hpMax: 200, hpCurrent: 200 });
    const longsword = makeItemInstance('longsword');
    const shortsword = makeItemInstance('shortsword');

    let campaign = engine.createCampaign({ name: 'as-and-twf' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: shortsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target },
    ]);

    const encounterId = newEncounterId();
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'EncounterCreated',
        encounterId,
        name: 'Sparring Match',
        combatantIds: [fighter.id, target.id],
      },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'InitiativeRolled',
        encounterId,
        rolls: [
          { combatantId: fighter.id, d20: 20, modifier: 3, total: 23 },
          { combatantId: target.id, d20: 5, modifier: 0, total: 5 },
        ],
      },
      { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId },
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'TurnStarted',
        encounterId,
        combatantId: fighter.id,
        round: 1,
      },
    ]);

    // Main hand attack
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events,
    );
    // Off-hand bonus action attack
    campaign = commit(
      campaign,
      engine.plan.offHandAttack(campaign.state, {
        attackerId: fighter.id,
        targetId: target.id,
        weaponInstanceId: shortsword.id,
      }).events,
    );
    // Action Surge: free another Action
    campaign = commit(
      campaign,
      engine.plan.actionSurge(campaign.state, { combatantId: fighter.id }).events,
    );
    // Surge attack
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: target.id,
        weaponInstanceId: longsword.id,
      }).events,
    );

    const combatant = campaign.state.encounters[encounterId]?.combatants.find(
      (c) => c.combatantId === fighter.id,
    );
    expect(combatant?.turnUsage.bonusActionUsed).toBe(true);
    // After Action Surge, attack counter was reset; the surge attack made it 1 again.
    expect(combatant?.turnUsage.attacksMadeThisTurn).toBe(1);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Action Surge + off-hand attack in a single turn',
      }),
    ).toMatchFileSnapshot('./transcripts/s9b-reaction-window.transcript.md');
  });
});
