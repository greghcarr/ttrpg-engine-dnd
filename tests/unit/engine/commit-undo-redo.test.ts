import { describe, expect, it } from 'vitest';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { undo, redo } from '../../../src/engine/undo-redo.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { SCHEMA_VERSION } from '../../../src/version.js';
import { newCampaignId } from '../../../src/ids.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { HealedEvent, DamageAppliedEvent } from '../../../src/schemas/events/combat.js';

const newCampaign = (): Campaign => ({
  id: newCampaignId(),
  name: 'Test',
  state: emptyCampaignState(),
  events: [],
  cursor: 0,
  schemaVersion: SCHEMA_VERSION,
});

describe('commit', () => {
  it('appends events and advances cursor', () => {
    const character = buildFighter();
    const create: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    };
    const next = commit(newCampaign(), [create]);
    expect(next.events).toHaveLength(1);
    expect(next.cursor).toBe(1);
    expect(next.state.characters[character.id]).toBeDefined();
  });
});

describe('undo / redo', () => {
  it('undo reverts cursor', () => {
    const character = buildFighter({ hpMax: 12, hpCurrent: 12 });
    const create: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    };
    const dmg: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(10),
      type: 'DamageApplied',
      targetId: character.id,
      components: [{ amount: 5, type: 'fire' }],
    };
    let c = commit(newCampaign(), [create, dmg]);
    expect(c.state.characters[character.id]?.hp.current).toBe(7);
    c = undo(c);
    expect(c.cursor).toBe(1);
    expect(c.state.characters[character.id]?.hp.current).toBe(12);
    c = undo(c);
    expect(c.cursor).toBe(0);
    expect(c.state.characters[character.id]).toBeUndefined();
  });

  it('undo at cursor 0 is a no-op', () => {
    const c = newCampaign();
    expect(undo(c).cursor).toBe(0);
  });

  it('redo advances cursor', () => {
    const character = buildFighter({ hpMax: 12, hpCurrent: 12 });
    const create: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    };
    let c = commit(newCampaign(), [create]);
    c = undo(c);
    c = redo(c);
    expect(c.cursor).toBe(1);
    expect(c.state.characters[character.id]).toBeDefined();
  });

  it('redo at end is a no-op', () => {
    const c = newCampaign();
    expect(redo(c).cursor).toBe(0);
  });

  it('commit after undo truncates the redo stack', () => {
    const character = buildFighter({ hpMax: 12, hpCurrent: 12 });
    const create: CharacterCreatedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated',
      snapshot: character,
    };
    const dmg1: DamageAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(10),
      type: 'DamageApplied',
      targetId: character.id,
      components: [{ amount: 3, type: 'fire' }],
    };
    const heal: HealedEvent = {
      id: eventId(),
      at: isoTimestamp(20),
      type: 'Healed',
      targetId: character.id,
      amount: 2,
    };
    let c = commit(newCampaign(), [create, dmg1]);
    c = undo(c);
    c = commit(c, [heal]);
    expect(c.events).toHaveLength(2);
    expect(c.events[1]?.type).toBe('Healed');
  });
});
