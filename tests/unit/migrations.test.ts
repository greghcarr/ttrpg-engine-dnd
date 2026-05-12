import { describe, expect, it } from 'vitest';
import { migrate, SCHEMA_VERSION } from '../../src/migrations/index.js';

describe('migrate', () => {
  it('returns input unchanged when from === to', () => {
    const doc = { x: 1 };
    expect(migrate(doc, SCHEMA_VERSION)).toEqual(doc);
  });

  it('runs v0 → v1 noop', () => {
    const doc = { x: 2 };
    const out = migrate(doc, 0, 1);
    expect(out).toEqual(doc);
  });

  it('rejects downgrade', () => {
    expect(() => migrate({}, SCHEMA_VERSION + 1, SCHEMA_VERSION)).toThrow(/Cannot downgrade/);
  });

  it('rejects missing migration', () => {
    expect(() => migrate({}, 999, 1000 as typeof SCHEMA_VERSION)).toThrow(/No migration/);
  });
});
