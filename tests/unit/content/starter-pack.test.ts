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
});
