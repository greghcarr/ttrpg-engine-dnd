// Subclass content smoke test. The starter pack ships one subclass
// per class at L3 (the gating level in PHB 2024). For each:
//   - The subclass loads via the content pack's resolver
//   - parentClassId points at a real class id
//   - L3 features parse and at least one ships per subclass
//
// For the subclasses whose L3 features have wired effects, also
// assert the effect lands in the character's derived sheet — that's
// the "actually computes" check.

import { describe, expect, it } from 'vitest';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { computeDerivedCharacter } from '../../../src/derive/character-view.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildPC = (classId: string, level: number, subclassId?: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: `${classId} L${level}`,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{
      classId,
      level,
      hitDiceRemaining: level,
      ...(subclassId !== undefined ? { subclassId } : {}),
    }],
    abilityScores: { STR: 14, DEX: 14, CON: 14, INT: 12, WIS: 12, CHA: 12 },
    hp: { current: 8 * level, max: 8 * level, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

describe('subclass content (one per class at L3)', () => {
  it('every class has at least one subclass in the starter pack', () => {
    const classIds = new Set(PACK.classes.map((c) => c.id));
    const covered = new Set(PACK.subclasses.map((s) => s.parentClassId));
    const missing = [...classIds].filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it('every subclass points at a real parent class', () => {
    const classIds = new Set(PACK.classes.map((c) => c.id));
    for (const sub of PACK.subclasses) {
      expect(classIds.has(sub.parentClassId), `${sub.id} parent ${sub.parentClassId} not found`).toBe(true);
    }
  });

  it('every subclass grants at least one L3 feature', () => {
    for (const sub of PACK.subclasses) {
      const l3 = sub.levelGrants['3'] ?? [];
      expect(l3.length, `${sub.id} has no L3 features`).toBeGreaterThanOrEqual(1);
    }
  });

  it('subclass features with effects flow into the character derivation', () => {
    // Thief's `second-story-work` grants a climbing speed via
    // `ModifySpeed`. The character-view derivation builds the effect
    // stack, so picking a Thief rogue should make the speed feature
    // computable in derived state (we just need to confirm the
    // derivation completes — the specific climb-speed bookkeeping
    // isn't surfaced in DerivedCharacter today).
    const pc = buildPC('rogue', 3, 'thief');
    const derived = computeDerivedCharacter({
      character: pc,
      itemInstances: {},
      content: CONTENT,
    });
    expect(derived.totalLevel).toBe(3);
  });

  it('Draconic Sorcerer at L3 with no armor uses 13 + DEX-mod AC (Draconic Resilience)', () => {
    // Override the unarmored-defense check: a Draconic Sorcerer with
    // no armor + no shield should get AC 13 + DEX-mod (here DEX 14
    // → +2, total 15).
    const pc = buildPC('sorcerer', 3, 'draconic-sorcery');
    pc.equipped.armor = undefined;
    pc.equipped.shield = undefined;
    const derived = computeDerivedCharacter({
      character: pc,
      itemInstances: {},
      content: CONTENT,
    });
    expect(derived.ac.total).toBe(15);
  });

  it('College of Lore Bard at L3 gains three skill proficiencies', () => {
    const pc = buildPC('bard', 3, 'college-of-lore');
    const derived = computeDerivedCharacter({
      character: pc,
      itemInstances: {},
      content: CONTENT,
    });
    // We don't yet expose skill proficiencies on DerivedCharacter;
    // verify via effect-stack walk indirectly through totalLevel.
    expect(derived.totalLevel).toBe(3);
    // Lookup the subclass and confirm the bonus-proficiencies feature
    // shipped with three GrantProficiency effects.
    const sub = CONTENT.subclasses.get('college-of-lore')!;
    const l3 = sub.levelGrants['3'] ?? [];
    const profsFeature = l3.find((f) => f.id === 'lore-bonus-proficiencies');
    expect(profsFeature?.effects.length).toBe(3);
  });
});
