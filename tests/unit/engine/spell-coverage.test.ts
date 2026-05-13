// Spell-by-spell smoke test. For each spell shipped in the starter pack,
// we cast it under a controlled scenario and assert that the engine
// emits the events a D&D-knowledgeable reader expects to see. A leveled
// spell that ships in the pack with no mechanical effect at all (Magic
// Missile, Bless before they were wired up) fails this test, surfacing
// the gap.
//
// The intent table below is the source of truth for "what should this
// spell do, mechanically?". Each entry is short: just enough to identify
// the expected event kinds. Damage values aren't asserted (those are
// owned by tighter unit tests); we're catching omissions and shape
// drift here, not exact dice.
//
// `skip` is used for spells that have their own dedicated planner
// (counterspell, dispel-magic, identify) where planCastSpell isn't the
// right entry point, and for pure utility cantrips whose entire effect
// is narrative (mage-hand, prestidigitation, light, detect-magic). Every
// `skip` line carries a reason so it stays auditable.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { Event } from '../../../src/schemas/events/index.js';

type Expectation =
  | { kind: 'attack' }
  | { kind: 'save' }
  | { kind: 'heal' }
  | { kind: 'auto-hit'; minDarts: number }
  | { kind: 'buff'; conditionId: string }
  | { kind: 'remove-condition'; seedConditionId: string }
  | { kind: 'hp-pool-knockout' }
  | { kind: 'skip'; reason: string };

const SPELL_EXPECTATIONS: Record<string, Expectation> = {
  // Cantrips with explicit attack rolls
  'fire-bolt': { kind: 'attack' },
  'eldritch-blast': { kind: 'attack' },
  'ray-of-frost': { kind: 'attack' },
  'shocking-grasp': { kind: 'attack' },
  // Cantrip save spells
  'sacred-flame': { kind: 'save' },
  // L1+
  'magic-missile': { kind: 'auto-hit', minDarts: 3 },
  'fireball': { kind: 'save' },
  'burning-hands': { kind: 'save' },
  'thunderwave': { kind: 'save' },
  'hold-person': { kind: 'save' },
  'cure-wounds': { kind: 'heal' },
  'healing-word': { kind: 'heal' },
  'bless': { kind: 'buff', conditionId: 'blessed' },
  'spiritual-weapon': { kind: 'attack' },
  // Spells with dedicated planners (planCounterspell, planDispelMagic,
  // planIdentify) — castSpell isn't the right call site.
  'counterspell': { kind: 'skip', reason: 'has dedicated planCounterspell' },
  'dispel-magic': { kind: 'skip', reason: 'has dedicated planDispelMagic' },
  'identify': { kind: 'skip', reason: 'has dedicated planIdentify' },
  // Utility / narrative-only — cast emits no mechanical event.
  'mage-hand': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'prestidigitation': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'light': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'detect-magic': { kind: 'skip', reason: 'detection only, no mechanical effect' },
  'guidance': { kind: 'buff', conditionId: 'guided' },
  // Defensive / movement spells not yet mechanically modeled.
  'shield': { kind: 'skip', reason: 'has dedicated planShield (reaction, not planCastSpell)' },
  'mage-armor': { kind: 'buff', conditionId: 'mage-armored' },
  'misty-step': { kind: 'skip', reason: 'has dedicated planMistyStep (bonus action teleport, not planCastSpell)' },
  // Control / crowd-control spells not yet mechanically modeled.
  'faerie-fire': { kind: 'save' },
  'bane': { kind: 'save' },
  'sleep': { kind: 'hp-pool-knockout' },
  'web': { kind: 'save' },
  'spirit-guardians': { kind: 'skip', reason: 'aura-damage mechanic: cast itself emits only ConcentrationStarted; damage fires via engine.plan.tickAura per-turn' },
  // Buffs / utility spells with simple shapes not yet wired.
  'aid': { kind: 'heal' },
  'polymorph': { kind: 'skip', reason: 'has dedicated planPolymorph (not planCastSpell)' },
  'lesser-restoration': { kind: 'remove-condition', seedConditionId: 'poisoned' },
};

const buildWizard = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Spell Tester',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildCleric = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Spell Tester',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 10, CON: 14, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Dummy',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: ['savage-attacker'],
    armorClass: 8, // low so attack-roll spells reliably hit at a wizard's spell attack bonus
  });

const PACK = loadStarterPack();
const ALL_SPELL_IDS = PACK.spells.map((s) => s.id);

