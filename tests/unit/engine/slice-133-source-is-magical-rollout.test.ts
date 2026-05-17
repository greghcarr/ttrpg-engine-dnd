// Slice 133: sourceIsMagical wiring follow-through for the magical-
// save planners that slice 131 didn't touch. Validates that:
//   - trap.ts (spell-armed traps): triggering Imp rolls 2d20 take-max
//   - recurring-save.ts (spell-applied conditions): Imp saving against
//     Hold Person rolls 2d20 take-max
//   - reactive-spells.ts (Sanctuary's ward-bypass save): Imp attacker
//     against a Sanctuary-warded target rolls 2d20 take-max
//
// In every case the previously-rolled save path either ignored the
// hasAdvantage flag entirely (trap, recurring-save) or honored it but
// didn't pass sourceIsMagical, so Magic Resistance had no effect.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId, newAppliedConditionId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';
import type {
  ConditionAppliedEvent,
} from '../../../src/schemas/events/combat.js';
import type { TrapArmedEvent } from '../../../src/schemas/events/traps.js';

const PACK = loadStarterPack();

const buildImp = (name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name,
    statblockId: 'imp',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const buildCleric = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Caster',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 38, max: 38, temp: 0 },
    featsTaken: [],
    preparedSpells: ['hold-person', 'sanctuary'],
  });

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Trapper',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 9, hitDiceRemaining: 9 }],
    abilityScores: { STR: 10, DEX: 12, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    preparedSpells: ['glyph-of-warding'],
  });

const findEvent = <T extends { type: string }>(
  events: ReadonlyArray<unknown>,
  type: T['type'],
): T | undefined =>
  events.find(
    (e): e is T => typeof e === 'object' && e !== null && (e as { type?: string }).type === type,
  ) as T | undefined;

describe('slice 133: sourceIsMagical rollout to non-cast-spell magical save planners', () => {
  it('trap.triggerTrap: Imp triggering an Explosive Runes glyph rolls 2d20 take-max (Magic Resistance honored)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const wizard = buildWizard();
    const imp = buildImp('Trespasser');
    let campaign: Campaign = engine.createCampaign({ name: 'glyph-vs-imp' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: imp } satisfies CharacterCreatedEvent,
    ]);
    const castEvents = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'glyph-of-warding',
      slotLevel: 3,
      targetIds: [],
      casterChoice: { kind: 'damageType', value: 'fire' },
    }).events;
    campaign = commit(campaign, castEvents);
    const armed = findEvent<TrapArmedEvent>(castEvents, 'TrapArmed')!;
    const triggerEvents = engine.plan.triggerTrap(campaign.state, {
      trapId: armed.trapId,
      triggeringCharacterId: imp.id,
    }).events;
    const save = findEvent<SaveRolledEvent>(triggerEvents, 'SaveRolled');
    expect(save).toBeDefined();
    expect(save!.used).toBe('advantage');
    expect(save!.d20).toHaveLength(2);
  });

  it('recurring-save.tickRecurringSave: Imp saving against Hold Person rolls 2d20 take-max', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric();
    const imp = buildImp('Held');
    let campaign: Campaign = engine.createCampaign({ name: 'hold-vs-imp' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: imp } satisfies CharacterCreatedEvent,
    ]);
    // Seed the held-paralyzed-active condition directly with cleric as the
    // source. That's the spell-applied condition Hold Person installs;
    // it carries `recurringSave: { ability: 'WIS', trigger: 'turnEnd',
    // onSuccess: 'removeCondition' }` (slice 93).
    const heldApplied: ConditionAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: imp.id,
      conditionId: 'held-paralyzed-active',
      appliedConditionId: newAppliedConditionId(),
      sourceCharacterId: cleric.id,
    };
    campaign = commit(campaign, [heldApplied]);
    const tickEvents = engine.plan.tickRecurringSave(campaign.state, {
      targetId: imp.id,
      conditionId: 'held-paralyzed-active',
      casterId: cleric.id,
    }).events;
    const save = findEvent<SaveRolledEvent>(tickEvents, 'SaveRolled');
    expect(save).toBeDefined();
    expect(save!.used).toBe('advantage');
    expect(save!.d20).toHaveLength(2);
  });

  it('reactive-spells.sanctuaryWardSave: Imp attacking through Sanctuary rolls 2d20 take-max', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
    const cleric = buildCleric();
    const imp = buildImp('Attacker');
    let campaign: Campaign = engine.createCampaign({ name: 'sanctuary-vs-imp' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: imp } satisfies CharacterCreatedEvent,
    ]);
    // Apply sanctuary-active on the cleric (the warded target). The
    // attacker (imp) makes the WIS save when trying to attack the
    // bearer. We can seed the condition directly to avoid the cast
    // path's coupling.
    const sanctuaryApplied: ConditionAppliedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ConditionApplied',
      targetId: cleric.id,
      conditionId: 'sanctuary-active',
      appliedConditionId: newAppliedConditionId(),
      sourceCharacterId: cleric.id,
    };
    campaign = commit(campaign, [sanctuaryApplied]);
    const events = engine.plan.sanctuaryWardSave(campaign.state, {
      attackerId: imp.id,
      wardedCharacterId: cleric.id,
    }).events;
    const save = findEvent<SaveRolledEvent>(events, 'SaveRolled');
    expect(save).toBeDefined();
    expect(save!.used).toBe('advantage');
    expect(save!.d20).toHaveLength(2);
  });
});
