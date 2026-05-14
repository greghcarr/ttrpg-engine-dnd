import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Vite config for the GitHub Pages demo (`web/`).
//
// Separate from the library config (`vite.config.ts`) so the demo can
// be a plain app build while the engine itself remains a library.
//
// Engine import boundary (per docs/web-demo-plan.md):
//   - In dev, `ttrpg-engine-dnd` resolves to local `src/` so engine
//     changes hot-reload into the demo.
//   - In production, the alias points at the built `dist/` so the
//     deployed demo runs the same bundle external consumers get.
//
// Build outDir defers to step 10 (CI deploy) — left at the Vite
// default `dist/` under `web/` for now. The deploy workflow is what
// finally chooses where GitHub Pages serves from.
export default defineConfig(({ mode }) => {
  const useSrc = mode !== 'production';
  const enginePath = useSrc
    ? resolve(__dirname, 'src/index.ts')
    : resolve(__dirname, 'dist/ttrpg-engine-dnd.js');
  const starterPath = useSrc
    ? resolve(__dirname, 'src/starter-pack.ts')
    : resolve(__dirname, 'dist/starter-pack.js');

  return {
    root: resolve(__dirname, 'web'),
    publicDir: false,
    base: process.env.NODE_ENV === 'production' ? '/ttrpg-engine-dnd/' : '/',
    resolve: {
      alias: [
        { find: /^ttrpg-engine-dnd\/starter-pack$/, replacement: starterPath },
        { find: /^ttrpg-engine-dnd$/, replacement: enginePath },
      ],
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      outDir: resolve(__dirname, 'dist-web'),
      emptyOutDir: true,
    },
  };
});
