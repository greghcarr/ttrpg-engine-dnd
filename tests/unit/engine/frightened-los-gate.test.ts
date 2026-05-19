// Slice 276 — Frightened condition: breadth extension + LoS gate.
//
// RAW (SRD 5.2.1 Frightened): "Disadvantage on ability checks and
// attack rolls while the source of fear is within line of sight."
//
// Pre-276 the wire had two simultaneous bugs:
// 1. Narrow breadth: only STR check disadvantage (missing DEX, CON,
//    INT, WIS, CHA).
// 2. Missing LoS gate: STR-check + attack disadvantage applied
//    unconditionally, even when the source of fear was out of sight.
//
// Slice 276 fixes both: breadth via the slice-266 check wildcard;
// LoS via the new `bearer.canSeeFearSource` consumer-supplied
// predicate fact. Default-apply semantics (undefined or true fires
// the disadvantage; only explicit false bypasses).
import { describe, expect, it } from 'vitest';
import { computeAbilityCheck } from '../../../src/derive/ability-check.js';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../../src/schemas/runtime/item-instance.js';
import {
  newCharacterId,
  newItemInstanceId,
  newAppliedConditionId,
  newEncounterId,
} from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ConditionAppliedEvent } from '../../../src/schemas/events/combat.js';
import type {
  EncounterCreatedEvent,
  EncounterStartedEvent,
  InitiativeRolledEvent,
  TurnStartedEvent,
} from '../../../src/schemas/events/encounter.js';
import type { AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { AbilityScore } from '../../../src/schemas/primitives.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildBearer = (swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Bearer',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 14, DEX: 14, CON: 14, INT: 12, WIS: 12, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
    appliedConditions: [
      {
        id: newAppliedConditionId(),
        conditionId: 'frightened',
        appliedAt: isoTimestamp(),
      },
    ],
  });

const buildPlain = (swordId: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Plain',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 14, DEX: 14, CON: 14, INT: 12, WIS: 12, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    inventory: [swordId],
    equipped: { mainHand: swordId, attuned: [] },
  });

const ABILITIES: AbilityScore[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

describe('slice 276: Frightened breadth (all 6 ability checks) + LoS gate', () => {
  describe('ability-check disadvantage (breadth + LoS)', () => {
    it('Frightened bearer with undefined LoS fact gets disadvantage on every ability check (default-apply)', () => {
      const swordId = newItemInstanceId();
      const bearer = buildBearer(swordId);
      for (const ability of ABILITIES) {
        const r = computeAbilityCheck({
          character: bearer,
          itemInstances: {},
          content: CONTENT,
          ability,
        });
        expect(r.hasDisadvantage).toBe(true);
      }
    });

    it('Frightened bearer with bearerCanSeeFearSource=true gets disadvantage on every ability check', () => {
      const swordId = newItemInstanceId();
      const bearer = buildBearer(swordId);
      for (const ability of ABILITIES) {
        const r = computeAbilityCheck({
          character: bearer,
          itemInstances: {},
          content: CONTENT,
          ability,
          bearerCanSeeFearSource: true,
        });
        expect(r.hasDisadvantage).toBe(true);
      }
    });

    it('Frightened bearer with bearerCanSeeFearSource=false has NO disadvantage on any ability check (LoS bypass)', () => {
      const swordId = newItemInstanceId();
      const bearer = buildBearer(swordId);
      for (const ability of ABILITIES) {
        const r = computeAbilityCheck({
          character: bearer,
          itemInstances: {},
          content: CONTENT,
          ability,
          bearerCanSeeFearSource: false,
        });
        expect(r.hasDisadvantage).toBe(false);
      }
    });

    it('Non-Frightened bearer has no disadvantage from this condition', () => {
      const swordId = newItemInstanceId();
      const plain = buildPlain(swordId);
      for (const ability of ABILITIES) {
        const r = computeAbilityCheck({
          character: plain,
          itemInstances: {},
          content: CONTENT,
          ability,
        });
        expect(r.hasDisadvantage).toBe(false);
      }
    });
  });

  describe('attack-roll disadvantage (LoS gate)', () => {
    const setupAttack = (bearer: Character, target: Character, swordId: string, weapon: ItemInstance) => {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(276) });
      let campaign: Campaign = engine.createCampaign({ name: 'frightened-los' });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: weapon },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: bearer } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const encounterId = newEncounterId();
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'EncounterCreated', encounterId, combatantIds: [bearer.id, target.id] } satisfies EncounterCreatedEvent,
        {
          id: eventId(),
          at: isoTimestamp(),
          type: 'InitiativeRolled',
          encounterId,
          rolls: [
            { combatantId: bearer.id, d20: 20, modifier: 0, total: 20 },
            { combatantId: target.id, d20: 5, modifier: 0, total: 5 },
          ],
        } satisfies InitiativeRolledEvent,
        { id: eventId(), at: isoTimestamp(), type: 'EncounterStarted', encounterId } satisfies EncounterStartedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'TurnStarted', encounterId, combatantId: bearer.id, round: 1 } satisfies TurnStartedEvent,
      ]);
      return { engine, campaign };
    };

    const findAttack = (events: ReadonlyArray<unknown>): AttackRolledEvent =>
      events.find((e): e is AttackRolledEvent => (e as { type?: string }).type === 'AttackRolled')!;

    it('Frightened attacker with undefined LoS fact rolls with disadvantage (default-apply)', () => {
      const swordId = newItemInstanceId();
      const weapon: ItemInstance = ItemInstanceSchema.parse({ id: swordId, definitionId: 'longsword' });
      const bearer = buildBearer(swordId);
      const target = buildPlain(swordId);
      const { engine, campaign } = setupAttack(bearer, target, swordId, weapon);
      const events = engine.plan.attack(campaign.state, {
        attackerId: bearer.id,
        targetId: target.id,
        weaponInstanceId: swordId,
      }).events;
      const attack = findAttack(events);
      expect(attack.used).toBe('disadvantage');
      expect(attack.d20).toHaveLength(2);
    });

    it('Frightened attacker with bearerCanSeeFearSource=false rolls with NO disadvantage (LoS bypass)', () => {
      const swordId = newItemInstanceId();
      const weapon: ItemInstance = ItemInstanceSchema.parse({ id: swordId, definitionId: 'longsword' });
      const bearer = buildBearer(swordId);
      const target = buildPlain(swordId);
      const { engine, campaign } = setupAttack(bearer, target, swordId, weapon);
      const events = engine.plan.attack(campaign.state, {
        attackerId: bearer.id,
        targetId: target.id,
        weaponInstanceId: swordId,
        bearerCanSeeFearSource: false,
      }).events;
      const attack = findAttack(events);
      expect(attack.used).toBe('none');
      expect(attack.d20).toHaveLength(1);
    });

    it('Frightened attacker with bearerCanSeeFearSource=true rolls with disadvantage', () => {
      const swordId = newItemInstanceId();
      const weapon: ItemInstance = ItemInstanceSchema.parse({ id: swordId, definitionId: 'longsword' });
      const bearer = buildBearer(swordId);
      const target = buildPlain(swordId);
      const { engine, campaign } = setupAttack(bearer, target, swordId, weapon);
      const events = engine.plan.attack(campaign.state, {
        attackerId: bearer.id,
        targetId: target.id,
        weaponInstanceId: swordId,
        bearerCanSeeFearSource: true,
      }).events;
      const attack = findAttack(events);
      expect(attack.used).toBe('disadvantage');
      expect(attack.d20).toHaveLength(2);
    });
  });
});
