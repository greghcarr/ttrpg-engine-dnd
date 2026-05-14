// Scenario registry.
//
// Each entry: { id, title, description, hint, build(opts?) → DemoSession }.
// The CI replay test (tests/integration/web-scenarios.test.ts) loops
// over this list, so adding a new scenario file means dropping it
// here and CI auto-covers it. The demo's scenario-picker reads the
// same list and renders one option per entry.

import type { Campaign, ContentPack, Engine } from 'ttrpg-engine-dnd';
import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack';
import { buildGoblinSkirmish } from './goblin-skirmish.js';
import { buildFrightenedHalfling } from './frightened-halfling.js';
import { buildMistyStepOccupied } from './misty-step-occupied.js';
import { buildDownedWizard } from './downed-wizard.js';

export interface DemoSession {
  readonly engine: Engine;
  readonly campaign: Campaign;
  readonly encounterId: string;
  /** logical-name → character-id, used by the combat-sandbox row labels */
  readonly combatants: Readonly<Record<string, string>>;
  readonly seed: number;
}

export interface DemoScenario {
  readonly id: string;
  readonly title: string;
  /** One-line summary, shown in the picker. */
  readonly description: string;
  /** Optional "what to try" text shown in the demo when this scenario is active. */
  readonly hint?: string;
  readonly build: (opts?: { seed?: number }) => DemoSession;
}

export const SCENARIOS: ReadonlyArray<DemoScenario> = [
  {
    id: 'goblin-skirmish',
    title: 'Goblin Skirmish',
    description: 'A 2-vs-2 starter fight: Alyx (Fighter) + Brindle (Wizard) vs two goblins.',
    hint: 'Try the full Combat Sandbox toolbar — Attack, Move, Dash, Dodge, End Turn.',
    build: (opts) => buildGoblinSkirmish(loadStarter(), opts),
  },
  {
    id: 'frightened-halfling',
    title: 'Frightened Halfling',
    description: 'A Small halfling fighter, Frightened by a goblin. Tests source-tracking and move restriction.',
    hint: 'On the halfling\'s turn, click → (move east, toward the goblin). The engine rejects: "Frightened by Goblin and cannot move closer." Try ← instead — moving away is allowed.',
    build: (opts) => buildFrightenedHalfling(loadStarter(), opts),
  },
  {
    id: 'misty-step-occupied',
    title: 'Misty Step into Occupied Space',
    description: 'A wizard who knows Misty Step, with the only adjacent destination already occupied. Tests spell-level destination occupancy.',
    hint: 'The Combat Sandbox doesn\'t yet have a Misty Step button — check the Rules Lab below or trigger the rule from the browser console: `host.dispatch({ kind: \'commit\', events: [/* ... */] })`. Engine still enforces the rule when called.',
    build: (opts) => buildMistyStepOccupied(loadStarter(), opts),
  },
  {
    id: 'downed-wizard',
    title: 'Downed Wizard (HP 0)',
    description: 'A wizard concentrating on Bless drops to 0 HP. Tests concentration auto-clear, action-block, death-save rotation.',
    hint: 'On the wizard\'s turn, only End Turn is available (the sandbox auto-detects HP=0). Watch the Event Inspector — concentration cleared on the damage event, and a DeathSaveRolled fires at turn start.',
    build: (opts) => buildDownedWizard(loadStarter(), opts),
  },
];

let cachedStarter: ContentPack | undefined;
const loadStarter = (): ContentPack => {
  if (cachedStarter === undefined) cachedStarter = loadStarterPack();
  return cachedStarter;
};
