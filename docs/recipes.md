# Recipes

Common patterns. Skim for the one you need. Each recipe is self-contained.

For background on why the API is shaped this way, see [docs/concepts.md](concepts.md).

## Save mid-encounter

The event log is the durable artifact. Save it to disk, a database, or a query string. Replay reconstructs everything.

```ts
import { serializeCampaign, loadCampaign } from 'ttrpg-engine-dnd';

// Save
const json = serializeCampaign(campaign);
fs.writeFileSync('save.json', json);

// Load
const restored = loadCampaign(fs.readFileSync('save.json', 'utf8'));
// restored.state deep-equals the campaign at save time.
```

There is no "save state" step. State is computed; events are the truth.

## Undo and redo

```ts
import { undo, redo } from 'ttrpg-engine-dnd';

campaign = undo(campaign);  // moves the cursor back one event; state recomputes
campaign = redo(campaign);  // moves it forward
```

Committing new events after an undo discards the redo tail (standard text-editor semantics). If you want branching timelines, fork the events array instead.

## Branch the timeline ("what if...")

```ts
import { replay } from 'ttrpg-engine-dnd';

const hypotheticalEvents = [...campaign.events, ...newPlannedEvents];
const hypotheticalState = replay(hypotheticalEvents);
// Inspect hypotheticalState without touching campaign.
```

This is how you'd implement an AI DM evaluating "what happens if I cast Fireball here?" without committing the action.

## Add content to the starter pack

The starter pack is JSON. The cleanest extension is to load it alongside your own pack:

```ts
import { loadStarterPack, loadContentPack, resolveContent } from 'ttrpg-engine-dnd';

const homebrew = loadContentPack({
  id: 'my-homebrew',
  name: 'My Homebrew',
  version: '0.1.0',
  spells: [
    {
      id: 'home-fire-arrow',
      name: 'Fire Arrow',
      level: 1,
      school: 'evocation',
      castingTime: 'Action',
      range: '60 feet',
      components: { verbal: true, somatic: true },
      duration: 'Instantaneous',
      concentration: false,
      ritual: false,
      classes: ['wizard', 'sorcerer'],
      mechanicalEffects: [
        { kind: 'attack', attackKind: 'ranged', damageDice: '2d6', damageType: 'fire' },
      ],
    },
  ],
});

const engine = createEngine({ contentPacks: [loadStarterPack(), homebrew] });
```

Later packs override earlier ones on ID conflicts. This is how you layer core + setting + table-specific homebrew.

For the schema shapes (which fields a `Spell` / `Feat` / `Class` accepts), see the Zod schemas under `src/schemas/content/` or the API reference.

## Add a houserule via campaign settings

```ts
campaign = commit(campaign, [
  {
    id: newEventId(),
    at: new Date().toISOString(),
    type: 'CampaignSettingsChanged',
    grittyRest: true,
    customHouserulesAdd: ['critical-fumble', 'inspiration-on-nat-1'],
  },
]);
```

The engine doesn't enforce these flags automatically; consumers branch on `campaign.state.settings.grittyRest` in their own planner wrappers (e.g., to scale rest durations). The events and flags exist so the houserule choice is part of the campaign's auditable history.

## Add a new feat

Feats are content. Add them to your pack:

```ts
{
  feats: [
    {
      id: 'home-iron-stomach',
      name: 'Iron Stomach',
      category: 'general',
      repeatable: false,
      prerequisites: [],
      effects: [
        { kind: 'GrantConditionImmunity', conditionId: 'poisoned' },
      ],
    },
  ],
}
```

A character takes a feat by including its ID in `Character.featsTaken`. The engine's effect-stack builder walks `featsTaken` and applies the listed effects to derivations.

