// Slice 131: end-to-end test that casting a save-targeting spell
// (Fireball) at a creature with Magic Resistance produces a
// SaveRolled event marked with `used: 'advantage'` and two d20s,
// per RAW. Validates the full pipeline: planAttack → save mechanic
// → computeSavingThrow consults effect-stack hasMagicResistance →
// cast-spell rolls 2d20 take max.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { SaveRolledEvent } from '../../../src/schemas/events/checks.js';

const PACK = loadStarterPack();

const buildWizard = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Caster',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['fireball'],
  });

const buildImp = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Imp',
    statblockId: 'imp',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const buildFighter = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Plain Fighter',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 12, max: 12, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('cast-spell honors Magic Resistance via the slice-131 sourceIsMagical path', () => {
  it('Fireball at an Imp emits SaveRolled with used="advantage" and two d20s', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(7) });
    const wizard = buildWizard();
    const imp = buildImp();
    let campaign = engine.createCampaign({ name: 'fireball-vs-imp' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: imp } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: [imp.id],
    });
    const save = events.find((e): e is SaveRolledEvent => e.type === 'SaveRolled');
    expect(save).toBeDefined();
    expect(save!.targetId).toBe(imp.id);
    expect(save!.used).toBe('advantage');
    expect(save!.d20).toHaveLength(2);
  });

  it('Fireball at a fighter (no Magic Resistance) keeps used="none" and a single d20', () => {
    // Same caster, same seed: the only difference is the target. The
    // fighter has no Magic Resistance, so the save flow stays on its
    // pre-slice-131 single-d20 path.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(7) });
    const wizard = buildWizard();
    const fighter = buildFighter();
    let campaign = engine.createCampaign({ name: 'fireball-vs-fighter' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: [fighter.id],
    });
    const save = events.find((e): e is SaveRolledEvent => e.type === 'SaveRolled');
    expect(save).toBeDefined();
    expect(save!.used).toBe('none');
    expect(save!.d20).toHaveLength(1);
  });

  it('Fireball at an Imp + a fighter together: per-target advantage resolution (Imp gets two d20, fighter gets one)', () => {
    // The save mechanic's per-target loop is supposed to independently
    // consult each target's effect stack. Validates that mixing
    // Magic-Resistant and non-Magic-Resistant targets produces correct
    // per-target SaveRolled shapes in one Fireball cast.
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(11) });
    const wizard = buildWizard();
    const imp = buildImp();
    const fighter = buildFighter();
    let campaign = engine.createCampaign({ name: 'fireball-mixed' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: imp } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
    ]);
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: wizard.id,
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: [imp.id, fighter.id],
    });
    const saves = events.filter((e): e is SaveRolledEvent => e.type === 'SaveRolled');
    expect(saves).toHaveLength(2);
    const impSave = saves.find((s) => s.targetId === imp.id);
    const fighterSave = saves.find((s) => s.targetId === fighter.id);
    expect(impSave!.used).toBe('advantage');
    expect(impSave!.d20).toHaveLength(2);
    expect(fighterSave!.used).toBe('none');
    expect(fighterSave!.d20).toHaveLength(1);
  });
});
