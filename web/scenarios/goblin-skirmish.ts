// Canned single-encounter scenario for the web demo.
//
// Builds: 4 combatants (party fighter + party wizard + two goblins),
// rolls initiative under a seeded RNG so order is deterministic across
// reloads, places everyone at fixed starting positions, and ends with
// the first combatant's turn already begun (Dodge / Move / Attack are
// immediately legal on whoever rolled highest initiative).
//
// Per docs/web-demo-plan.md (Open question for first scaffolding
// session): starts as an inline TypeScript builder. Convert to a JSON
// scenario file + loader if/when a second scenario lands.

import {
  CharacterSchema,
  createEngine,
  newCharacterId,
  newEventId,
  newItemInstanceId,
  seededRNG,
  type Campaign,
  type CharacterCreatedEvent,
  type ContentPack,
  type EncounterStartedEvent,
  type Engine,
  type Event,
  type ItemAcquiredEvent,
} from 'ttrpg-engine-dnd';

const PARTY_X = 5;
const GOBLIN_X = 25;
const ROW_FRONT = 5;
const ROW_BACK = 10;
const DEFAULT_SEED = 42;

export interface GoblinSkirmishCombatants {
  readonly [name: string]: string;
  readonly alyx: string;
  readonly brindle: string;
  readonly goblinA: string;
  readonly goblinB: string;
}

export interface GoblinSkirmishWeapons {
  readonly alyxLongsword: string;
  readonly brindleQuarterstaff: string;
  readonly goblinADagger: string;
  readonly goblinBDagger: string;
}

export interface GoblinSkirmish {
  readonly engine: Engine;
  readonly campaign: Campaign;
  readonly encounterId: string;
  readonly combatants: GoblinSkirmishCombatants;
  readonly weapons: GoblinSkirmishWeapons;
  readonly seed: number;
}

export interface BuildGoblinSkirmishOptions {
  readonly seed?: number;
}

const now = (): string => new Date().toISOString();

const makeItem = (definitionId: string) => ({
  id: newItemInstanceId(),
  definitionId,
  quantity: 1,
  attuned: false,
  identifiedByCharacterIds: [],
});

const buildAlyx = (longswordId: string, armorId: string) =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'pc',
    name: 'Alyx',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    inventory: [longswordId, armorId],
    equipped: { mainHand: longswordId, armor: armorId, attuned: [] },
  });

const buildBrindle = (staffId: string) =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'pc',
    name: 'Brindle',
    speciesId: 'gnome',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 13, CHA: 10 },
    hp: { current: 18, max: 18, temp: 0 },
    featsTaken: ['magic-initiate-wizard'],
    inventory: [staffId],
    equipped: { mainHand: staffId, attuned: [] },
    knownSpells: ['fire-bolt', 'mage-hand', 'magic-missile', 'shield', 'mage-armor'],
    preparedSpells: ['magic-missile', 'shield', 'mage-armor'],
  });

const buildGoblin = (name: string, weaponId: string) =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name,
    statblockId: 'goblin',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    hp: { current: 7, max: 7, temp: 0 },
    armorClass: 15,
    inventory: [weaponId],
    equipped: { mainHand: weaponId, attuned: [] },
    featsTaken: [],
  });

const positionEvent = (
  encounterId: string,
  combatantId: string,
  x: number,
  y: number,
): Event => ({
  id: newEventId(),
  at: now(),
  type: 'CombatantMoved',
  encounterId,
  combatantId,
  fromPosition: { x: 0, y: 0 },
  toPosition: { x, y },
  feetTraveled: 0,
});

export const buildGoblinSkirmish = (
  starter: ContentPack,
  opts: BuildGoblinSkirmishOptions = {},
): GoblinSkirmish => {
  const seed = opts.seed ?? DEFAULT_SEED;
  const engine = createEngine({ contentPacks: [starter], rng: seededRNG(seed) });

  const alyxLongsword = makeItem('longsword');
  const alyxArmor = makeItem('chain-mail');
  const brindleStaff = makeItem('quarterstaff');
  const goblinADagger = makeItem('dagger');
  const goblinBDagger = makeItem('dagger');

  const alyx = buildAlyx(alyxLongsword.id, alyxArmor.id);
  const brindle = buildBrindle(brindleStaff.id);
  const goblinA = buildGoblin('Goblin Scout', goblinADagger.id);
  const goblinB = buildGoblin('Goblin Cutter', goblinBDagger.id);

  let campaign = engine.createCampaign({ name: 'Goblin Skirmish' });

  campaign = engine.commit(campaign, [
    { id: newEventId(), at: now(), type: 'ItemAcquired', instance: alyxLongsword } satisfies ItemAcquiredEvent,
    { id: newEventId(), at: now(), type: 'ItemAcquired', instance: alyxArmor } satisfies ItemAcquiredEvent,
    { id: newEventId(), at: now(), type: 'ItemAcquired', instance: brindleStaff } satisfies ItemAcquiredEvent,
    { id: newEventId(), at: now(), type: 'ItemAcquired', instance: goblinADagger } satisfies ItemAcquiredEvent,
    { id: newEventId(), at: now(), type: 'ItemAcquired', instance: goblinBDagger } satisfies ItemAcquiredEvent,
    { id: newEventId(), at: now(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
    { id: newEventId(), at: now(), type: 'CharacterCreated', snapshot: brindle } satisfies CharacterCreatedEvent,
    { id: newEventId(), at: now(), type: 'CharacterCreated', snapshot: goblinA } satisfies CharacterCreatedEvent,
    { id: newEventId(), at: now(), type: 'CharacterCreated', snapshot: goblinB } satisfies CharacterCreatedEvent,
  ]);

  const enc = engine.plan.createEncounter(campaign.state, {
    combatantIds: [alyx.id, brindle.id, goblinA.id, goblinB.id],
    name: 'Goblin Skirmish',
  });
  campaign = engine.commit(campaign, enc.events);
  campaign = engine.commit(
    campaign,
    engine.plan.rollInitiative(campaign.state, { encounterId: enc.encounterId }).events,
  );
  campaign = engine.commit(campaign, [
    {
      id: newEventId(),
      at: now(),
      type: 'EncounterStarted',
      encounterId: enc.encounterId,
    } satisfies EncounterStartedEvent,
    positionEvent(enc.encounterId, alyx.id, PARTY_X, ROW_FRONT),
    positionEvent(enc.encounterId, brindle.id, PARTY_X, ROW_BACK),
    positionEvent(enc.encounterId, goblinA.id, GOBLIN_X, ROW_FRONT),
    positionEvent(enc.encounterId, goblinB.id, GOBLIN_X, ROW_BACK),
  ]);
  campaign = engine.commit(
    campaign,
    engine.plan.beginFirstTurn(campaign.state, { encounterId: enc.encounterId }).events,
  );

  return {
    engine,
    campaign,
    encounterId: enc.encounterId,
    combatants: {
      alyx: alyx.id,
      brindle: brindle.id,
      goblinA: goblinA.id,
      goblinB: goblinB.id,
    },
    weapons: {
      alyxLongsword: alyxLongsword.id,
      brindleQuarterstaff: brindleStaff.id,
      goblinADagger: goblinADagger.id,
      goblinBDagger: goblinBDagger.id,
    },
    seed,
  };
};
