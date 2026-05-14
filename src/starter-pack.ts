// Subpath export: `import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack'`.
//
// Re-exports the starter-pack loader as its own entry so browser
// consumers (the web demo, app dev servers) can code-split the
// SRD-shaped starter content JSON off the main bundle. Importing
// from this path emits a separate chunk; importing from the main
// barrel pulls everything together.
export { loadStarterPack, STARTER_PACK_RAW } from './content/packs/starter.js';
export type { ContentPack } from './content/pack.js';
