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
});
