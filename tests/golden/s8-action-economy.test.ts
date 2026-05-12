import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import {
  TEST_PACK,
  buildFighter,
  eventId,
  isoTimestamp,
  makeItemInstance,
  TEST_CONTENT,
} from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

const setupDuel = (attackerLevel: number, attackerHpMax: number) => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(2026) });
  const longsword = makeItemInstance('longsword');
  const armor = makeItemInstance('leather-armor');
  const attacker = buildFighter({
    name: attackerLevel === 1 ? 'Hilda the Novice' : 'Hilda the Veteran',
    level: attackerLevel,
    hpMax: attackerHpMax,
    hpCurrent: attackerHpMax,
    STR: 18,
  });
  const dummy = buildFighter({
    name: 'Training Dummy',
    hpMax: 100,
    hpCurrent: 100,
    armorInstanceId: armor.id,
  });
  let campaign = engine.createCampaign({ name: `Hilda L${attackerLevel}` });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: armor },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: attacker } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dummy } satisfies CharacterCreatedEvent,
  ]);
  const created = engine.plan.createEncounter(campaign.state, {
    combatantIds: [attacker.id, dummy.id],
    name: 'Practice Yard',
  });
  campaign = commit(campaign, created.events);
  campaign = commit(campaign, [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'InitiativeRolled',
      encounterId: created.encounterId,
      rolls: [
        { combatantId: attacker.id, d20: 20, modifier: 4, total: 24 },
        { combatantId: dummy.id, d20: 5, modifier: 1, total: 6 },
      ],
    },
  ]);
  campaign = commit(
    campaign,
    engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events,
  );
  campaign = commit(
    campaign,
    engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId }).events,
  );
  return {
    engine,
    campaign,
    attackerId: attacker.id,
    targetId: dummy.id,
    weaponId: longsword.id,
    encounterId: created.encounterId,
  };
};

describe('golden: action economy (Extra Attack enforcement)', () => {
  it('Fighter L1 attacks once; second attack same turn throws', () => {
    let { engine, campaign, attackerId, targetId, weaponId } = setupDuel(1, 12);
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, { attackerId, targetId, weaponInstanceId: weaponId }).events,
    );
    expect(() =>
      engine.plan.attack(campaign.state, { attackerId, targetId, weaponInstanceId: weaponId }),
    ).toThrow(/Attack budget exhausted/);
  });

  it('Fighter L5 attacks twice; third attack same turn throws', async () => {
    let { engine, campaign, attackerId, targetId, weaponId, encounterId } = setupDuel(5, 40);
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, { attackerId, targetId, weaponInstanceId: weaponId }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, { attackerId, targetId, weaponInstanceId: weaponId }).events,
    );
    expect(() =>
      engine.plan.attack(campaign.state, { attackerId, targetId, weaponInstanceId: weaponId }),
    ).toThrow(/Attack budget exhausted/);

    campaign = commit(
      campaign,
      engine.plan.advanceTurn(campaign.state, { encounterId }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.advanceTurn(campaign.state, { encounterId }).events,
    );
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, { attackerId, targetId, weaponInstanceId: weaponId }).events,
    );

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Fighter L5 makes two attacks per Action thanks to Extra Attack',
      }),
    ).toMatchFileSnapshot('./transcripts/s8-action-economy.transcript.md');
  });

  it('attacks outside an active encounter ignore the budget (free practice)', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const longsword = makeItemInstance('longsword');
    const a = buildFighter({ name: 'Free' });
    const t = buildFighter({ name: 'Target', hpMax: 50, hpCurrent: 50 });
    let campaign = engine.createCampaign({ name: 'practice' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, { attackerId: a.id, targetId: t.id, weaponInstanceId: longsword.id }).events,
    );
    expect(() =>
      engine.plan.attack(campaign.state, { attackerId: a.id, targetId: t.id, weaponInstanceId: longsword.id }),
    ).not.toThrow();
  });
});
