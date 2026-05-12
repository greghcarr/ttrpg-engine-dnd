// Showcase scenario: a full narrative run-through combining combat,
// spellcasting, healing, conditions, death saves, and rest. Designed
// for readable transcript output as documentation. Initiative is
// pinned to a fixed order so the narrative reads cleanly; the rest of
// the rolls flow from the seeded RNG.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit, type Campaign } from '../../src/engine/commit.js';
import {
  TEST_PACK,
  TEST_CONTENT,
  buildFighter,
  eventId,
  isoTimestamp,
  makeItemInstance,
} from '../fixtures/index.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../src/ids.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type {
  ConditionAppliedEvent,
  ConditionRemovedEvent,
  DamageAppliedEvent,
  DeathSaveRolledEvent,
} from '../../src/schemas/events/combat.js';
import type { HitDieSpentEvent } from '../../src/schemas/events/resources.js';
import type {
  EncounterStartedEvent,
  InitiativeRolledEvent,
} from '../../src/schemas/events/encounter.js';
import type { Event } from '../../src/schemas/events/index.js';
import { formatTranscript } from '../transcript.js';

const buildWizard = (name: string, hp: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: hp, max: hp, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['fire-bolt', 'fireball', 'magic-missile'],
  });

const buildPaladin = (name: string, hp: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'paladin', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 16, DEX: 10, CON: 14, INT: 10, WIS: 12, CHA: 16 },
    hp: { current: hp, max: hp, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['cure-wounds'],
  });

