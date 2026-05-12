import { describe, expect, it } from 'vitest';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { validateCrossReferences } from '../../../src/content/validate.js';

describe('starter content pack', () => {
  it('loads, resolves, and passes cross-reference validation', () => {
    const pack = loadStarterPack();
    expect(pack.id).toBe('starter-pack');
    const resolved = resolveContent([pack]);
    const issues = validateCrossReferences(resolved);
    expect(issues).toEqual([]);
  });

  it('ships a Fighter, a Wizard, and basic adventuring gear', () => {
    const pack = loadStarterPack();
    const resolved = resolveContent([pack]);
    expect(resolved.classes.get('fighter')).toBeDefined();
    expect(resolved.classes.get('wizard')).toBeDefined();
    expect(resolved.items.get('longsword')).toBeDefined();
    expect(resolved.conditions.get('prone')).toBeDefined();
  });

  it('ships all four Phase E group-1 classes (Barbarian, Bard, Cleric, Druid)', () => {
    const pack = loadStarterPack();
    const resolved = resolveContent([pack]);
    for (const id of ['barbarian', 'bard', 'cleric', 'druid']) {
      const cls = resolved.classes.get(id);
      expect(cls, `class ${id} missing`).toBeDefined();
      expect(cls?.levelTable['1']?.proficiencyBonus).toBe(2);
      expect(cls?.levelTable['20']?.proficiencyBonus).toBe(6);
    }
    expect(resolved.classes.get('bard')?.spellcasting?.type).toBe('full');
    expect(resolved.classes.get('cleric')?.spellcasting?.type).toBe('full');
    expect(resolved.classes.get('druid')?.spellcasting?.type).toBe('full');
  });

  it('ships all four group-2 classes (Fighter, Monk, Paladin, Ranger)', () => {
    const pack = loadStarterPack();
    const resolved = resolveContent([pack]);
    for (const id of ['fighter', 'monk', 'paladin', 'ranger']) {
      expect(resolved.classes.get(id), `class ${id} missing`).toBeDefined();
    }
    expect(resolved.classes.get('paladin')?.spellcasting?.type).toBe('half');
    expect(resolved.classes.get('ranger')?.spellcasting?.type).toBe('half');
  });

  it('ships all four group-3 classes (Rogue, Sorcerer, Warlock, Wizard)', () => {
    const pack = loadStarterPack();
    const resolved = resolveContent([pack]);
    for (const id of ['rogue', 'sorcerer', 'warlock', 'wizard']) {
      expect(resolved.classes.get(id), `class ${id} missing`).toBeDefined();
    }
    expect(resolved.classes.get('sorcerer')?.spellcasting?.type).toBe('full');
    expect(resolved.classes.get('warlock')?.spellcasting?.type).toBe('pact');
    expect(resolved.classes.get('wizard')?.spellcasting?.type).toBe('full');
  });

  it('starter pack covers all 12 PHB classes', () => {
    const pack = loadStarterPack();
    const resolved = resolveContent([pack]);
    const expected = [
      'barbarian', 'bard', 'cleric', 'druid',
      'fighter', 'monk', 'paladin', 'ranger',
      'rogue', 'sorcerer', 'warlock', 'wizard',
    ];
    for (const id of expected) {
      expect(resolved.classes.get(id), `class ${id} missing`).toBeDefined();
    }
  });

  it('ships at least 25 spells across cantrip + leveled tiers', () => {
    const pack = loadStarterPack();
    const resolved = resolveContent([pack]);
    expect(resolved.spells.size).toBeGreaterThanOrEqual(25);
    expect(resolved.spells.get('eldritch-blast')).toBeDefined();
    expect(resolved.spells.get('healing-word')).toBeDefined();
    expect(resolved.spells.get('counterspell')).toBeDefined();
    expect(resolved.spells.get('identify')?.ritual).toBe(true);
  });

  it('ships diverse species, backgrounds, feats, and equipment', () => {
    const pack = loadStarterPack();
    const resolved = resolveContent([pack]);
    expect(resolved.species.size).toBeGreaterThanOrEqual(7);
    expect(resolved.backgrounds.size).toBeGreaterThanOrEqual(8);
    expect(resolved.feats.size).toBeGreaterThanOrEqual(15);
    expect(resolved.items.size).toBeGreaterThanOrEqual(25);
    expect(resolved.species.get('dwarf')).toBeDefined();
    expect(resolved.backgrounds.get('sage')?.originFeatId).toBe('magic-initiate-wizard');
    expect(resolved.feats.get('fighting-style-archery')?.category).toBe('fighting-style');
    expect(resolved.items.get('greatsword')?.itemKind).toBe('weapon');
    expect(resolved.items.get('thieves-tools')?.itemKind).toBe('tool');
    expect(resolved.items.get('torch')?.itemKind).toBe('gear');
  });
});
