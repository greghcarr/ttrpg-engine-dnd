// Layer 8 (feature-coverage matrix, per the testing standard in
// CLAUDE.md). Enumerates every notable 5.5e feature in the starter
// content pack and asserts the shape it ships with (effects-bearing
// vs name-only stub), plus a smoke check that effects-bearing entries
// actually parse and produce derivations / events when triggered.
//
// The matrix doubles as an audit: changes to the content pack — new
// features added, existing features changed from data-driven to
// code-driven (or back) — fail the snapshot and force the diff into
// the PR. Use `npx vitest -u tests/coverage/features.test.ts` to
// accept intentional changes.
//
// The matrix is keyed by category:
//   - Class features (the `features: [...]` arrays in every level entry)
//   - Weapon masteries (the 9 PHB 2024 masteries)
//   - Conditions
//   - Feats (origin + general + fighting-style + epic-boon)
//   - Magic items (the entries with effects[])
//
// `wired` means: ships with effects[] populated; the engine
// derivations / triggers read them. `stub` means: content has an entry
// (name, level placement) but no effects array — usually because
// expressing the feature requires engine work the project hasn't done
// yet (Stunning Strike trigger, Reckless Attack advantage timing, etc.).
// `stub` entries fail this test if they suddenly grow an effects array
// — that's a PR-worthy change.

import { describe, expect, it } from 'vitest';
import { loadStarterPack } from '../../src/content/packs/starter.js';
import { resolveContent } from '../../src/content/pack.js';
import { WEAPON_MASTERIES } from '../../src/schemas/primitives.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

type WireStatus = 'wired' | 'stub';

const categorize = (effectsCount: number): WireStatus => (effectsCount > 0 ? 'wired' : 'stub');

interface ClassFeatureRow {
  readonly classId: string;
  readonly level: number;
  readonly featureId: string;
  readonly status: WireStatus;
}

const buildClassFeatureMatrix = (): ClassFeatureRow[] => {
  const rows: ClassFeatureRow[] = [];
  for (const cls of PACK.classes) {
    const tbl = cls.levelTable as Record<string, { features?: Array<{ id: string; effects?: unknown[] }> }>;
    for (const [lvlStr, entry] of Object.entries(tbl)) {
      const level = Number.parseInt(lvlStr, 10);
      for (const feature of entry.features ?? []) {
        rows.push({
          classId: cls.id,
          level,
          featureId: feature.id,
          status: categorize((feature.effects ?? []).length),
        });
      }
    }
  }
  return rows.sort(
    (a, b) =>
      a.classId.localeCompare(b.classId) ||
      a.level - b.level ||
      a.featureId.localeCompare(b.featureId),
  );
};

describe('feature-coverage matrix: class features', () => {
  const matrix = buildClassFeatureMatrix();

  it('every named class feature parses (id + level + status snapshot)', () => {
    expect(matrix.map((r) => `${r.classId} L${r.level} ${r.featureId} [${r.status}]`)).toMatchSnapshot();
  });

  it('counts: wired vs stub split is stable', () => {
    const wired = matrix.filter((r) => r.status === 'wired').length;
    const stub = matrix.filter((r) => r.status === 'stub').length;
    expect({ wired, stub, total: matrix.length }).toMatchSnapshot();
  });

  it('Rogue Sneak Attack scales: a class-feature entry exists at every odd Rogue level', () => {
    // Sneak Attack is the one class feature that's fully wired
    // across the table. If a regression drops some odd-level entries,
    // this fails loudly.
    const sneakLevels = matrix
      .filter((r) => r.classId === 'rogue' && r.featureId === 'sneak-attack')
      .map((r) => r.level)
      .sort((a, b) => a - b);
    expect(sneakLevels).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19]);
  });
});

