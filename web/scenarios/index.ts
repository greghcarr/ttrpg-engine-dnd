// Scenario registry.
//
// Each entry: { name, build(opts?) -> GoblinSkirmish-shaped session }.
// The CI replay test ([tests/integration/web-scenarios.test.ts]) loops
// over this list, so adding a new scenario file means dropping it
// here and CI auto-covers it.

import { buildGoblinSkirmish, type GoblinSkirmish } from './goblin-skirmish.js';

export interface DemoScenario {
  readonly name: string;
  readonly build: (opts?: { seed?: number }) => GoblinSkirmish;
}

export const SCENARIOS: ReadonlyArray<DemoScenario> = [
  { name: 'goblin-skirmish', build: (opts) => buildGoblinSkirmish(loadStarter(), opts) },
];

// Lazy starter-pack load — only when a scenario is actually built.
// Reuses the cached pack across calls so the test doesn't pay JSON
// parse cost N times.
import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack';
import type { ContentPack } from 'ttrpg-engine-dnd';

let cachedStarter: ContentPack | undefined;
const loadStarter = (): ContentPack => {
  if (cachedStarter === undefined) cachedStarter = loadStarterPack();
  return cachedStarter;
};
