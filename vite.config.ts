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
      // Multi-entry: the main barrel + a dedicated `starter-pack`
      // entry. The latter lets browser consumers (the web demo, an
      // app dev server) code-split the SRD-shaped starter pack JSON
      // off the main bundle via `import('ttrpg-engine-dnd/starter-pack')`.
      entry: {
        'index': resolve(__dirname, 'src/index.ts'),
        'starter-pack': resolve(__dirname, 'src/starter-pack.ts'),
      },
      name: 'TtrpgEngineDnd',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'js' : 'cjs';
        return entryName === 'index'
          ? `ttrpg-engine-dnd.${ext}`
          : `${entryName}.${ext}`;
      },
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