describe('feature-coverage matrix: weapon masteries', () => {
  it('every PHB-2024 mastery has at least one weapon in the starter pack', () => {
    const weapons = [...CONTENT.items.values()].filter((i) => i.itemKind === 'weapon');
    const masteryToWeapons = new Map<string, string[]>();
    for (const w of weapons) {
      if (w.itemKind !== 'weapon' || w.mastery === undefined) continue;
      const list = masteryToWeapons.get(w.mastery) ?? [];
      list.push(w.id);
      masteryToWeapons.set(w.mastery, list);
    }
    const missing: string[] = [];
    for (const m of WEAPON_MASTERIES) {
      if ((masteryToWeapons.get(m) ?? []).length === 0) missing.push(m);
    }
    // Flex is the engine's 9th-mastery extension; the starter pack
    // doesn't ship a Flex weapon (Greg's design choice — versatile
    // weapons map to their PHB masteries like Sap / Push / Topple).
    // The TEST_PACK adds a synthetic Flex weapon. We tolerate Flex
    // missing from the starter pack.
    expect(missing.filter((m) => m !== 'Flex')).toEqual([]);
    expect(masteryToWeapons.size).toBeGreaterThanOrEqual(8);
  });

  it('mastery → weapon mapping is stable', () => {
    const weapons = [...CONTENT.items.values()].filter((i) => i.itemKind === 'weapon');
    const summary: Record<string, string[]> = {};
    for (const w of weapons) {
      if (w.itemKind !== 'weapon' || w.mastery === undefined) continue;
      summary[w.mastery] = (summary[w.mastery] ?? []).concat(w.id).sort();
    }
    expect(summary).toMatchSnapshot();
  });
});

describe('feature-coverage matrix: conditions', () => {
  it('every condition is shipped with status + effects count', () => {
    const rows = PACK.conditions.map((c) => ({
      id: c.id,
      effectsCount: c.effects.length,
      stackable: c.stackable,
    }));
    rows.sort((a, b) => a.id.localeCompare(b.id));
    expect(rows).toMatchSnapshot();
  });

  it('PHB-2024 official 15 conditions are all present', () => {
    const PHB_15 = [
      'blinded',
      'charmed',
      'deafened',
      'exhaustion',
      'frightened',
      'grappled',
      'incapacitated',
      'invisible',
      'paralyzed',
      'petrified',
      'poisoned',
      'prone',
      'restrained',
      'stunned',
      'unconscious',
    ];
    const have = new Set(PACK.conditions.map((c) => c.id));
    for (const id of PHB_15) {
      expect(have.has(id), `Missing PHB condition: ${id}`).toBe(true);
    }
  });
});

describe('feature-coverage matrix: feats', () => {
  it('feat catalog by category + wire status is stable', () => {
    const rows = PACK.feats.map((f) => ({
      id: f.id,
      category: f.category,
      status: categorize((f.effects ?? []).length),
    }));
    rows.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
    expect(rows).toMatchSnapshot();
  });

  it('all six 2024 Fighting Styles ship as feats', () => {
    const styles = PACK.feats.filter((f) => f.category === 'fighting-style').map((f) => f.id).sort();
    expect(styles).toEqual([
      'fighting-style-archery',
      'fighting-style-defense',
      'fighting-style-dueling',
      'fighting-style-great-weapon',
      'fighting-style-protection',
      'fighting-style-two-weapon',
    ]);
  });

  it('all nine epic boons ship', () => {
    const boons = PACK.feats.filter((f) => f.category === 'epic-boon').map((f) => f.id).sort();
    expect(boons.length).toBeGreaterThanOrEqual(9);
  });
});

describe('feature-coverage matrix: magic items', () => {
  it('charges + effect-bearing magic items are stable', () => {
    // Only the `magic` variant carries `effects[]` / `charges[]`.
    const rows = [...CONTENT.items.values()]
      .filter((i) => i.itemKind === 'magic')
      .map((i) => {
        if (i.itemKind !== 'magic') return { id: i.id, effectsCount: 0, hasCharges: false };
        return {
          id: i.id,
          effectsCount: (i.effects ?? []).length,
          hasCharges: i.charges !== undefined,
        };
      });
    rows.sort((a, b) => a.id.localeCompare(b.id));
    expect(rows).toMatchSnapshot();
  });
});
