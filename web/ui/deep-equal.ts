// Structural deep-equal that returns the first divergent path.
//
// Used by the Event Inspector's replay-verification button to surface
// *where* the replayed state diverged from the live state, not just
// that it did. Sentinel-based: a successful equality returns
// `undefined`; any mismatch returns a dotted path like
// `encounters.01KR.combatants[2].turnUsage.actionUsed`.

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const formatKey = (key: string | number): string =>
  typeof key === 'number' ? `[${key}]` : `.${key}`;

export interface DivergenceResult {
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

/**
 * Returns `undefined` if `a` and `b` are structurally equal, or a
 * `DivergenceResult` describing the first place they differ.
 *
 * Numeric NaN is treated as equal to NaN. Object keys are compared
 * unordered. Arrays are compared positionally. Unknown value kinds
 * (Map, Set, Date, RegExp) are compared by JSON.stringify fallback.
 */
export const firstDivergence = (
  a: unknown,
  b: unknown,
  path = '',
): DivergenceResult | undefined => {
  if (a === b) return undefined;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
    return undefined;
  }
  if (typeof a !== typeof b) {
    return { path: path || '<root>', expected: a, actual: b };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { path: `${path}.length`, expected: a.length, actual: b.length };
    }
    for (let i = 0; i < a.length; i++) {
      const sub = firstDivergence(a[i], b[i], `${path}${formatKey(i)}`);
      if (sub) return sub;
    }
    return undefined;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const sub = firstDivergence(a[k], b[k], `${path}${formatKey(k)}`);
      if (sub) return sub;
    }
    return undefined;
  }
  // Fallback for Date, Map, Set, etc.
  if (JSON.stringify(a) === JSON.stringify(b)) return undefined;
  return { path: path || '<root>', expected: a, actual: b };
};
