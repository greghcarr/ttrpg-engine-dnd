import { describe, expect, it } from 'vitest';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { computeAC } from '../../../src/derive/ac.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { makeItemInstance } from '../../fixtures/index.js';

// Slice 230: `bearer.wieldingShield` predicate fact (mirror of
// `bearer.wearingArmor` from slice 116). Canonical user: Bracers of
// Defense, which gives +2 AC only when the wearer has no armor and no
// shield.

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildMonk = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Monk',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'monk', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 16, CON: 14, INT: 10, WIS: 16, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
  });

describe('Bracers of Defense + bearer.wieldingShield fact (slice 230)', () => {
  it('an unarmored, no-shield monk wearing Bracers of Defense gets +2 AC', () => {
    const bracers = makeItemInstance('bracers-of-defense');
    const monk = buildMonk();
    const equipped: Character = {
      ...monk,
      equipped: { ...monk.equipped, attuned: [bracers.id] },
    };
    const itemInstances = { [bracers.id]: bracers };
    const ac = computeAC({ character: equipped, itemInstances, content: CONTENT });
    const bracersBonus = ac.breakdown.find(
      (e) => e.source === 'modifier' || e.source.startsWith('item:'),
    );
    // Expect the +2 to show up somewhere in the breakdown. Use total
    // comparison to avoid coupling to exact breakdown labels.
    const baseline = computeAC({ character: monk, itemInstances: {}, content: CONTENT });
    expect(ac.total).toBe(baseline.total + 2);
  });

  it('a shield-wielding monk wearing Bracers of Defense gets NO bonus (RAW gate)', () => {
    const bracers = makeItemInstance('bracers-of-defense');
    const shield = makeItemInstance('shield');
    const monk = buildMonk();
    const equipped: Character = {
      ...monk,
      equipped: { ...monk.equipped, shield: shield.id, attuned: [bracers.id] },
    };
    const itemInstances = { [bracers.id]: bracers, [shield.id]: shield };
    const ac = computeAC({ character: equipped, itemInstances, content: CONTENT });
    const baseline = computeAC({
      character: { ...monk, equipped: { ...monk.equipped, shield: shield.id } },
      itemInstances: { [shield.id]: shield },
      content: CONTENT,
    });
    // Same total whether or not the bracers are attuned, because the
    // shield clause gates them out.
    expect(ac.total).toBe(baseline.total);
  });

  it('an armored fighter wearing Bracers of Defense gets NO bonus (RAW gate)', () => {
    const bracers = makeItemInstance('bracers-of-defense');
    const armor = makeItemInstance('chain-mail');
    const fighter = CharacterSchema.parse({
      id: newCharacterId(),
      name: 'Fighter',
      speciesId: 'human',
      backgroundId: 'soldier',
      classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
      abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
      hp: { current: 40, max: 40, temp: 0 },
      featsTaken: [],
      equipped: { armor: armor.id, attuned: [bracers.id] },
    });
    const itemInstances = { [bracers.id]: bracers, [armor.id]: armor };
    const ac = computeAC({ character: fighter, itemInstances, content: CONTENT });
    const baseline = computeAC({
      character: { ...fighter, equipped: { armor: armor.id, attuned: [] } },
      itemInstances: { [armor.id]: armor },
      content: CONTENT,
    });
    expect(ac.total).toBe(baseline.total);
  });
});
