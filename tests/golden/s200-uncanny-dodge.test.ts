// Golden scenario: Rogue L5 Uncanny Dodge.
//
// RAW (SRD 5.2.1): "When an attacker that you can see hits you with
// an attack roll, you can take a Reaction to halve the attack's
// damage against you (round down)."
//
// Sequence:
//   1. Bruiser (fighter L5) hits an L5 Rogue with a longsword.
//   2. The damage commits.
//   3. The Rogue spends a reaction on Uncanny Dodge.
//   4. The engine emits a compensating Healed for floor(damage / 2)
//      plus an UncannyDodgeUsed notification.
//
// The transcript snapshot captures the full sequence — the original
// damage application, the reaction consumption, the half-heal, and
// the notification — so a future change that breaks Uncanny Dodge
// surfaces as a diff in the checked-in markdown.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId, newEncounterId } from '../../src/ids.js';
import { eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { AttackRolledEvent, DamageRolledEvent } from '../../src/schemas/events/attack.js';
import type { DamageAppliedEvent } from '../../src/schemas/events/combat.js';
import type {
  EncounterCreatedEvent,
  InitiativeRolledEvent,
  EncounterStartedEvent,
  TurnStartedEvent,
} from '../../src/schemas/events/encounter.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildBruiser = (longswordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bruiser',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [longswordId],
    equipped: { mainHand: longswordId, attuned: [] },
  });

const buildRogue = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Veska',
    speciesId: 'human',
    backgroundId: 'criminal',
    classes: [{ classId: 'rogue', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 10, DEX: 18, CON: 12, INT: 14, WIS: 10, CHA: 10 },
    hp: { current: 30, max: 30, temp: 0 },
    featsTaken: [],
  });

const longsword = (): ItemInstance =>
  ItemInstanceSchema.parse({ id: newItemInstanceId(), definitionId: 'longsword' });

describe('golden: Rogue L5 Uncanny Dodge', () => {
  it('halves an incoming attack via a reaction-driven compensating Healed', async () => {
    let attempt = 0;
    while (attempt < 100) {
      attempt += 1;
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(attempt + 1000) });
      const sword = longsword();
      const bruiser = buildBruiser(sword.id);
      const veska = buildRogue();

      let campaign = engine.createCampaign({ name: `uncanny-dodge-${attempt}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: sword },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bruiser } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: veska } satisfies CharacterCreatedEvent,
      ]);

      const encounterId = newEncounterId();
      campaign = commit(campaign, [
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'EncounterCreated',
          encounterId,
          name: 'Alley Brawl',
          combatantIds: [bruiser.id, veska.id],
        } satisfies EncounterCreatedEvent,
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'InitiativeRolled',
          encounterId,
          rolls: [
            { combatantId: bruiser.id, d20: 15, modifier: 1, total: 16 },
            { combatantId: veska.id, d20: 10, modifier: 4, total: 14 },
          ],
        } satisfies InitiativeRolledEvent,
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'EncounterStarted',
          encounterId,
        } satisfies EncounterStartedEvent,
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'TurnStarted',
          encounterId,
          combatantId: bruiser.id,
          round: 1,
        } satisfies TurnStartedEvent,
      ]);

      const attack = engine.plan.attack(campaign.state, {
        attackerId: bruiser.id,
        targetId: veska.id,
        weaponInstanceId: sword.id,
      }).events;
      const attackRolled = attack.find((e) => e.type === 'AttackRolled') as AttackRolledEvent | undefined;
      if (attackRolled?.hit !== true) continue;
      const damageApplied = attack.find((e) => e.type === 'DamageApplied') as DamageAppliedEvent | undefined;
      if (damageApplied === undefined) continue;
      const damageRolled = attack.find((e) => e.type === 'DamageRolled') as DamageRolledEvent | undefined;
      if (damageRolled === undefined) continue;

      campaign = commit(campaign, attack);

      const totalIncoming = damageApplied.components.reduce((s, c) => s + c.amount, 0);
      const hpAfterHit = campaign.state.characters[veska.id]!.hp.current;

      const dodge = engine.plan.uncannyDodge(campaign.state, {
        characterId: veska.id,
        triggeringDamageEventId: damageApplied.id,
        damageAmount: totalIncoming,
      });
      campaign = commit(campaign, dodge.events);

      const hpAfterDodge = campaign.state.characters[veska.id]!.hp.current;
      expect(hpAfterDodge - hpAfterHit).toBe(Math.floor(totalIncoming / 2));

      const replayed = replay(campaign.events);
      expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
      void throwOnCallRNG();
      expect(() => replay(campaign.events)).not.toThrow();

      await expect(
        formatTranscript(campaign.events, CONTENT, {
          title: 'Rogue L5 Uncanny Dodge: reaction halves an incoming hit',
        }),
      ).toMatchFileSnapshot('./transcripts/s200-uncanny-dodge.transcript.md');
      return;
    }
    throw new Error('Uncanny Dodge golden could not find a hitting seed across 100 attempts');
  });
});
