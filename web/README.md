# Web demo

GitHub Pages demo for `ttrpg-engine-dnd`. Plain TypeScript + Vite, no framework. Two modes: Combat Sandbox (left) and Event Inspector (right).

Plan and architecture decisions live in [docs/web-demo-plan.md](../docs/web-demo-plan.md). When something here disagrees with the plan, update the plan doc before changing course.

## Running

```bash
npm install
npm run dev:web      # local dev server with engine source aliased
npm run build:web    # production bundle to dist-web/ (uses dist/ — run `npm run build` first)
npm run preview:web  # serve the production bundle locally
```

The dev alias maps `ttrpg-engine-dnd` and `ttrpg-engine-dnd/starter-pack` to local `src/`, so engine edits hot-reload into the demo. Production bundles import from the built `dist/`, so the deployed demo runs the same code an npm consumer would.

## Deploying

Pushes to `main` trigger [.github/workflows/deploy-demo.yml](../.github/workflows/deploy-demo.yml), which builds `dist-web/` and uploads it as a GitHub Pages artifact. No build output is committed to the repo.

**One-time repo setup** (only needed once per fork): Settings → Pages → **Source = "GitHub Actions"**.

## URL hash

- `#seed=42` — seed for the engine's RNG. Default is `42`. Bug reports including a seed are reproducible byte-for-byte.

The Reset button rebuilds the engine + scenario from scratch with whatever seed is currently in the input. Editing the URL hash directly (back/forward, paste) also re-seeds.

## PendingChoice reachability in v1

The Pending Choice Resolver panel ([web/ui/pending-choice.ts](ui/pending-choice.ts)) is built generically — it handles every choice the engine emits via the uniform `PendingChoice = {prompt, options, oneOf, forCharacterId}` shape.

**In v1 it never appears.** The scenarios the demo ships (just `goblin-skirmish.ts` for now) use pre-built combatants and never trigger a `ChoiceRequired` event:

- `OfferChoice` effects mostly fire at level-up. Level-up isn't reachable from Combat Sandbox v1.
- `OfferChoice` effects also fire at character-creation feat/skill picks. The scenario uses hand-built `CharacterSchema.parse` calls that bake the picks in, bypassing `OfferChoice`.
- The v1 planner set (`attack`, `move`, `dash`, `dodge`, `disengage`, `endTurn`, `castSpell`) doesn't itself emit `ChoiceRequired`.

The resolver ships anyway so any future mode (Character Forge, Seeded Encounter with a wizard who has to pick a spell on the fly, level-up demos) gets a working UI for free. If you mount a new mode that triggers a choice and the resolver doesn't render the right widget for it, fix the resolver — don't write a per-mode resolver. The minute a third choice-type appears, that path becomes unmaintainable.

## Layout slots

- `#combat-sandbox-root` — left panel, rendered by [modes/combat-sandbox.ts](modes/combat-sandbox.ts)
- `#event-inspector-root` — right panel, rendered by [modes/event-inspector.ts](modes/event-inspector.ts)
- `#pending-choice-root` — full-width banner above the panels, only visible when there's an unresolved `PendingChoice`

## What's intentionally not here

- React/Preact/Lit. The event loop maps cleanly to "re-render everything from state after each commit"; framework reconciliation buys nothing.
- A router. State (seed, eventual mode) lives in the URL hash.
- Analytics or auth.
- Imported content beyond `loadStarterPack()`. The demo isn't a content authoring surface.
