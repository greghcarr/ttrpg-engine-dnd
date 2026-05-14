# dndbnb

A D&D Beyond-style character workbench, powered by [ttrpg-engine-dnd](https://www.npmjs.com/package/ttrpg-engine-dnd).

The source lives in this engine repo so engine changes are instantly reflected in dndbnb (no version-bump or publish cycle in between). The deploy workflow at [.github/workflows/deploy-dndbnb.yml](../.github/workflows/deploy-dndbnb.yml) pushes the built bundle to a sibling `greghcarr/dndbnb` repo's `gh-pages` branch, so the URL settles at https://greghcarr.github.io/dndbnb/.

## Running locally

```bash
npm install
npm run dev:dndbnb       # local dev server with engine source aliased (port 5174)
npm run build:dndbnb     # production bundle to dist-dndbnb/ (uses dist/, run `npm run build` first)
npm run preview:dndbnb   # serve the production bundle locally
```

The dev alias maps `ttrpg-engine-dnd` and `ttrpg-engine-dnd/starter-pack` to local `src/`, so engine edits hot-reload into dndbnb. Production bundles import from the built `dist/`, so the deployed site runs the same code an npm consumer would.

## One-time deploy setup

The deploy workflow needs three things in place before it can publish:

1. **Create the sibling repo.** An empty public repo `greghcarr/dndbnb` on GitHub. Nothing in it; the workflow populates the `gh-pages` branch.
2. **Generate a personal access token.** Fine-grained PAT scoped to `greghcarr/dndbnb` with **Contents: read + write** and **Pages: read + write**. Token UI: https://github.com/settings/personal-access-tokens/new.
3. **Add the token as a secret.** In this repo, Settings → Secrets and variables → Actions → New repository secret, name `DNDBNB_DEPLOY_TOKEN`, paste the token.
4. **Configure Pages on the sibling repo.** In `greghcarr/dndbnb`, Settings → Pages → Source = "Deploy from a branch", Branch = `gh-pages` / `/ (root)`.

After that, any push to `main` that touches `src/`, `dndbnb/`, `vite.dndbnb.config.ts`, or the workflow itself triggers a redeploy. Manual redeploy: Actions → "Deploy dndbnb" → Run workflow.

## Engine import boundary

dndbnb imports the engine as a package, not via relative paths:

```ts
import { computeDerivedCharacter } from 'ttrpg-engine-dnd';
import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack';
```

Vite's resolve.alias (see [vite.dndbnb.config.ts](../vite.dndbnb.config.ts)) rewrites these to local `src/` in dev and `dist/` in production. This keeps dndbnb honest about what's actually in the public API: if a function isn't exported from `src/index.ts`, dndbnb can't reach it.

## Day-1 scope

The current build is intentionally minimal: it loads the starter pack, builds a hard-coded L5 wizard, and renders the engine's `DerivedCharacter` view as a small definition list. That's enough to prove the import boundary + build pipeline + deploy target all work end-to-end. Real character-sheet UI (creator, level-up, spellbook, inventory, combat tracker) lands in subsequent passes.
