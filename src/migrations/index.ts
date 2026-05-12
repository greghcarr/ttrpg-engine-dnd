import { SCHEMA_VERSION } from '../version.js';

export type MigrationFn = (doc: unknown) => unknown;

const MIGRATIONS: ReadonlyMap<number, MigrationFn> = new Map<number, MigrationFn>([
  [0, (doc) => doc],
]);

export const migrate = (doc: unknown, fromVersion: number, toVersion = SCHEMA_VERSION): unknown => {
  if (fromVersion === toVersion) return doc;
  if (fromVersion > toVersion) {
    throw new Error(`Cannot downgrade schema from ${fromVersion} to ${toVersion}`);
  }
  let current = doc;
  for (let v = fromVersion; v < toVersion; v++) {
    const fn = MIGRATIONS.get(v);
    if (!fn) {
      throw new Error(`No migration from version ${v}`);
    }
    current = fn(current);
  }
  return current;
};

export { SCHEMA_VERSION };