For feats that need code-handler logic (e.g., a triggered reaction that depends on game state in a way primitives can't express), use the `OnEvent` primitive when possible; for truly procedural feats, plan to extend the engine via the handler registry (this is the same path Wild Shape, Polymorph, and Wish take internally).

## Display a character sheet in a UI

```ts
const sheet = engine.derive.character(campaign.state, characterId);
// sheet.hp.current, sheet.hp.max
// sheet.ac.total, sheet.ac.breakdown (each modifier and its source)
// sheet.savingThrows.STR.total, .breakdown
// sheet.spellSlots
// sheet.hasPendingChoices, sheet.pendingChoiceIds
```

Derivations are memoized per `state.version` (every commit invalidates). Repeated calls at the same version return the same object reference, so this is safe to call as often as your UI needs.

For the weapon's attack bonus:

```ts
const ab = engine.derive.attackBonus(state, characterId, weaponInstanceId);
console.log(`+${ab.total} to hit`);
for (const entry of ab.breakdown) console.log(`  ${entry.source}: ${entry.value}`);
```

## Get the legal moves for a combatant

There isn't a single `legalMoves()` API; the engine instead exposes planners that fail loudly when called illegally. The common pattern is to try-call and catch:

```ts
const tryPlan = <T>(fn: () => T): T | undefined => {
  try { return fn(); } catch { return undefined; }
};

const canAttack = tryPlan(() =>
  engine.plan.attack(state, { attackerId, targetId, weaponInstanceId }),
) !== undefined;
```

For action-economy-aware UI ("is the Action used? are attacks remaining?"), inspect the combatant directly:

```ts
const encounter = state.encounters[state.activeEncounterId!];
const me = encounter.combatants.find((c) => c.combatantId === myId);
if (!me?.turnUsage.actionUsed) {
  // Action available
}
const budget = engine.derive.actionEconomyBudget?.(state, myId); // if exposed
```

## Run combat without an explicit encounter

Many planners work out of combat too. `plan.attack` doesn't require an active encounter; it just runs the attack chain. The action-economy guards only kick in when the attacker is the active combatant in an active encounter, so out-of-combat attacks are unmetered.

This is useful for sparring matches, narrative combat ("the assassin strikes from behind"), or testing.

## Stream events to a multiplayer peer

```ts
// Sender
const newEvents = engine.plan.attack(state, intent).events;
campaign = commit(campaign, newEvents);
socket.send(JSON.stringify({ events: newEvents }));

// Receiver
socket.on('message', (msg) => {
  const { events } = JSON.parse(msg) as { events: unknown[] };
  const validated = events.map((e) => EventSchema.parse(e));
  campaign = commit(campaign, validated);
});
```

Both sides must use compatible content packs and (for replay safety) the same seeded RNG decisions. The plan/commit split means the dice are already baked into the events; receivers don't need to re-roll.

## Migrate between schema versions

The engine persists with a `schemaVersion` (separate from package version). When you bump the persisted shape, write a migration:

```ts
// src/migrations/v2.ts (consumer-side, if you fork)
export const migrateV1ToV2 = (state: V1State): V2State => { ... };
```

`migrate(json)` walks all registered migrations forward. The MVP `migrations/v1.ts` is a no-op placeholder so the machinery is real, not vapor, when you need it for the first real bump.

## Validate a content pack before shipping

```ts
import { loadContentPack, resolveContent, validateCrossReferences, ContentPackLoadError } from 'ttrpg-engine-dnd';

try {
  const pack = loadContentPack(json);
  const content = resolveContent([pack]);
  const issues = validateCrossReferences(content);
  if (issues.length > 0) {
    console.error('Content issues:');
    for (const i of issues) {
      console.error(`  ${i.path}: ${i.message}${i.suggestion ? ` ${i.suggestion}` : ''}`);
    }
  }
} catch (e) {
  if (e instanceof ContentPackLoadError) {
    for (const i of e.issues) console.error(`  ${i.path}: ${i.message}`);
  }
}
```

Shape errors throw `ContentPackLoadError` with path-pointed issues. Cross-reference errors return Levenshtein-suggested fixes: a missing `origin-feat-id` typo'd as "savage-attackr" gets `Did you mean "savage-attacker"?`.

## Implement a custom planner

You can write your own planners that consume RNG and return events:

```ts
import type { CampaignState, Event } from 'ttrpg-engine-dnd';
import { newEventId } from 'ttrpg-engine-dnd';

export const planMyHomebrewAction = (
  state: CampaignState,
  rng: RNG,
  intent: { characterId: string; ... },
): { events: ReadonlyArray<Event> } => {
  // ... consume rng for any rolls ...
  // ... build events whose reducers already exist ...
  return { events: [...] };
};
```

If the events you emit are existing event types (DamageApplied, ConditionApplied, etc.), no engine extension is needed. If you need new event types, you'll need to extend `apply.ts` and add reducers (at that point you've forked the engine).

## Read a character's pending choices

```ts
const character = state.characters[characterId];
for (const choiceId of character.pendingChoiceIds) {
  const choice = state.pendingChoices[choiceId];
  console.log(`${choice.kind}: ${choice.prompt}`);
  for (const option of choice.options) {
    console.log(`  - ${option.label}`);
  }
}
```

To resolve a choice once the player picks:

```ts
campaign = commit(
  campaign,
  engine.plan.resolveChoice(campaign.state, {
    choiceId,
    selectedOptionIds: [pickedOptionId],
  }).events,
);
```

The chosen option's effects become active immediately (visible in the next derivation).

## Inspect an event log human-readably

The engine has a transcript formatter used by golden tests. It's not exported (it depends on test fixtures), but the shape is small and easy to lift:

```ts
// Roughly:
const lines = campaign.events.map((event) => {
  switch (event.type) {
    case 'CharacterCreated': return `${event.snapshot.name} joined.`;
    case 'AttackRolled': return `Attack: d20+${event.bonus} = ${event.total}.`;
    // ...
  }
});
```

Or look at `tests/transcript.ts` for the full formatter as a reference implementation.

## Where to next

- **Conceptual orientation**: [docs/concepts.md](concepts.md).
- **API reference**: [docs/api-overview.md](api-overview.md).
- **Working examples**: [examples/](../examples/).
- **A full campaign in one transcript**: [tests/golden/transcripts/showcase.transcript.md](../tests/golden/transcripts/showcase.transcript.md).
