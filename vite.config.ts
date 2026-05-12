import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TtrpgEngineDnd',
      formats: ['es', 'cjs'],
      fileName: (format) => `ttrpg-engine-dnd.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['zod', 'immer', 'ulid'],
      output: {
        globals: {
          zod: 'zod',
          immer: 'immer',
          ulid: 'ulid',
        },
      },
    },
    sourcemap: true,
    target: 'es2022',
  },
});
