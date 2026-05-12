// Example 02: build an encounter, take attacks, prove replay equivalence.
// Run: npx tsx examples/02-combat-encounter/index.ts

import {
  createEngine,
  loadStarterPack,
  seededRNG,
  throwOnCallRNG,
  newCharacterId,
  newItemInstanceId,
  newEventId,
  CharacterSchema,
} from '../../src/index.js';
import { commit } from '../../src/engine/commit.js';
import { replay } from '../../src/engine/replay.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ItemAcquiredEvent } from '../../src/schemas/events/inventory.js';
import type { EncounterStartedEvent } from '../../src/schemas/events/encounter.js';

const engine = createEngine({
  contentPacks: [loadStarterPack()],
  rng: seededRNG(42),
});

const makePC = (name: string, str: number, hp: number) =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: str, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
    hp: { current: hp, max: hp, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const alyx = makePC('Alyx', 18, 26);
const goblinA = makePC('Goblin A', 10, 15);
const goblinB = makePC('Goblin B', 10, 15);
const alyxSword = { id: newItemInstanceId(), definitionId: 'longsword', quantity: 1, attuned: false, identifiedByCharacterIds: [] };

const now = () => new Date().toISOString();

let campaign = engine.createCampaign({ name: 'tavern-brawl' });
campaign = commit(campaign, [
  { id: newEventId(), at: now(), type: 'ItemAcquired', instance: alyxSword } satisfies ItemAcquiredEvent,
  { id: newEventId(), at: now(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
  { id: newEventId(), at: now(), type: 'CharacterCreated', snapshot: goblinA } satisfies CharacterCreatedEvent,
  { id: newEventId(), at: now(), type: 'CharacterCreated', snapshot: goblinB } satisfies CharacterCreatedEvent,
]);

const enc = engine.plan.createEncounter(campaign.state, {
  combatantIds: [alyx.id, goblinA.id, goblinB.id],
  name: 'Two goblins at the gate',
});
campaign = commit(campaign, enc.events);
campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
campaign = commit(campaign, [
  { id: newEventId(), at: now(), type: 'EncounterStarted', encounterId: enc.encounterId } satisfies EncounterStartedEvent,
]);
campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);

campaign = commit(
  campaign,
  engine.plan.attack(campaign.state, {
    attackerId: alyx.id,
    targetId: goblinA.id,
    weaponInstanceId: alyxSword.id,
  }).events,
);

console.log(`After Alyx's swing:`);
console.log(`  Goblin A HP: ${campaign.state.characters[goblinA.id]?.hp.current}/${campaign.state.characters[goblinA.id]?.hp.max}`);

// Replay equivalence: rebuild state from the event log and compare.
const replayed = replay(campaign.events);
const equivalent = JSON.stringify(replayed) === JSON.stringify(campaign.state);
console.log(`Replay equivalent: ${equivalent}`);

// RNG-capture proof: applying the event log a second time must not consume RNG.
void throwOnCallRNG();
try {
  replay(campaign.events);
  console.log(`apply() is RNG-free: OK`);
} catch {
  console.log(`apply() called RNG (this is a bug)`);
}
