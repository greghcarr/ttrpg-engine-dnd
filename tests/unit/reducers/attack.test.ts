import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  AttackRolledEvent,
  DamageRolledEvent,
} from '../../../src/schemas/events/attack.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';

const seed = () => {
  const attacker = buildFighter();
  const target = buildFighter({ hpCurrent: 20, hpMax: 20 });
  let state = apply(emptyCampaignState(), {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: attacker,
  } satisfies CharacterCreatedEvent);
  state = apply(state, {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: target,
  } satisfies CharacterCreatedEvent);
  return { state, attackerId: attacker.id, targetId: target.id };
};

describe('Attack chain reducers', () => {
  it('AttackRolled is record-only, does not mutate state', () => {
    const { state, attackerId, targetId } = seed();
    const event: AttackRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'AttackRolled',
      attackerId,
      targetId,
      weaponInstanceId: '01HKQM3J6S1H4ZGSTPYBHN0VCS',
      d20: [15],
      used: 'none',
      attackBonus: 5,
      total: 20,
      targetAC: 14,
      hit: true,
      critical: false,
    };
    const next = apply(state, event);
    expect(next.characters[targetId]?.hp.current).toBe(20);
    expect(next.version).toBe(state.version + 1);
  });

  it('DamageRolled is record-only, paired with DamageApplied does the real work', () => {
    const { state, attackerId, targetId } = seed();
    const damageRolled: DamageRolledEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageRolled',
      attackerId,
      targetId,
      weaponInstanceId: '01HKQM3J6S1H4ZGSTPYBHN0VCS',
      rolls: [
        {
          expression: '1d8',
          rolls: [6],
          modifier: 3,
          type: 'slashing',
        },
      ],
      critical: false,
    };
    const damageApplied: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'DamageApplied',
      targetId,
      components: [{ amount: 9, type: 'slashing' }],
    };
    const next = applyAll(state, [damageRolled, damageApplied]);
    expect(next.characters[targetId]?.hp.current).toBe(20 - 9);
  });
});
