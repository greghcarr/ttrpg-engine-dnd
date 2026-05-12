// Example 03: serialize a campaign and reconstitute it from JSON.
// Run: npx tsx examples/03-save-and-load/index.ts

import {
  createEngine,
  loadStarterPack,
  seededRNG,
  newCharacterId,
  newEventId,
  CharacterSchema,
  EventSchema,
} from '../../src/index.js';
import { commit } from '../../src/engine/commit.js';
import { replay } from '../../src/engine/replay.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';

const engine = createEngine({
  contentPacks: [loadStarterPack()],
  rng: seededRNG(7),
});

const borin = CharacterSchema.parse({
  id: newCharacterId(),
  name: 'Borin',
  speciesId: 'human',
  backgroundId: 'soldier',
  classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
  abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
  hp: { current: 12, max: 12, temp: 0 },
  featsTaken: ['savage-attacker'],
});

let campaign = engine.createCampaign({ name: 'demo' });
campaign = commit(campaign, [
  {
    id: newEventId(),
    at: new Date().toISOString(),
    type: 'CharacterCreated',
    snapshot: borin,
  } satisfies CharacterCreatedEvent,
]);

// Save: events alone are the durable artifact. The state is computed.
const saved = JSON.stringify({
  id: campaign.id,
  name: campaign.name,
  schemaVersion: campaign.schemaVersion,
  events: campaign.events,
});
console.log(`Saved ${saved.length} bytes; ${campaign.events.length} events captured.`);

// Load: parse, validate every event, replay.
const parsed = JSON.parse(saved) as { id: string; name: string; schemaVersion: number; events: unknown[] };
const parsedEvents = parsed.events.map((e) => EventSchema.parse(e));
const restoredState = replay(parsedEvents);

const equal = JSON.stringify(restoredState) === JSON.stringify(campaign.state);
console.log(`Round-trip state equal: ${equal}`);
console.log(`Borin in restored state: ${restoredState.characters[borin.id]?.name}`);
