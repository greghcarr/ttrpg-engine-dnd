import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../src/ids.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import { cantripExtraDice } from '../../src/schemas/content/spell.js';
import { formatTranscript } from '../transcript.js';

const buildWizard = (level: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: `Wizard L${level}`,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level, hitDiceRemaining: level }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 12 + level * 6, max: 12 + level * 6, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['fire-bolt', 'fireball', 'detect-magic'],
  });

describe('golden: spellcasting polish (Slice 16)', () => {
  it('cantripExtraDice steps at L5, L11, L17', () => {
    expect(cantripExtraDice(1)).toBe(0);
    expect(cantripExtraDice(4)).toBe(0);
    expect(cantripExtraDice(5)).toBe(1);
    expect(cantripExtraDice(10)).toBe(1);
    expect(cantripExtraDice(11)).toBe(2);
    expect(cantripExtraDice(16)).toBe(2);
    expect(cantripExtraDice(17)).toBe(3);
    expect(cantripExtraDice(20)).toBe(3);
  });

  it('Fire Bolt at L1 rolls 1d10; at L5 rolls 2d10 thanks to cantrip scaling', async () => {
    const engineL1 = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(101) });
    const wizardL1 = buildWizard(1);
    const targetA = buildFighter({ name: 'Goblin', hpMax: 30, hpCurrent: 30 });
    let campaignL1 = engineL1.createCampaign({ name: 'firebolt-l1' });
    campaignL1 = commit(campaignL1, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizardL1 } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: targetA } satisfies CharacterCreatedEvent,
    ]);
    const { events: eventsL1 } = engineL1.plan.castSpell(campaignL1.state, {
      characterId: wizardL1.id,
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetIds: [targetA.id],
    });

    const engineL5 = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(101) });
    const wizardL5 = buildWizard(5);
    const targetB = buildFighter({ name: 'Goblin', hpMax: 30, hpCurrent: 30 });
    let campaignL5 = engineL5.createCampaign({ name: 'firebolt-l5' });
    campaignL5 = commit(campaignL5, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizardL5 } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: targetB } satisfies CharacterCreatedEvent,
    ]);
    const { events: eventsL5 } = engineL5.plan.castSpell(campaignL5.state, {
      characterId: wizardL5.id,
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetIds: [targetB.id],
    });

    const attackL1 = eventsL1.find((e) => e.type === 'AttackRolled');
    const attackL5 = eventsL5.find((e) => e.type === 'AttackRolled');
    if (attackL1?.type !== 'AttackRolled' || attackL5?.type !== 'AttackRolled') {
      throw new Error('expected AttackRolled events for both casts');
    }
    const damageL1 = eventsL1.find((e) => e.type === 'DamageRolled');
    const damageL5 = eventsL5.find((e) => e.type === 'DamageRolled');
    if (damageL1?.type !== 'DamageRolled' || damageL5?.type !== 'DamageRolled') {
      throw new Error('Both casts must hit; otherwise re-seed test');
    }
    const critMultiplier = (crit: boolean): number => (crit ? 2 : 1);
    expect(damageL1.rolls[0]!.rolls.length).toBe(1 * critMultiplier(attackL1.critical));
    expect(damageL5.rolls[0]!.rolls.length).toBe(2 * critMultiplier(attackL5.critical));

    campaignL5 = commit(campaignL5, eventsL5);
    const replayed = replay(campaignL5.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaignL5.state));
    void throwOnCallRNG();
    expect(() => replay(campaignL5.events)).not.toThrow();

    await expect(
      formatTranscript(campaignL5.events, TEST_CONTENT, {
        title: 'L5 wizard casts Fire Bolt: cantrip scaling rolls 2d10',
      }),
    ).toMatchFileSnapshot('./transcripts/s16-spellcasting-polish.transcript.md');
  });

  it('Detect Magic cast as ritual: no slot consumed, ritual flag set', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard(5);
    let campaign = engine.createCampaign({ name: 'ritual' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    const before = campaign.state.characters[wizard.id]!.spellSlotsUsed['1'] ?? 0;
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'detect-magic',
      slotLevel: 1,
      targetIds: [],
      asRitual: true,
    });
    const declared = events.find((e) => e.type === 'SpellCastDeclared');
    if (declared?.type !== 'SpellCastDeclared') throw new Error('expected SpellCastDeclared');
    expect(declared.castAsRitual).toBe(true);
    expect(events.some((e) => e.type === 'SpellSlotConsumed')).toBe(false);

    campaign = commit(campaign, events);
    const after = campaign.state.characters[wizard.id]!.spellSlotsUsed['1'] ?? 0;
    expect(after).toBe(before);
  });

  it('rejects ritual cast of a non-ritual spell', () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(1) });
    const wizard = buildWizard(5);
    let campaign = engine.createCampaign({ name: 'no-ritual' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: wizard.id,
        spellId: 'fireball',
        slotLevel: 3,
        targetIds: [],
        asRitual: true,
      }),
    ).toThrow(/cannot be cast as a ritual/);
  });

  it('Fireball carries area targeting metadata', () => {
    const fireball = TEST_CONTENT.spells.get('fireball');
    expect(fireball?.targeting).toEqual({ shape: 'sphere', size: 20 });
  });
});
