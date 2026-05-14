// One-off instrumentation: confirms the random combat generator
// actually reaches "interesting" terminal states (combatants going
// down, rounds advancing, conditions stacking) so the no-failure
// signal from the property tests is meaningful and not just "the
// generator never reached real combat behavior."
//
// This file is NOT a property test; it runs once with 100 fights and
// prints aggregate stats. Skip in CI if it gets flaky.

import { describe, expect, it } from 'vitest';
import { ulid } from 'ulid';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { commit, type Campaign } from '../../src/engine/commit.js';
import {
  TEST_PACK,
  buildFighter,
  makeItemInstance,
  isoTimestamp,
} from '../fixtures/index.js';
import type { Event } from '../../src/schemas/events/index.js';

const mulberry32 = (seed: number) => {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickFrom = <T>(rand: () => number, arr: ReadonlyArray<T>): T => arr[Math.floor(rand() * arr.length)]!;

describe('instrumentation: random combat generator reaches real states', () => {
  it('aggregate stats over 100 fights', () => {
    let totalRoundsAdvanced = 0;
    let fightsWithADown = 0;
    let totalDamageEvents = 0;
    let totalAttackRolledEvents = 0;
    let totalDeathSaveEvents = 0;

    const FIGHTS = 100;
    for (let seed = 1; seed <= FIGHTS; seed++) {
      const rand = mulberry32(seed);
      const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(seed) });
      const n = 2 + (seed % 3); // 2-4 fighters
      const fighters: ReturnType<typeof buildFighter>[] = [];
      const armorIs: ReturnType<typeof makeItemInstance>[] = [];
      const weaponIs: ReturnType<typeof makeItemInstance>[] = [];
      for (let i = 0; i < n; i++) {
        const armor = makeItemInstance('chain-mail');
        const weapon = makeItemInstance('longsword');
        armorIs.push(armor);
        weaponIs.push(weapon);
        fighters.push(
          buildFighter({
            name: `F${i}`,
            STR: 12 + Math.floor(rand() * 8),
            DEX: 10 + Math.floor(rand() * 8),
            hpMax: 8 + Math.floor(rand() * 13),
            armorInstanceId: armor.id,
            level: 1 + Math.floor(rand() * 5),
          }),
        );
      }
      let campaign: Campaign = engine.createCampaign({ name: `i-${seed}` });
      const seedEvents: Event[] = [];
      for (let i = 0; i < n; i++) {
        seedEvents.push({ id: ulid() as Event['id'], at: isoTimestamp(i), type: 'ItemAcquired', instance: armorIs[i]! });
        seedEvents.push({ id: ulid() as Event['id'], at: isoTimestamp(i), type: 'ItemAcquired', instance: weaponIs[i]! });
        seedEvents.push({ id: ulid() as Event['id'], at: isoTimestamp(i), type: 'CharacterCreated', snapshot: fighters[i]! });
      }
      campaign = commit(campaign, seedEvents);
      const equipEvents: Event[] = fighters.map((f, i) => ({
        id: ulid() as Event['id'],
        at: isoTimestamp(),
        type: 'ItemEquipped',
        characterId: f.id,
        instanceId: weaponIs[i]!.id,
        slot: 'mainHand',
      }));
      campaign = commit(campaign, equipEvents);

      const created = engine.plan.createEncounter(campaign.state, { combatantIds: fighters.map((f) => f.id) });
      campaign = commit(campaign, created.events);
      campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events);
      campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events);
      const posEvents: Event[] = [];
      for (let i = 0; i < n; i++) {
        const enc = campaign.state.encounters[created.encounterId]!;
        const c = enc.combatants[i]!;
        posEvents.push({
          id: ulid() as Event['id'],
          at: isoTimestamp(),
          type: 'CombatantMoved',
          encounterId: created.encounterId,
          combatantId: c.combatantId,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 5 + i * 3, y: 5 + (i % 2) * 3 },
          feetTraveled: 0,
        });
      }
      campaign = commit(campaign, posEvents);
      campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId }).events);

      const startRound = campaign.state.encounters[created.encounterId]!.round;
      let stepsTaken = 0;
      while (stepsTaken < 60) {
        const enc = campaign.state.encounters[created.encounterId];
        if (!enc || enc.status !== 'active') break;
        const active = enc.combatants[enc.activeIndex];
        if (!active) break;
        const me = active.combatantId;
        const character = campaign.state.characters[me]!;
        if (character.hp.current <= 0) {
          try {
            campaign = commit(campaign, engine.plan.advanceTurn(campaign.state, { encounterId: created.encounterId }).events);
          } catch { break; }
          stepsTaken++;
          continue;
        }
        const targets = fighters.filter((f) => f.id !== me && (campaign.state.characters[f.id]?.hp.current ?? 0) > 0);
        try {
          const wi = fighters.findIndex((f) => f.id === me);
          let events: ReadonlyArray<Event> = [];
          if (targets.length > 0 && !active.turnUsage.actionUsed && rand() < 0.7) {
            const target = pickFrom(rand, targets);
            events = engine.plan.attack(campaign.state, {
              attackerId: me,
              targetId: target.id,
              weaponInstanceId: weaponIs[wi]!.id,
            }).events;
          } else {
            events = engine.plan.advanceTurn(campaign.state, { encounterId: created.encounterId }).events;
          }
          campaign = commit(campaign, events);
        } catch {
          try { campaign = commit(campaign, engine.plan.advanceTurn(campaign.state, { encounterId: created.encounterId }).events); } catch { break; }
        }
        stepsTaken++;
      }
      const finalRound = campaign.state.encounters[created.encounterId]!.round;
      totalRoundsAdvanced += finalRound - startRound;
      if (fighters.some((f) => (campaign.state.characters[f.id]?.hp.current ?? 0) <= 0)) {
        fightsWithADown++;
      }
      for (const e of campaign.events) {
        if (e.type === 'DamageApplied') totalDamageEvents++;
        if (e.type === 'AttackRolled') totalAttackRolledEvents++;
        if (e.type === 'DeathSaveRolled') totalDeathSaveEvents++;
      }
    }

    console.log(`\n  === Combat generator instrumentation (${FIGHTS} fights) ===`);
    console.log(`  Total rounds advanced:      ${totalRoundsAdvanced} (avg ${(totalRoundsAdvanced / FIGHTS).toFixed(1)})`);
    console.log(`  Fights with ≥1 down:        ${fightsWithADown} / ${FIGHTS}`);
    console.log(`  Total AttackRolled events:  ${totalAttackRolledEvents}`);
    console.log(`  Total DamageApplied events: ${totalDamageEvents}`);
    console.log(`  Total DeathSaveRolled events: ${totalDeathSaveEvents}`);
    console.log();

    // Hard floors so this test fails loudly if the generator silently
    // stops doing real work:
    expect(fightsWithADown).toBeGreaterThan(FIGHTS / 2);
    expect(totalAttackRolledEvents).toBeGreaterThan(FIGHTS); // > 1 attack/fight on average
    expect(totalDeathSaveEvents).toBeGreaterThan(0); // auto-saves are firing
  });
});
