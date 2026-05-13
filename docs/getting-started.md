# Getting started

This walkthrough builds your first character, attacks a goblin, saves the campaign, and reloads it. About fifteen minutes from a blank project.

## 1. Install

```sh
npm install ttrpg-engine-dnd@alpha
```

Peer dependencies (`zod`, `immer`, `ulid`) install transitively.

## 2. Create an engine with the starter pack

```ts
import { createEngine, loadStarterPack, seededRNG } from 'ttrpg-engine-dnd';

const engine = createEngine({
  contentPacks: [loadStarterPack()],
  rng: seededRNG(42),
});
```

The starter pack ships in the package and includes Fighter, Wizard, Rogue, Paladin, and Warlock classes through level 5, Human species, Soldier background, all 15 conditions, common weapons and armor, and a handful of spells. Bring your own content pack when you outgrow it.

## 3. Build a character

```ts
import { CharacterSchema, newCharacterId, newItemInstanceId, newEventId } from 'ttrpg-engine-dnd';
import { commit } from 'ttrpg-engine-dnd';

const alyx = CharacterSchema.parse({
  id: newCharacterId(),
  name: 'Alyx',
  speciesId: 'human',
  backgroundId: 'soldier',
  classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
  abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
  hp: { current: 26, max: 26, temp: 0 },
  featsTaken: ['savage-attacker'],
});

const sword = {
  id: newItemInstanceId(),
  definitionId: 'longsword',
  quantity: 1,
  attuned: false,
  identifiedByCharacterIds: [],
};

let campaign = engine.createCampaign({ name: 'demo' });
campaign = commit(campaign, [
  { id: newEventId(), at: new Date().toISOString(), type: 'ItemAcquired', instance: sword },
  { id: newEventId(), at: new Date().toISOString(), type: 'CharacterCreated', snapshot: alyx },
]);
```

The engine state is now populated. `commit` is pure: it returns a new `Campaign` with the events appended and the state advanced.

## 4. Derive their sheet

```ts
const sheet = engine.derive.character(campaign.state, alyx.id);
const ac = engine.derive.ac(campaign.state, alyx.id);
const attack = engine.derive.attackBonus(campaign.state, alyx.id, sword.id);

console.log(`AC ${ac.total}, Longsword +${attack.total} to hit`);
```

Every derivation returns a typed result with a breakdown (each contributing modifier and its source), not just a total.

## 5. Take an attack

Add a goblin, create an encounter, and attack:

```ts
const goblin = CharacterSchema.parse({
  id: newCharacterId(),
  name: 'Goblin',
  speciesId: 'human',
  backgroundId: 'soldier',
  classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
  abilityScores: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
  hp: { current: 7, max: 7, temp: 0 },
  featsTaken: ['savage-attacker'],
});

campaign = commit(campaign, [
  { id: newEventId(), at: new Date().toISOString(), type: 'CharacterCreated', snapshot: goblin },
]);

const enc = engine.plan.createEncounter(campaign.state, {
  combatantIds: [alyx.id, goblin.id],
  name: 'Goblin at the bridge',
});
campaign = commit(campaign, enc.events);
campaign = commit(campaign, engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events);
campaign = commit(campaign, engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events);

campaign = commit(
  campaign,
  engine.plan.attack(campaign.state, {
    attackerId: alyx.id,
    targetId: goblin.id,
    weaponInstanceId: sword.id,
  }).events,
);

console.log(`Goblin HP: ${campaign.state.characters[goblin.id]?.hp.current}/7`);
```

All randomness was consumed inside `engine.plan.attack`. The events it returned have the d20 and damage dice baked in. `apply()` never touches RNG, so the campaign event log replays to byte-equivalent state on any machine.

## 6. Save and load

```ts
import { replay, EventSchema } from 'ttrpg-engine-dnd';

// Save: events are the durable artifact. State is computed.
const saved = JSON.stringify({
  id: campaign.id,
  name: campaign.name,
  schemaVersion: campaign.schemaVersion,
  events: campaign.events,
});

// Load: parse events, replay, you have the same state.
const parsed = JSON.parse(saved) as { events: unknown[] };
const events = parsed.events.map((e) => EventSchema.parse(e));
const restoredState = replay(events);
// restoredState deep-equals campaign.state.
```

This is the practical payoff of event sourcing. Your save file is the truth; the state is derived.

## What's next

- **Understand the mental model**: [docs/concepts.md](concepts.md) explains why the API has the shape it does (events, plan/commit, content packs, effect primitives, PendingChoice).
- **Common how-tos**: [docs/recipes.md](recipes.md) covers save/undo/redo, branching timelines, adding content and feats, houserules, multiplayer sync, custom planners, and migrations.
- **Browse the public surface**: [docs/api-overview.md](api-overview.md) lists every public symbol by namespace.
- **Larger scenarios**: [examples/](../examples/) has three runnable scripts. The showcase transcript at [tests/golden/transcripts/showcase.transcript.rtf](../tests/golden/transcripts/showcase.transcript.rtf) walks through a multi-act campaign exercising most of the engine.
- **Bring your own content**: see [src/schemas/content/](../src/schemas/content/) for the Zod schemas of `Species`, `Background`, `Class`, `Spell`, `Feat`, `ItemDefinition`, `MonsterStatblock`, `Condition`. Load with `loadContentPack(json)` and merge with the starter via `resolveContent([starter, mine])`.
