// Example 00: README "Quick start" snippet. Verbatim from README.md so
// CI catches drift if the example stops compiling or running.
// Run: npx tsx examples/00-quickstart/index.ts

import {
  createEngine, loadStarterPack, createPC, commit,
  seededRNG, newEventId,
} from '../../src/index.js';

const engine = createEngine({ contentPacks: [loadStarterPack()], rng: seededRNG(42) });
const alyx = createPC({
  name: 'Alyx', speciesId: 'human', backgroundId: 'soldier',
  classId: 'fighter', level: 3, hpMax: 26,
  abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
});

let campaign = engine.createCampaign({ name: 'demo' });
campaign = commit(campaign, [
  { id: newEventId(), at: new Date().toISOString(), type: 'CharacterCreated', snapshot: alyx },
]);

const sheet = engine.derive.character(campaign.state, alyx.id);
console.log(`${alyx.name}: AC ${sheet.ac.total}, HP ${sheet.hp.current}/${sheet.hp.max}`);