describe('spell coverage: each shipped spell emits the expected event kinds when cast', () => {
  it('every shipped spell has an entry in SPELL_EXPECTATIONS', () => {
    // The expectation table doubles as a check that the test wasn't
    // accidentally narrowed when new spells were added.
    const tableIds = new Set(Object.keys(SPELL_EXPECTATIONS));
    const missing = ALL_SPELL_IDS.filter((id) => !tableIds.has(id));
    expect(missing, `missing expectations for: ${missing.join(', ')}`).toEqual([]);
  });

  for (const spellId of ALL_SPELL_IDS) {
    const expectation = SPELL_EXPECTATIONS[spellId];
    if (expectation === undefined) continue;
    if (expectation.kind === 'skip') {
      it.skip(`${spellId}: ${expectation.reason}`, () => {});
      continue;
    }

    it(`${spellId}: emits a ${expectation.kind} event chain`, () => {
      const spell = PACK.spells.find((s) => s.id === spellId)!;
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
      // Use a cleric for heal / buff / remove-condition spells; wizard
      // for damage spells.
      const isClericalList = expectation.kind === 'heal'
        || expectation.kind === 'buff'
        || expectation.kind === 'remove-condition';
      const caster = isClericalList
        ? buildCleric([spellId])
        : buildWizard([spellId]);
      const t1 = buildTarget();
      const t2 = buildTarget();
      let campaign = engine.createCampaign({ name: `spell-${spellId}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t1 } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t2 } satisfies CharacterCreatedEvent,
      ]);
      // For remove-condition spells, seed the target with the condition
      // we expect to be removed.
      if (expectation.kind === 'remove-condition') {
        campaign = commit(campaign, [
          {
            id: eventId(),
            at: isoTimestamp(),
            type: 'ConditionApplied',
            targetId: t1.id,
            conditionId: expectation.seedConditionId,
          } as Extract<Event, { type: 'ConditionApplied' }>,
        ]);
      }
      // Magic Missile needs one target per dart; for other spells one or
      // two targets is fine.
      const targetIds = expectation.kind === 'auto-hit'
        ? Array.from({ length: expectation.minDarts }, () => t1.id)
        : [t1.id, t2.id];

      const events = engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId,
        slotLevel: spell.level,
        targetIds,
      }).events as ReadonlyArray<Event>;
      const types = events.map((e) => e.type);

      // Always: SpellCastDeclared.
      expect(types).toContain('SpellCastDeclared');
      // Leveled spells consume a slot.
      if (spell.level > 0) expect(types).toContain('SpellSlotConsumed');

      switch (expectation.kind) {
        case 'attack':
          expect(types, 'expected at least one AttackRolled').toContain('AttackRolled');
          break;
        case 'save':
          expect(types, 'expected at least one SaveRolled').toContain('SaveRolled');
          break;
        case 'heal':
          expect(types, 'expected at least one Healed').toContain('Healed');
          break;
        case 'auto-hit': {
          const damageEvents = events.filter((e): e is Extract<Event, { type: 'DamageApplied' }> => e.type === 'DamageApplied');
          expect(damageEvents.length, 'expected one DamageApplied per dart').toBeGreaterThanOrEqual(expectation.minDarts);
          break;
        }
        case 'buff': {
          const conditions = events.filter((e): e is Extract<Event, { type: 'ConditionApplied' }> => e.type === 'ConditionApplied');
          expect(conditions.length, 'expected at least one ConditionApplied').toBeGreaterThanOrEqual(1);
          expect(conditions.some((e) => e.conditionId === expectation.conditionId)).toBe(true);
          break;
        }
        case 'remove-condition': {
          const removals = events.filter((e): e is Extract<Event, { type: 'ConditionRemoved' }> => e.type === 'ConditionRemoved');
          expect(removals.length, 'expected at least one ConditionRemoved').toBeGreaterThanOrEqual(1);
          expect(removals.some((e) => e.conditionId === expectation.seedConditionId)).toBe(true);
          break;
        }
        case 'hp-pool-knockout': {
          // Sleep needs low-HP targets to knock out — Dummy's 50 HP exceeds
          // the typical 5d8 pool average. The smoke test asserts that at
          // least one creature in range gets the configured condition for
          // a pool that *does* cover one of them (so we use a targeted
          // wounded subject seeded directly).
          // Targets in this test default to 50 HP, which 5d8 (avg 22.5)
          // can't knock out. We re-cast against a target with 4 HP to
          // confirm the planner emits ConditionApplied when the pool fits.
          const lowTarget = CharacterSchema.parse({
            id: newCharacterId(),
            name: 'Sleepy',
            speciesId: 'human',
            backgroundId: 'soldier',
            classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
            abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
            hp: { current: 4, max: 4, temp: 0 },
            featsTaken: ['savage-attacker'],
          });
          let c2 = engine.createCampaign({ name: `spell-${spellId}-low` });
          c2 = commit(c2, [
            { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
            { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: lowTarget } satisfies CharacterCreatedEvent,
          ]);
          const lowEvents = engine.plan.castSpell(c2.state, {
            characterId: caster.id,
            spellId,
            slotLevel: spell.level,
            targetIds: [lowTarget.id],
          }).events;
          const applied = lowEvents.filter(
            (e): e is Extract<Event, { type: 'ConditionApplied' }> => e.type === 'ConditionApplied',
          );
          expect(applied.length, 'expected the low-HP target to be knocked out').toBeGreaterThanOrEqual(1);
          break;
        }
      }
    });
  }
});
