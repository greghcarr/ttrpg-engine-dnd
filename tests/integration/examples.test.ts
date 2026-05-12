import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const runExample = (relPath: string): string => {
  const out = execSync(`npx tsx ${relPath}`, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out;
};

describe('examples', () => {
  it('01-character-sheet prints a Fighter sheet', () => {
    const out = runExample('examples/01-character-sheet/index.ts');
    expect(out).toContain('Alyx, Fighter 3');
    expect(out).toContain('HP 26/26');
  });

  it('02-combat-encounter runs an attack and proves replay equivalence', () => {
    const out = runExample('examples/02-combat-encounter/index.ts');
    expect(out).toContain('Replay equivalent: true');
    expect(out).toContain('apply() is RNG-free: OK');
  });

  it('03-save-and-load round-trips a campaign via JSON', () => {
    const out = runExample('examples/03-save-and-load/index.ts');
    expect(out).toContain('Round-trip state equal: true');
  });
});