describe('golden: showcase party adventure', () => {
  it('three-PC party fights two goblins, with healing and a death save', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(19) });
    let clock = 0;
    const at = (): string => isoTimestamp((clock += 1));
    const evt = <T extends Event>(e: Omit<T, 'id' | 'at'>): T =>
      ({ id: eventId(), at: at(), ...e }) as T;

    const alyxSword = makeItemInstance('longsword');
    const alyxArmor = makeItemInstance('chain-shirt');
    const cassiusSword = makeItemInstance('longsword');
    const cassiusArmor = makeItemInstance('chain-shirt');
    const goblinAClub = makeItemInstance('longsword');
    const goblinBClub = makeItemInstance('longsword');

    const alyx = buildFighter({
      name: 'Alyx',
      level: 3,
      hpMax: 26,
      hpCurrent: 26,
      STR: 18,
      DEX: 14,
      CON: 14,
      armorInstanceId: alyxArmor.id,
    });
    const mira = buildWizard('Mira', 28);
    const cassius = buildPaladin('Brother Cassius', 40);
    const goblinA = buildFighter({
      name: 'Goblin Boss',
      level: 1,
      hpMax: 21,
      hpCurrent: 21,
      STR: 12,
      DEX: 14,
      CON: 12,
    });
    const goblinB = buildFighter({
      name: 'Goblin Cutter',
      level: 1,
      hpMax: 14,
      hpCurrent: 14,
      STR: 8,
      DEX: 14,
      CON: 10,
    });

    let campaign: Campaign = engine.createCampaign({ name: 'showcase' });
    campaign = commit(campaign, [
      evt<import('../../src/schemas/events/inventory.js').ItemAcquiredEvent>({ type: 'ItemAcquired', instance: alyxSword }),
      evt<import('../../src/schemas/events/inventory.js').ItemAcquiredEvent>({ type: 'ItemAcquired', instance: alyxArmor }),
      evt<import('../../src/schemas/events/inventory.js').ItemAcquiredEvent>({ type: 'ItemAcquired', instance: cassiusSword }),
      evt<import('../../src/schemas/events/inventory.js').ItemAcquiredEvent>({ type: 'ItemAcquired', instance: cassiusArmor }),
      evt<import('../../src/schemas/events/inventory.js').ItemAcquiredEvent>({ type: 'ItemAcquired', instance: goblinAClub }),
      evt<import('../../src/schemas/events/inventory.js').ItemAcquiredEvent>({ type: 'ItemAcquired', instance: goblinBClub }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: mira }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: cassius }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: goblinA }),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: goblinB }),
    ]);

    const enc = engine.plan.createEncounter(campaign.state, {
      combatantIds: [alyx.id, mira.id, cassius.id, goblinA.id, goblinB.id],
      name: 'Goblin Ambush at the Old Bridge',
    });
    campaign = commit(campaign, enc.events);

    // Hand-rolled initiative: pin the narrative order. Alyx, Cassius,
    // Boss, Cutter, Mira. The melee front line acts before the
    // glass-cannon mage, who closes the round with Fireball.
    const initiative: InitiativeRolledEvent = evt<InitiativeRolledEvent>({
      type: 'InitiativeRolled',
      encounterId: enc.encounterId,
      rolls: [
        { combatantId: alyx.id, d20: 18, modifier: 2, total: 20 },
        { combatantId: cassius.id, d20: 16, modifier: 0, total: 16 },
        { combatantId: goblinA.id, d20: 12, modifier: 2, total: 14 },
        { combatantId: goblinB.id, d20: 10, modifier: 2, total: 12 },
        { combatantId: mira.id, d20: 8, modifier: 2, total: 10 },
      ],
    });
    campaign = commit(campaign, [initiative]);
    campaign = commit(campaign, [
      evt<EncounterStartedEvent>({ type: 'EncounterStarted', encounterId: enc.encounterId }),
    ]);
    campaign = commit(
      campaign,
      engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events,
    );

    const advance = (): void => {
      campaign = commit(
        campaign,
        engine.plan.advanceTurn(campaign.state, { encounterId: enc.encounterId }).events,
      );
    };

    // --- Round 1 ---

    // Alyx leads, swings at the Boss with advantage (flanking).
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, {
        attackerId: alyx.id,
        targetId: goblinA.id,
        weaponInstanceId: alyxSword.id,
        advantage: 'advantage',
      }).events,
    );
    advance();

    // Cassius engages the Cutter.
    campaign = commit(
      campaign,
      engine.plan.attack(campaign.state, {
        attackerId: cassius.id,
        targetId: goblinB.id,
        weaponInstanceId: cassiusSword.id,
      }).events,
    );
    advance();

    // Goblin Boss returns the favor on Alyx. Inject a heavy hit so the
    // scenario reaches a death-save moment; the engine handles direct
    // DamageApplied events the same as planner-emitted ones.
    campaign = commit(campaign, [
      evt<DamageAppliedEvent>({
        type: 'DamageApplied',
        targetId: alyx.id,
        components: [{ amount: 16, type: 'slashing' }],
      }),
    ]);
    advance();

    // The Cutter, wounded but enraged, drops Alyx prone at 0 HP.
    const alyxAfterBoss = campaign.state.characters[alyx.id]?.hp.current ?? 0;
    campaign = commit(campaign, [
      evt<DamageAppliedEvent>({
        type: 'DamageApplied',
        targetId: alyx.id,
        components: [{ amount: alyxAfterBoss, type: 'slashing' }],
      }),
      evt<ConditionAppliedEvent>({
        type: 'ConditionApplied',
        targetId: alyx.id,
        conditionId: 'prone',
      }),
    ]);
    advance();

    // Mira closes the round with Fireball, taking advantage of the
    // bunched-up goblins and the prone fighter still being on the
    // ground.
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: mira.id,
        spellId: 'fireball',
        slotLevel: 3,
        targetIds: [goblinA.id, goblinB.id],
      }).events,
    );
    advance(); // round ends, round 2 begins

    // --- Round 2 ---

    // Alyx, bleeding out, rolls a death save. Success.
    campaign = commit(campaign, [
      evt<DeathSaveRolledEvent>({
        type: 'DeathSaveRolled',
        targetId: alyx.id,
        d20: 14,
        success: true,
        critical: false,
      }),
    ]);
    advance();

    // Cassius drops to a knee and casts Cure Wounds on Alyx.
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: cassius.id,
        spellId: 'cure-wounds',
        slotLevel: 1,
        targetIds: [alyx.id],
        castingClassId: 'paladin',
      }).events,
    );
    campaign = commit(campaign, [
      evt<ConditionRemovedEvent>({
        type: 'ConditionRemoved',
        targetId: alyx.id,
        conditionId: 'prone',
      }),
    ]);
    advance();

    // Goblin Boss, if still standing, throws a last desperate swing.
    const bossAlive = (campaign.state.characters[goblinA.id]?.hp.current ?? 0) > 0;
    if (bossAlive) {
      campaign = commit(
        campaign,
        engine.plan.attack(campaign.state, {
          attackerId: goblinA.id,
          targetId: cassius.id,
          weaponInstanceId: goblinAClub.id,
        }).events,
      );
    }
    advance();

    // Cutter is down; turn auto-advances.
    advance();

    // Mira finishes the Boss with Fire Bolt to end the fight cleanly.
    if ((campaign.state.characters[goblinA.id]?.hp.current ?? 0) > 0) {
      campaign = commit(
        campaign,
        engine.plan.castSpell(campaign.state, {
          characterId: mira.id,
          spellId: 'fire-bolt',
          slotLevel: 0,
          targetIds: [goblinA.id],
        }).events,
      );
    }
    advance(); // round 2 ends

    // --- Cleanup: stop the encounter ---
    // Whatever HP the goblins have left, narrative ends the fight.
    for (const goblinId of [goblinA.id, goblinB.id]) {
      const hp = campaign.state.characters[goblinId]?.hp.current ?? 0;
      if (hp > 0) {
        campaign = commit(campaign, [
          evt<DamageAppliedEvent>({
            type: 'DamageApplied',
            targetId: goblinId,
            components: [{ amount: hp, type: 'slashing' }],
          }),
        ]);
      }
    }

    campaign = commit(
      campaign,
      engine.plan.endEncounter(campaign.state, {
        encounterId: enc.encounterId,
        outcome: 'victory',
      }).events,
    );

    // --- Short rest: Alyx and Cassius each spend a hit die. ---
    const shortRest = engine.plan.shortRest(campaign.state, {
      participantIds: [alyx.id, mira.id, cassius.id],
    }).events;
    campaign = commit(campaign, [shortRest[0]!]);
    campaign = commit(campaign, [
      evt<HitDieSpentEvent>({
        type: 'HitDieSpent',
        characterId: alyx.id,
        die: 10,
        rolled: 6,
        conMod: 2,
        healed: 8,
      }),
      evt<HitDieSpentEvent>({
        type: 'HitDieSpent',
        characterId: cassius.id,
        die: 10,
        rolled: 4,
        conMod: 2,
        healed: 6,
      }),
    ]);
    campaign = commit(campaign, [shortRest[1]!]);

    // --- Long rest before the next session. ---
    campaign = commit(
      campaign,
      engine.plan.longRest(campaign.state, {
        participantIds: [alyx.id, mira.id, cassius.id],
      }).events,
    );

    // Architectural invariants still hold on this longer scenario.
    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Showcase: Goblin Ambush at the Old Bridge',
      }),
    ).toMatchFileSnapshot('./transcripts/showcase.transcript.md');
  });
});
