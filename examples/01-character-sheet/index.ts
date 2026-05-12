// Example 01: build a Fighter and print their derived sheet.
// Run: npx tsx examples/01-character-sheet/index.ts

import {
  createEngine,
  loadStarterPack,
  seededRNG,
  newCharacterId,
  newItemInstanceId,
  newEventId,
  CharacterSchema,
} from '../../src/index.js';
import { commit } from '../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ItemAcquiredEvent } from '../../src/schemas/events/inventory.js';

const engine = createEngine({
  contentPacks: [loadStarterPack()],
  rng: seededRNG(1),
});

const swordId = newItemInstanceId();
const armorId = newItemInstanceId();

const alyx = CharacterSchema.parse({
  id: newCharacterId(),
  name: 'Alyx',
  speciesId: 'human',
  backgroundId: 'soldier',
  classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
  abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
  hp: { current: 26, max: 26, temp: 0 },
  featsTaken: ['savage-attacker'],
  equipped: { armor: armorId, attuned: [] },
});

let campaign = engine.createCampaign({ name: 'demo' });
const now = () => new Date().toISOString();
campaign = commit(campaign, [
  {
    id: newEventId(),
    at: now(),
    type: 'ItemAcquired',
    instance: { id: swordId, definitionId: 'longsword', quantity: 1, attuned: false, identifiedByCharacterIds: [] },
  } satisfies ItemAcquiredEvent,
  {
    id: newEventId(),
    at: now(),
    type: 'ItemAcquired',
    instance: { id: armorId, definitionId: 'chain-shirt', quantity: 1, attuned: false, identifiedByCharacterIds: [] },
  } satisfies ItemAcquiredEvent,
  {
    id: newEventId(),
    at: now(),
    type: 'CharacterCreated',
    snapshot: alyx,
  } satisfies CharacterCreatedEvent,
]);

const sheet = engine.derive.character(campaign.state, alyx.id);
const ac = engine.derive.ac(campaign.state, alyx.id);
const attack = engine.derive.attackBonus(campaign.state, alyx.id, swordId);

console.log(`${alyx.name}, Fighter ${sheet.totalLevel}`);
console.log(`HP ${sheet.hp.current}/${sheet.hp.max}`);
console.log(`AC ${ac.total}`);
console.log(`Longsword: +${attack.total} to hit`);
console.log('Saving throws:');
for (const ability of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const) {
  const save = engine.derive.savingThrow(campaign.state, alyx.id, ability);
  console.log(`  ${ability}: ${save.total >= 0 ? '+' : ''}${save.total}`);
}
