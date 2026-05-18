// Frightened Halfling scenario.
//
// Demonstrates RAW App. "Frightened": a frightened creature can't
// willingly move closer to the source of its fear, and rolls with
// disadvantage on ability checks/attack rolls while the source is in
// line of sight. The engine enforces the movement restriction via
// AppliedCondition.sourceCharacterId. This scenario seeds that field.

import {
  CharacterSchema,
  createEngine,
  newAppliedConditionId,
  newCharacterId,
  newEncounterId,
  newEventId,
  newItemInstanceId,
  seededRNG,
  type Campaign,
  type CharacterCreatedEvent,
  type CombatantMovedEvent,
  type ConditionAppliedEvent,
  type ContentPack,
  type EncounterCreatedEvent,
  type EncounterStartedEvent,
  type Engine,
  type InitiativeRolledEvent,
  type ItemAcquiredEvent,
  type TurnStartedEvent,
} from 'dnd-srd-engine';

export interface FrightenedHalflingSession {
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

export const buildFrightenedHalfling = (
  starter: ContentPack,
  opts: { seed?: number } = {},
): FrightenedHalflingSession => {
  const seed = opts.seed ?? 42;
  const engine = createEngine({ contentPacks: [starter], rng: seededRNG(seed) });

  const halflingDagger = makeItem('dagger');
  const halflingArmor = makeItem('leather-armor');
  const goblinDagger = makeItem('dagger');

  const halfling = CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'pc',
    name: 'Pip',
    speciesId: 'halfling',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 12, DEX: 16, CON: 14, INT: 10, WIS: 12, CHA: 10 },
    hp: { current: 24, max: 24, temp: 0 },
    featsTaken: [],
    inventory: [halflingDagger.id, halflingArmor.id],
    equipped: { mainHand: halflingDagger.id, armor: halflingArmor.id, attuned: [] },
  });

  const goblin = CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name: 'Snarltooth',
    statblockId: 'goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    hp: { current: 7, max: 7, temp: 0 },
    armorClass: 15,
    inventory: [goblinDagger.id],
    equipped: { mainHand: goblinDagger.id, attuned: [] },
    featsTaken: [],
  });

  let campaign = engine.createCampaign({ name: 'Frightened Halfling' });
  campaign = engine.commit(campaign, [
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: halflingDagger } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: halflingArmor } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: goblinDagger } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: halfling } satisfies CharacterCreatedEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: goblin } satisfies CharacterCreatedEvent,
  ]);

  const encounterId = newEncounterId();
  campaign = engine.commit(campaign, [
    {
      id: eventId(),
      at: now(),
      type: 'EncounterCreated',
      encounterId,
      name: 'Frightened Halfling',
      combatantIds: [halfling.id, goblin.id],
    } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: halfling.id, d20: 20, modifier: 3, total: 23 },
        { combatantId: goblin.id, d20: 5, modifier: 2, total: 7 },
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
      combatantId: halfling.id,
      round: 1,
    } satisfies TurnStartedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'CombatantMoved',
      encounterId,
      combatantId: halfling.id,
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
      toPosition: { x: 25, y: 5 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
    // Pip is Frightened by the goblin. The sourceCharacterId is what
    // makes planMove know which direction is "closer to the source".
    {
      id: eventId(),
      at: now(),
      type: 'ConditionApplied',
      targetId: halfling.id,
      conditionId: 'frightened',
      appliedConditionId: newAppliedConditionId(),
      sourceCharacterId: goblin.id,
    } satisfies ConditionAppliedEvent,
  ]);

  return {
    engine,
    campaign,
    encounterId,
    combatants: { halfling: halfling.id, goblin: goblin.id },
    seed,
  };
};
