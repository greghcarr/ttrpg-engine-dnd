import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
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
