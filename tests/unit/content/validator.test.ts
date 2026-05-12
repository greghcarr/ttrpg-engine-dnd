import { describe, expect, it } from 'vitest';
import { loadContentPack, ContentPackLoadError, resolveContent } from '../../../src/content/pack.js';
import { validateCrossReferences } from '../../../src/content/validate.js';

const MINIMAL: unknown = {
  id: 'test',
  name: 'Test',
  version: '0.0.1',
  species: [],
  backgrounds: [],
  classes: [],
  subclasses: [],
  feats: [],
  spells: [],
  items: [],
  monsters: [],
  conditions: [],
};

describe('loadContentPack diagnostics', () => {
  it('reports path-pointed issues on a malformed pack', () => {
    try {
      loadContentPack({
        id: 'test',
        name: 'Test',
        version: '0.0.1',
        classes: [{ id: 'fighter' }],
      });
      expect.fail('loadContentPack should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ContentPackLoadError);
      const e = err as ContentPackLoadError;
      expect(e.issues.length).toBeGreaterThan(0);
      expect(e.message).toContain('classes.0');
    }
  });

  it('accepts a well-formed minimal pack', () => {
    const pack = loadContentPack(MINIMAL);
    expect(pack.id).toBe('test');
  });
});

describe('validateCrossReferences with suggestions', () => {
  it('suggests a near-miss feat ID when an origin feat is missing', () => {
    const pack = loadContentPack({
      ...(MINIMAL as object),
      feats: [
        { id: 'savage-attacker', name: 'Savage Attacker', category: 'origin', repeatable: false, prerequisites: [], effects: [] },
      ],
      backgrounds: [
        {
          id: 'soldier',
          name: 'Soldier',
          abilityScoreIncreases: { options: ['STR', 'DEX'], pattern: '+2/+1' },
          skillProficiencies: [],
          toolProficiencies: [],
          languages: [],
          originFeatId: 'savage-attackr', // typo
          traits: [],
        },
      ],
    });
    const resolved = resolveContent([pack]);
    const issues = validateCrossReferences(resolved);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('backgrounds.soldier.originFeatId');
    expect(issues[0]?.suggestion).toContain('savage-attacker');
  });

  it('reports a parent-class mismatch with no suggestion when nothing is close', () => {
    const pack = loadContentPack({
      ...(MINIMAL as object),
      classes: [
        {
          id: 'fighter',
          name: 'Fighter',
          hitDie: 10,
          primaryAbility: ['STR'],
          savingThrowProficiencies: ['STR', 'CON'],
          armorProficiencies: [],
          weaponProficiencies: [],
          toolProficiencies: [],
          levelTable: { 1: { proficiencyBonus: 2, features: [], columns: {} } },
        },
      ],
      subclasses: [
        {
          id: 'mystic',
          name: 'Mystic',
          parentClassId: 'mage-the-monk-paladin',
          levelTable: { 3: { features: [], columns: {} } },
        },
      ],
    });
    const resolved = resolveContent([pack]);
    const issues = validateCrossReferences(resolved);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('subclasses.mystic.parentClassId');
    expect(issues[0]?.suggestion).toBeUndefined();
  });
});
