// Concentrating Wizard at 1 HP scenario.
//
// Demonstrates three RAW rules in one scene:
//   1. Concentration auto-clears when the caster drops to 0 HP.
//   2. An Unconscious actor's planners reject all attempts at action.
//   3. Death saves fire at the start of the unconscious creature's
//      turn; the combat sandbox shows the rotation around them.
//
// We seed the wizard mid-combat: concentrating on a synthetic effect
// (the engine doesn't care about the spell identity for the clear-on-
// drop check), at 1 HP. The goblin acts first, so a single dagger
// swing from the visitor drops her to 0 — and concentration vanishes
// in the same commit. Starting at 1 (rather than 0) is deliberate:
// it puts the auto-clear inside an interactively-triggered event
// rather than buried in the scenario's setup history.

import {
  CharacterSchema,
  createEngine,
  newCharacterId,
  newEffectInstanceId,
  newEncounterId,
  newEventId,
  newItemInstanceId,
  seededRNG,
  type Campaign,
  type CharacterCreatedEvent,
  type CombatantMovedEvent,
  type ContentPack,
  type EncounterCreatedEvent,
  type EncounterStartedEvent,
  type Engine,
  type InitiativeRolledEvent,
  type ItemAcquiredEvent,
  type TurnStartedEvent,
} from 'ttrpg-engine-dnd';

export interface DownedWizardSession {
  readonly engine: Engine;
  readonly campaign: Campaign;
  readonly encounterId: string;
  readonly combatants: Readonly<Record<string, string>>;
  readonly seed: number;
}

const now = (): string => new Date().toISOString();
const eventId = (): string => newEventId();

const makeItem = (definitionId: string) => ({
  id: newItemInstanceId(),
  definitionId,
  quantity: 1,
  attuned: false,
  identifiedByCharacterIds: [],
});

export const buildDownedWizard = (
  starter: ContentPack,
  opts: { seed?: number } = {},
): DownedWizardSession => {
  const seed = opts.seed ?? 42;
  const engine = createEngine({ contentPacks: [starter], rng: seededRNG(seed) });

  const wizStaff = makeItem('quarterstaff');
  const goblinItem = makeItem('dagger');

  // Wizard is built at 1 HP — a single goblin dagger swing drops them.
  // Concentration is seeded by patching the snapshot's
  // concentrationEffectId after parsing. The engine doesn't validate
  // the effect instance exists for the auto-clear check.
  const wizardBase = CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'pc',
    name: 'Brindle',
    speciesId: 'gnome',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 13, CHA: 10 },
    hp: { current: 1, max: 18, temp: 0 },
    featsTaken: [],
    inventory: [wizStaff.id],
    equipped: { mainHand: wizStaff.id, attuned: [] },
    knownSpells: ['fire-bolt', 'magic-missile', 'bless', 'shield'],
    preparedSpells: ['bless', 'magic-missile'],
  });
  // Patch concentration after schema parse so the snapshot reflects an
  // in-progress concentration spell. The id is a real ULID — the
  // referenced effect instance doesn't exist in state, but the
  // engine's clear-on-drop path tolerates a dangling pointer.
  const wizard = { ...wizardBase, concentrationEffectId: newEffectInstanceId() };

  const goblin = CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Goblin Striker',
    statblockId: 'goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    hp: { current: 7, max: 7, temp: 0 },
    armorClass: 15,
    inventory: [goblinItem.id],
    equipped: { mainHand: goblinItem.id, attuned: [] },
    featsTaken: [],
  });

  let campaign = engine.createCampaign({ name: 'Downed Wizard' });
  campaign = engine.commit(campaign, [
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: wizStaff } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: goblinItem } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: goblin } satisfies CharacterCreatedEvent,
  ]);

  const encounterId = newEncounterId();
  campaign = engine.commit(campaign, [
    {
      id: eventId(),
      at: now(),
      type: 'EncounterCreated',
      encounterId,
      name: 'Downed Wizard',
      combatantIds: [goblin.id, wizard.id],
    } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        // Goblin goes first so the player can immediately attack the
        // wizard and watch concentration clear.
        { combatantId: goblin.id, d20: 20, modifier: 2, total: 22 },
        { combatantId: wizard.id, d20: 5, modifier: 2, total: 7 },
      ],
    } satisfies InitiativeRolledEvent,
    {
      id: eventId(),
      at: now(),
      type: 'EncounterStarted',
      encounterId,
    } satisfies EncounterStartedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'TurnStarted',
      encounterId,
      combatantId: goblin.id,
      round: 1,
    } satisfies TurnStartedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'CombatantMoved',
      encounterId,
      combatantId: wizard.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 5, y: 5 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'CombatantMoved',
      encounterId,
      combatantId: goblin.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 10, y: 5 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
  ]);

  return {
    engine,
    campaign,
    encounterId,
    combatants: { wizard: wizard.id, goblin: goblin.id },
    seed,
  };
};
