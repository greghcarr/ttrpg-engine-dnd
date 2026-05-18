// Misty Step into Occupied Space scenario.
//
// Demonstrates RAW Misty Step: "teleport up to 30 feet to an unoccupied
// space." The engine's planMistyStep checks every nearby combatant's
// position before allowing the teleport. This scenario seeds a wizard
// who knows Misty Step, ringed by combatants on every adjacent square
// within range — so any attempt at a 5ft teleport lands occupied.

import {
  CharacterSchema,
  createEngine,
  newCharacterId,
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
} from 'dnd-srd-engine';

export interface MistyStepOccupiedSession {
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

export const buildMistyStepOccupied = (
  starter: ContentPack,
  opts: { seed?: number } = {},
): MistyStepOccupiedSession => {
  const seed = opts.seed ?? 42;
  const engine = createEngine({ contentPacks: [starter], rng: seededRNG(seed) });

  const wizStaff = makeItem('quarterstaff');
  const goblinAItem = makeItem('dagger');
  const goblinBItem = makeItem('dagger');

  const wizard = CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'pc',
    name: 'Brindle',
    speciesId: 'gnome',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 13, CHA: 10 },
    hp: { current: 18, max: 18, temp: 0 },
    featsTaken: [],
    inventory: [wizStaff.id],
    equipped: { mainHand: wizStaff.id, attuned: [] },
    knownSpells: ['fire-bolt', 'magic-missile', 'misty-step', 'shield', 'mage-armor'],
    preparedSpells: ['misty-step', 'magic-missile'],
  });

  const goblinA = CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Goblin Left',
    statblockId: 'goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    hp: { current: 7, max: 7, temp: 0 },
    armorClass: 15,
    inventory: [goblinAItem.id],
    equipped: { mainHand: goblinAItem.id, attuned: [] },
    featsTaken: [],
  });

  const goblinB = CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Goblin Right',
    statblockId: 'goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    hp: { current: 7, max: 7, temp: 0 },
    armorClass: 15,
    inventory: [goblinBItem.id],
    equipped: { mainHand: goblinBItem.id, attuned: [] },
    featsTaken: [],
  });

  let campaign = engine.createCampaign({ name: 'Misty Step Occupied' });
  campaign = engine.commit(campaign, [
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: wizStaff } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: goblinAItem } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: goblinBItem } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: goblinA } satisfies CharacterCreatedEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: goblinB } satisfies CharacterCreatedEvent,
  ]);

  const encounterId = newEncounterId();
  campaign = engine.commit(campaign, [
    {
      id: eventId(),
      at: now(),
      type: 'EncounterCreated',
      encounterId,
      name: 'Misty Step Occupied',
      combatantIds: [wizard.id, goblinA.id, goblinB.id],
    } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: wizard.id, d20: 20, modifier: 2, total: 22 },
        { combatantId: goblinA.id, d20: 8, modifier: 2, total: 10 },
        { combatantId: goblinB.id, d20: 5, modifier: 2, total: 7 },
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
      combatantId: wizard.id,
      round: 1,
    } satisfies TurnStartedEvent,
    // Wizard at center; goblins flank.
    {
      id: eventId(),
      at: now(),
      type: 'CombatantMoved',
      encounterId,
      combatantId: wizard.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 10, y: 10 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'CombatantMoved',
      encounterId,
      combatantId: goblinA.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 5, y: 10 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'CombatantMoved',
      encounterId,
      combatantId: goblinB.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 15, y: 10 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
  ]);

  return {
    engine,
    campaign,
    encounterId,
    combatants: { wizard: wizard.id, goblinA: goblinA.id, goblinB: goblinB.id },
    seed,
  };
};
