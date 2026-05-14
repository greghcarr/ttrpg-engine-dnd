import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      // Web demo scenarios import via the package name. Alias them
      // back to local source so the CI replay test (and any future
      // web-scenario tests) can run without a `dist/` build first.
      { find: /^ttrpg-engine-dnd\/starter-pack$/, replacement: resolve(__dirname, 'src/starter-pack.ts') },
      { find: /^ttrpg-engine-dnd$/, replacement: resolve(__dirname, 'src/index.ts') },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/types/**',
        'src/handlers/**',
        'src/internal/**',
        'src/**/*.d.ts',
        'src/engine/ids-utils.ts',
      ],
      thresholds: {
        'src/engine/**': { lines: 80, statements: 80 },
        'src/derive/**': { lines: 80, statements: 80 },
        'src/effects/**': { lines: 80, statements: 80 },
      },
    },
  },
});
