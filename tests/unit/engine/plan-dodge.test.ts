import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import {
  TEST_PACK,
  buildFighter,
  eventId,
  isoTimestamp,
  makeItemInstance,
} from '../../fixtures/index.js';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { resolveContent } from '../../../src/content/pack.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';

const CONTENT = resolveContent([TEST_PACK]);

const seedEncounter = () => {
  const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(7) });
  const longsword = makeItemInstance('longsword');
  const armor = makeItemInstance('chain-mail');
  const a = buildFighter({ name: 'A', STR: 16 });
  const b = buildFighter({ name: 'B', hpMax: 30, hpCurrent: 30, armorInstanceId: armor.id });
  let campaign = engine.createCampaign({ name: 'dodge' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
    { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: armor },
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
  ]);
  const created = engine.plan.createEncounter(campaign.state, { combatantIds: [a.id, b.id] });
  campaign = commit(campaign, created.events);
  campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: created.encounterId }).events);
  campaign = commit(campaign, engine.plan.startEncounter(campaign.state, { encounterId: created.encounterId }).events);
  campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: created.encounterId }).events);
  return { engine, campaign, encounterId: created.encounterId, aId: a.id, bId: b.id, weaponId: longsword.id };
};

describe('planDodge', () => {
  it('emits ActionEconomyConsumed(action) + ConditionApplied(dodged)', () => {
    const { engine, campaign, encounterId } = seedEncounter();
    const enc = campaign.state.encounters[encounterId]!;
    const activeId = enc.combatants[enc.activeIndex]!.combatantId;
    const { events } = engine.plan.dodge(campaign.state, { combatantId: activeId });
    expect(events.map((e) => e.type)).toEqual(['ActionEconomyConsumed', 'ConditionApplied']);
    const cond = events.find((e) => e.type === 'ConditionApplied');
    if (cond?.type === 'ConditionApplied') {
      expect(cond.conditionId).toBe('dodged');
      expect(cond.targetId).toBe(activeId);
    }
  });

  it('after Dodge, attacks against the dodger have disadvantage (effect stack)', () => {
    const { engine, campaign, encounterId } = seedEncounter();
    const enc = campaign.state.encounters[encounterId]!;
    const activeId = enc.combatants[enc.activeIndex]!.combatantId;
    const after = commit(campaign, engine.plan.dodge(campaign.state, { combatantId: activeId }).events);
    const dodger = after.state.characters[activeId]!;
    const stack = buildEffectStack({
      character: dodger,
      itemInstances: after.state.itemInstances,
      content: CONTENT,
    });
    expect(stack.imposesDisadvantageOnAttackers()).toBe(true);
  });

  it('rejects when not the active combatant', () => {
    const { engine, campaign, encounterId } = seedEncounter();
    const enc = campaign.state.encounters[encounterId]!;
    // Pick the non-active one.
    const inactiveId = enc.combatants.find((_, i) => i !== enc.activeIndex)!.combatantId;
    expect(() => engine.plan.dodge(campaign.state, { combatantId: inactiveId })).toThrow(/active/);
  });

  it('rejects when the action is already used', () => {
    const { engine, campaign, encounterId } = seedEncounter();
    const enc = campaign.state.encounters[encounterId]!;
    const activeId = enc.combatants[enc.activeIndex]!.combatantId;
    const after = commit(campaign, engine.plan.dodge(campaign.state, { combatantId: activeId }).events);
    expect(() => engine.plan.dodge(after.state, { combatantId: activeId })).toThrow(/Action already used/);
  });
});
