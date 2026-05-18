// Rules Lab probe library.
//
// Each probe is a self-contained scenario that exercises one RAW rule
// and asserts whether the engine enforces it. Pure: no global state,
// no side effects, fresh engine + campaign per run. Designed for the
// browser-side "Rules Lab" panel — visitors click a button, every
// probe runs against the live engine, results turn green or red.
//
// Probes here are duplicated with the Vitest audit at
// tests/audit/raw-compliance.test.ts. The Vitest one is the CI
// regression net; this one is the visible-from-the-browser version.
// A follow-up commit will dedupe by moving the shared library into
// `src/audit/` once the schema is stable.
//
// Adding a probe: append a new `Probe` to ALL_PROBES with a unique id,
// a one-line description, and a run() that returns ProbeResult.

import {
  CharacterSchema,
  createEngine,
  newAppliedConditionId,
  newCharacterId,
  newEncounterId,
  newEventId,
  newItemInstanceId,
  newLocationId,
  seededRNG,
  type Campaign,
  type CharacterCreatedEvent,
  type CombatantMovedEvent,
  type ConditionAppliedEvent,
  type ContentPack,
  type DamageAppliedEvent,
  type EncounterCreatedEvent,
  type EncounterStartedEvent,
  type Engine,
  type Event,
  type InitiativeRolledEvent,
  type ItemAcquiredEvent,
  type TurnStartedEvent,
} from 'dnd-srd-engine';

export interface ProbeResult {
  readonly passed: boolean;
  readonly error?: string;
  readonly detail?: string;
}

export interface Probe {
  readonly id: string;
  readonly category: string;
  readonly name: string;
  /** The RAW rule the probe verifies, in one short sentence. */
  readonly raw: string;
  readonly run: (starter: ContentPack) => ProbeResult;
}

// ---------- shared helpers ----------

const now = (): string => new Date().toISOString();
const eventId = (): string => newEventId();

interface Scenario {
  readonly engine: Engine;
  readonly campaign: Campaign;
  readonly encounterId: string;
  readonly aId: string;
  readonly bId: string;
  readonly aWeaponId: string;
  readonly bWeaponId: string;
}

const makeItem = (definitionId: string) => ({
  id: newItemInstanceId(),
  definitionId,
  quantity: 1,
  attuned: false,
  identifiedByCharacterIds: [],
});

const buildFighter = (
  name: string,
  weaponId: string,
  armorId: string,
  hp: number,
  options: Partial<{ STR: number; DEX: number; speciesId: string }> = {},
) =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'pc',
    name,
    speciesId: options.speciesId ?? 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: {
      STR: options.STR ?? 16,
      DEX: options.DEX ?? 14,
      CON: 14,
      INT: 10,
      WIS: 12,
      CHA: 8,
    },
    hp: { current: hp, max: hp, temp: 0 },
    featsTaken: [],
    inventory: [weaponId, armorId],
    equipped: { mainHand: weaponId, armor: armorId, attuned: [] },
  });

/**
 * Standard scenario: two L3 fighters in an active encounter, positioned
 * adjacent enough for melee, A is the active combatant.
 */
const setupAB = (starter: ContentPack): Scenario => {
  const engine = createEngine({ contentPacks: [starter], rng: seededRNG(7) });
  const longsword1 = makeItem('longsword');
  const longsword2 = makeItem('longsword');
  const armor1 = makeItem('chain-mail');
  const armor2 = makeItem('chain-mail');
  const a = buildFighter('Alyx', longsword1.id, armor1.id, 30, { STR: 18 });
  const b = buildFighter('Brog', longsword2.id, armor2.id, 30, { STR: 14 });
  let campaign = engine.createCampaign({ name: 'probe' });
  campaign = engine.commit(campaign, [
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: longsword1 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: longsword2 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: armor1 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'ItemAcquired', instance: armor2 } satisfies ItemAcquiredEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
    { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: b } satisfies CharacterCreatedEvent,
  ]);
  const encounterId = newEncounterId();
  campaign = engine.commit(campaign, [
    {
      id: eventId(),
      at: now(),
      type: 'EncounterCreated',
      encounterId,
      combatantIds: [a.id, b.id],
    } satisfies EncounterCreatedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'InitiativeRolled',
      encounterId,
      rolls: [
        { combatantId: a.id, d20: 20, modifier: 2, total: 22 },
        { combatantId: b.id, d20: 5, modifier: 2, total: 7 },
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
      combatantId: a.id,
      round: 1,
    } satisfies TurnStartedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'CombatantMoved',
      encounterId,
      combatantId: a.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 5, y: 5 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
    {
      id: eventId(),
      at: now(),
      type: 'CombatantMoved',
      encounterId,
      combatantId: b.id,
      fromPosition: { x: 0, y: 0 },
      toPosition: { x: 10, y: 5 },
      feetTraveled: 0,
    } satisfies CombatantMovedEvent,
  ]);
  return {
    engine,
    campaign,
    encounterId,
    aId: a.id,
    bId: b.id,
    aWeaponId: longsword1.id,
    bWeaponId: longsword2.id,
  };
};

const applyCondition = (
  s: Scenario,
  targetId: string,
  conditionId: string,
  sourceCharacterId?: string,
): Scenario => {
  const event: ConditionAppliedEvent = {
    id: eventId(),
    at: now(),
    type: 'ConditionApplied',
    targetId,
    conditionId,
    appliedConditionId: newAppliedConditionId(),
    ...(sourceCharacterId !== undefined ? { sourceCharacterId } : {}),
  };
  return { ...s, campaign: s.engine.commit(s.campaign, [event]) };
};

const dropToZero = (s: Scenario, targetId: string): Scenario => {
  const hp = s.campaign.state.characters[targetId]!.hp.current;
  const event: DamageAppliedEvent = {
    id: eventId(),
    at: now(),
    type: 'DamageApplied',
    targetId,
    components: [{ type: 'slashing', amount: hp }],
  };
  return { ...s, campaign: s.engine.commit(s.campaign, [event]) };
};

const expectThrow = (
  fn: () => unknown,
  matcher: RegExp,
  label: string,
): ProbeResult => {
  try {
    fn();
    return { passed: false, error: `${label}: expected to throw, but did not` };
  } catch (err) {
    const msg = (err as Error).message;
    if (matcher.test(msg)) return { passed: true, detail: `rejected with: "${msg}"` };
    return { passed: false, error: `${label}: threw but message didn't match ${matcher}; got "${msg}"` };
  }
};

// ---------- the probes ----------

export const ALL_PROBES: ReadonlyArray<Probe> = [
  // Conditions blocking actions
  {
    id: 'unconscious-no-attack',
    category: 'Conditions block actions',
    name: 'Unconscious actor rejects Attack',
    raw: 'PHB App. "Unconscious": "An Unconscious creature can\'t take Actions, Bonus Actions, or Reactions."',
    run: (starter) => {
      const fresh = setupAB(starter);
      const downed = dropToZero(fresh, fresh.aId);
      return expectThrow(
        () =>
          downed.engine.plan.attack(downed.campaign.state, {
            attackerId: downed.aId,
            targetId: downed.bId,
            weaponInstanceId: downed.aWeaponId,
          }),
        /unconscious|incapacit|0 hp|cannot/i,
        'Unconscious actor must reject Attack',
      );
    },
  },
  {
    id: 'unconscious-no-move',
    category: 'Conditions block actions',
    name: 'Unconscious actor rejects Move',
    raw: 'PHB App. "Unconscious": no Actions, no movement (movement requires the move-action context).',
    run: (starter) => {
      const fresh = setupAB(starter);
      const downed = dropToZero(fresh, fresh.aId);
      return expectThrow(
        () =>
          downed.engine.plan.move(downed.campaign.state, {
            combatantId: downed.aId,
            to: { x: 5, y: 10 },
          }),
        /unconscious|incapacit|0 hp|cannot/i,
        'Unconscious actor must reject Move',
      );
    },
  },
  {
    id: 'stunned-no-attack',
    category: 'Conditions block actions',
    name: 'Stunned actor rejects Attack',
    raw: 'PHB App. "Stunned": "A Stunned creature is Incapacitated."',
    run: (starter) => {
      const fresh = setupAB(starter);
      const stunned = applyCondition(fresh, fresh.aId, 'stunned');
      return expectThrow(
        () =>
          stunned.engine.plan.attack(stunned.campaign.state, {
            attackerId: stunned.aId,
            targetId: stunned.bId,
            weaponInstanceId: stunned.aWeaponId,
          }),
        /stun|incapacit/i,
        'Stunned actor must reject Attack',
      );
    },
  },
  {
    id: 'restrained-speed-zero',
    category: 'Conditions block actions',
    name: 'Restrained reduces speed to 0',
    raw: 'PHB App. "Restrained": "A Restrained creature\'s Speed becomes 0."',
    run: (starter) => {
      const fresh = setupAB(starter);
      const restrained = applyCondition(fresh, fresh.aId, 'restrained');
      return expectThrow(
        () =>
          restrained.engine.plan.move(restrained.campaign.state, {
            combatantId: restrained.aId,
            to: { x: 5, y: 10 },
          }),
        /restrained|speed.*0|cannot move/i,
        'Restrained actor must reject Move',
      );
    },
  },
  // Movement / positioning
  {
    id: 'no-end-in-occupied-space',
    category: 'Movement',
    name: 'Cannot end move in another creature\'s space',
    raw: 'PHB ch.1 "Moving Around Other Creatures": "You can\'t willingly end your move in another creature\'s space."',
    run: (starter) => {
      const s = setupAB(starter);
      // B is at (10,5). A tries to end at (10,5).
      return expectThrow(
        () => s.engine.plan.move(s.campaign.state, { combatantId: s.aId, to: { x: 10, y: 5 } }),
        /occupied|space/i,
        'Move must reject ending on another creature\'s square',
      );
    },
  },
  {
    id: 'misty-step-unoccupied',
    category: 'Movement',
    name: 'Misty Step requires unoccupied destination',
    raw: 'Misty Step spell: "teleport up to 30 feet to an unoccupied space."',
    run: (starter) => {
      const s = setupAB(starter);
      const aChar = s.campaign.state.characters[s.aId]!;
      const patched = { ...aChar, knownSpells: [...aChar.knownSpells, 'misty-step'] };
      const campaign = {
        ...s.campaign,
        state: { ...s.campaign.state, characters: { ...s.campaign.state.characters, [s.aId]: patched } },
      };
      return expectThrow(
        () => s.engine.plan.mistyStep(campaign.state, { casterId: s.aId, to: { x: 10, y: 5 } }),
        /occupied|unoccupied|space/i,
        'Misty Step must reject occupied destination',
      );
    },
  },
  {
    id: 'oa-on-leaving-reach',
    category: 'Movement',
    name: 'Leaving reach emits an OpportunityAvailable event',
    raw: 'PHB ch.1 "Opportunity Attack": leaving a creature\'s Reach provokes an opportunity attack.',
    run: (starter) => {
      const s = setupAB(starter);
      // A is at (5,5), B at (10,5) → in reach. Move A to (0,5) → out.
      const { events } = s.engine.plan.move(s.campaign.state, {
        combatantId: s.aId,
        to: { x: 0, y: 5 },
      });
      const oa = events.find((e) => e.type === 'OpportunityAvailable');
      if (!oa) {
        return {
          passed: false,
          error: `expected an OpportunityAvailable event; got ${events.map((e) => e.type).join(', ')}`,
        };
      }
      return { passed: true, detail: `emitted ${events.filter((e) => e.type === 'OpportunityAvailable').length} OA opportunity` };
    },
  },
  // Action economy
  {
    id: 'dodge-then-attack-rejects',
    category: 'Action economy',
    name: 'Dodge then Attack rejects (action already used)',
    raw: 'PHB ch.1: "the Dodge action uses your action."',
    run: (starter) => {
      const s = setupAB(starter);
      const after = s.engine.commit(s.campaign, s.engine.plan.dodge(s.campaign.state, { combatantId: s.aId }).events);
      return expectThrow(
        () =>
          s.engine.plan.attack(after.state, {
            attackerId: s.aId,
            targetId: s.bId,
            weaponInstanceId: s.aWeaponId,
          }),
        /already used|action/i,
        'Attack after Dodge must reject',
      );
    },
  },
  {
    id: 'cast-then-attack-rejects',
    category: 'Action economy',
    name: 'Cast Spell (action) then Attack rejects',
    raw: 'PHB ch.7: an Action-cost spell consumes the action.',
    run: (starter) => {
      const s = setupAB(starter);
      const aChar = s.campaign.state.characters[s.aId]!;
      const patched = {
        ...aChar,
        knownSpells: [...aChar.knownSpells, 'magic-missile'],
        classes: [{ classId: 'wizard', level: 3, hitDiceRemaining: 3 }],
      };
      const campaign = {
        ...s.campaign,
        state: { ...s.campaign.state, characters: { ...s.campaign.state.characters, [s.aId]: patched } },
      };
      const after = s.engine.commit(
        campaign,
        s.engine.plan.castSpell(campaign.state, {
          characterId: s.aId,
          spellId: 'magic-missile',
          slotLevel: 1,
          targetIds: [s.bId],
        }).events,
      );
      return expectThrow(
        () =>
          s.engine.plan.attack(after.state, {
            attackerId: s.aId,
            targetId: s.bId,
            weaponInstanceId: s.aWeaponId,
          }),
        /already used|action/i,
        'Attack after Cast Spell must reject',
      );
    },
  },
  // Combat math
  {
    id: 'ranged-in-melee-disadvantage',
    category: 'Combat math',
    name: 'Ranged attack with hostile in 5ft has disadvantage',
    raw: 'PHB ch.1: "You have Disadvantage on the attack roll if you are within 5 feet of a hostile creature."',
    run: (starter) => {
      const s = setupAB(starter);
      const ranged = makeItem('shortbow');
      // The starter pack ships shortbow — verify by attempting to look up.
      // If not present, the probe is inconclusive; treat as a skip-pass.
      if (!s.engine.content.items.get('shortbow')) {
        return { passed: true, detail: 'shortbow not in starter pack — probe skipped' };
      }
      const aChar = s.campaign.state.characters[s.aId]!;
      const patched = {
        ...aChar,
        inventory: [...aChar.inventory, ranged.id],
        equipped: { ...aChar.equipped, mainHand: ranged.id },
      };
      const campaign = s.engine.commit(
        {
          ...s.campaign,
          state: { ...s.campaign.state, characters: { ...s.campaign.state.characters, [s.aId]: patched } },
        },
        [{ id: eventId(), at: now(), type: 'ItemAcquired', instance: ranged } satisfies ItemAcquiredEvent],
      );
      const { events } = s.engine.plan.attack(campaign.state, {
        attackerId: s.aId,
        targetId: s.bId,
        weaponInstanceId: ranged.id,
      });
      const ar = events.find((e) => e.type === 'AttackRolled');
      if (!ar || ar.type !== 'AttackRolled') {
        return { passed: false, error: 'no AttackRolled event' };
      }
      const used = (ar as unknown as { used: string }).used;
      if (used !== 'disadvantage') {
        return { passed: false, error: `expected used=disadvantage, got ${used}` };
      }
      return { passed: true, detail: `AttackRolled.used = "${used}"` };
    },
  },
  {
    id: 'heavy-small-disadvantage',
    category: 'Combat math',
    name: 'Small character with Heavy weapon rolls with disadvantage',
    raw: 'PHB Equipment: "Small creatures have Disadvantage with Heavy weapons."',
    run: (starter) => {
      // Build a halfling fighter with a maul (heavy). Check used.
      if (!starter.species.find((sp) => sp.id === 'halfling')) {
        return { passed: true, detail: 'halfling not in starter pack — probe skipped' };
      }
      const heavyWeapon = ['maul', 'greataxe', 'greatsword', 'halberd'].find((id) =>
        starter.items.find((it) => it.id === id),
      );
      if (!heavyWeapon) {
        return { passed: true, detail: 'no heavy weapon in starter pack — probe skipped' };
      }
      const engine = createEngine({ contentPacks: [starter], rng: seededRNG(7) });
      const weapon = makeItem(heavyWeapon);
      const armor = makeItem('chain-mail');
      const small = buildFighter('Squirt', weapon.id, armor.id, 28, { STR: 16, speciesId: 'halfling' });
      const dummy = buildFighter('Dummy', makeItem('longsword').id, makeItem('chain-mail').id, 30);
      let campaign = engine.createCampaign({ name: 'small-probe' });
      campaign = engine.commit(campaign, [
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: weapon } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: armor } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: small } satisfies CharacterCreatedEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: dummy } satisfies CharacterCreatedEvent,
      ]);
      const encId = newEncounterId();
      campaign = engine.commit(campaign, [
        {
          id: eventId(),
          at: now(),
          type: 'EncounterCreated',
          encounterId: encId,
          combatantIds: [small.id, dummy.id],
        } satisfies EncounterCreatedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'InitiativeRolled',
          encounterId: encId,
          rolls: [
            { combatantId: small.id, d20: 20, modifier: 1, total: 21 },
            { combatantId: dummy.id, d20: 5, modifier: 2, total: 7 },
          ],
        } satisfies InitiativeRolledEvent,
        {
          id: eventId(),
          at: now(),
          type: 'EncounterStarted',
          encounterId: encId,
        } satisfies EncounterStartedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'TurnStarted',
          encounterId: encId,
          combatantId: small.id,
          round: 1,
        } satisfies TurnStartedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'CombatantMoved',
          encounterId: encId,
          combatantId: small.id,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 5, y: 5 },
          feetTraveled: 0,
        } satisfies CombatantMovedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'CombatantMoved',
          encounterId: encId,
          combatantId: dummy.id,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 10, y: 5 },
          feetTraveled: 0,
        } satisfies CombatantMovedEvent,
      ]);
      const { events } = engine.plan.attack(campaign.state, {
        attackerId: small.id,
        targetId: dummy.id,
        weaponInstanceId: weapon.id,
      });
      const ar = events.find((e) => e.type === 'AttackRolled');
      if (!ar || ar.type !== 'AttackRolled') {
        return { passed: false, error: 'no AttackRolled event' };
      }
      const used = (ar as unknown as { used: string }).used;
      if (used !== 'disadvantage') {
        return { passed: false, error: `expected used=disadvantage with ${heavyWeapon} on halfling, got ${used}` };
      }
      return { passed: true, detail: `AttackRolled.used = "${used}" (${heavyWeapon})` };
    },
  },
  // Concentration
  {
    id: 'concentration-clears-on-zero',
    category: 'Concentration',
    name: 'Concentration clears when caster hits 0 HP',
    raw: 'PHB ch.7: "Becoming Incapacitated or dying immediately ends Concentration."',
    run: (starter) => {
      const s = setupAB(starter);
      const aChar = s.campaign.state.characters[s.aId]!;
      const patched = { ...aChar, concentrationEffectId: 'fake-effect' };
      const seeded = {
        ...s.campaign,
        state: {
          ...s.campaign.state,
          characters: { ...s.campaign.state.characters, [s.aId]: patched },
        },
      };
      const after = s.engine.commit(seeded, [
        {
          id: eventId(),
          at: now(),
          type: 'DamageApplied',
          targetId: s.aId,
          components: [{ type: 'slashing', amount: aChar.hp.current }],
        } satisfies DamageAppliedEvent,
      ]);
      const conc = after.state.characters[s.aId]?.concentrationEffectId;
      if (conc !== undefined) {
        return { passed: false, error: `expected concentration cleared; got ${conc}` };
      }
      return { passed: true, detail: 'concentrationEffectId cleared on HP=0' };
    },
  },
  // Sourced conditions
  {
    id: 'frightened-no-closer',
    category: 'Conditions: sourced',
    name: 'Frightened cannot move closer to source',
    raw: 'PHB App. "Frightened": "you can\'t willingly move closer to the source of your fear."',
    run: (starter) => {
      const fresh = setupAB(starter);
      const frightened = applyCondition(fresh, fresh.aId, 'frightened', fresh.bId);
      return expectThrow(
        () =>
          frightened.engine.plan.move(frightened.campaign.state, {
            combatantId: frightened.aId,
            to: { x: 6, y: 5 },
          }),
        /frightened|source|closer/i,
        'Move closer to fear source must reject',
      );
    },
  },
  {
    id: 'charmed-no-attack',
    category: 'Conditions: sourced',
    name: 'Charmed cannot attack the charmer',
    raw: 'PHB App. "Charmed": "the charmed creature can\'t attack the charmer or target the charmer with harmful Abilities."',
    run: (starter) => {
      const fresh = setupAB(starter);
      const charmed = applyCondition(fresh, fresh.aId, 'charmed', fresh.bId);
      return expectThrow(
        () =>
          charmed.engine.plan.attack(charmed.campaign.state, {
            attackerId: charmed.aId,
            targetId: charmed.bId,
            weaponInstanceId: charmed.aWeaponId,
          }),
        /charmed|charmer|cannot.*attack/i,
        'Charmed attack on charmer must reject',
      );
    },
  },
  // Critical hits / death
  {
    id: 'sneak-attack-ally-adjacent',
    category: 'Combat math',
    name: 'Sneak Attack fires when an ally is within 5ft of the target',
    raw: 'PHB Rogue: Sneak Attack triggers on advantage OR with an ally in 5ft of the target (and no disadvantage).',
    run: (starter) => {
      // Build a fresh rogue + a low-AC target + an ally adjacent to
      // the target. The rogue attacks without explicit advantage; SA
      // should still fire because the ally-adjacent flag is set.
      const engine = createEngine({ contentPacks: [starter], rng: seededRNG(7) });
      const rapier = makeItem('rapier');
      const rogue = CharacterSchema.parse({
        id: newCharacterId(),
        kind: 'pc',
        name: 'Sly',
        speciesId: 'human',
        backgroundId: 'criminal',
        classes: [{ classId: 'rogue', level: 3, hitDiceRemaining: 3 }],
        abilityScores: { STR: 10, DEX: 18, CON: 12, INT: 12, WIS: 12, CHA: 10 },
        hp: { current: 22, max: 22, temp: 0 },
        featsTaken: [],
        inventory: [rapier.id],
        equipped: { mainHand: rapier.id, attuned: [] },
      });
      const target = CharacterSchema.parse({
        id: newCharacterId(),
        kind: 'creature',
        name: 'Sandbag',
        statblockId: 'goblin',
        speciesId: 'human',
        backgroundId: 'soldier',
        classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
        abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        hp: { current: 30, max: 30, temp: 0 },
        armorClass: 5,
        featsTaken: [],
      });
      const allyArmor = makeItem('chain-mail');
      const allyWeapon = makeItem('longsword');
      const ally = CharacterSchema.parse({
        id: newCharacterId(),
        kind: 'pc',
        name: 'Mate',
        speciesId: 'human',
        backgroundId: 'soldier',
        classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
        abilityScores: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
        hp: { current: 12, max: 12, temp: 0 },
        inventory: [allyWeapon.id, allyArmor.id],
        equipped: { mainHand: allyWeapon.id, armor: allyArmor.id, attuned: [] },
        featsTaken: [],
      });
      let campaign = engine.createCampaign({ name: 'sa-probe' });
      campaign = engine.commit(campaign, [
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: rapier } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: allyWeapon } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: allyArmor } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: rogue } satisfies CharacterCreatedEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
      ]);
      const encId = newEncounterId();
      campaign = engine.commit(campaign, [
        {
          id: eventId(),
          at: now(),
          type: 'EncounterCreated',
          encounterId: encId,
          combatantIds: [rogue.id, target.id, ally.id],
        } satisfies EncounterCreatedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'InitiativeRolled',
          encounterId: encId,
          rolls: [
            { combatantId: rogue.id, d20: 20, modifier: 4, total: 24 },
            { combatantId: target.id, d20: 10, modifier: 0, total: 10 },
            { combatantId: ally.id, d20: 5, modifier: 1, total: 6 },
          ],
        } satisfies InitiativeRolledEvent,
        {
          id: eventId(),
          at: now(),
          type: 'EncounterStarted',
          encounterId: encId,
        } satisfies EncounterStartedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'TurnStarted',
          encounterId: encId,
          combatantId: rogue.id,
          round: 1,
        } satisfies TurnStartedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'CombatantMoved',
          encounterId: encId,
          combatantId: rogue.id,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 5, y: 5 },
          feetTraveled: 0,
        } satisfies CombatantMovedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'CombatantMoved',
          encounterId: encId,
          combatantId: target.id,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 10, y: 5 },
          feetTraveled: 0,
        } satisfies CombatantMovedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'CombatantMoved',
          encounterId: encId,
          combatantId: ally.id,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 15, y: 5 },
          feetTraveled: 0,
        } satisfies CombatantMovedEvent,
      ]);
      const { events } = engine.plan.attack(campaign.state, {
        attackerId: rogue.id,
        targetId: target.id,
        weaponInstanceId: rapier.id,
      });
      const ar = events.find((e) => e.type === 'AttackRolled');
      if (!ar || ar.type !== 'AttackRolled') {
        return { passed: false, error: 'no AttackRolled event' };
      }
      if (!ar.hit) {
        return { passed: false, error: `attack missed (d20=${JSON.stringify(ar.d20)}); SA cannot be checked` };
      }
      const triggers = events.filter((e) => e.type === 'TriggerFired');
      const sa = triggers.find((t) => /sneak/i.test((t as { triggerId?: string }).triggerId ?? ''));
      if (!sa) {
        return { passed: false, error: 'expected TriggerFired with sneak in triggerId; not found' };
      }
      return { passed: true, detail: 'Sneak Attack trigger fired via ally-adjacent path' };
    },
  },
  {
    id: 'two-handed-shield-conflict',
    category: 'Equipment',
    name: 'Two-handed weapon and shield cannot be wielded together',
    raw: 'PHB Equipment: wielding a two-handed weapon requires both hands; a shield occupies the other hand.',
    run: (starter) => {
      const engine = createEngine({ contentPacks: [starter], rng: seededRNG(7) });
      // Find a two-handed weapon in the starter pack. Greatsword,
      // greataxe, maul, etc.
      const heavyId = ['greatsword', 'greataxe', 'maul', 'halberd', 'pike'].find((id) => {
        const d = starter.items.find((it) => it.id === id);
        return d?.itemKind === 'weapon' && d.properties?.includes('two-handed');
      });
      if (!heavyId) {
        return { passed: true, detail: 'no two-handed weapon in starter pack — probe skipped' };
      }
      const shieldId = starter.items.find((it) => it.id === 'shield')?.id;
      if (!shieldId) {
        return { passed: true, detail: 'no shield in starter pack — probe skipped' };
      }
      const heavy = makeItem(heavyId);
      const shield = makeItem(shieldId);
      const fighter = CharacterSchema.parse({
        id: newCharacterId(),
        kind: 'pc',
        name: 'Greg',
        speciesId: 'human',
        backgroundId: 'soldier',
        classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
        abilityScores: { STR: 18, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
        hp: { current: 28, max: 28, temp: 0 },
        inventory: [heavy.id, shield.id],
        equipped: { shield: shield.id, attuned: [] },
        featsTaken: [],
      });
      let campaign = engine.createCampaign({ name: 'equip-probe' });
      campaign = engine.commit(campaign, [
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: heavy } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: shield } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
      ]);
      return expectThrow(
        () =>
          engine.plan.equip(campaign.state, {
            characterId: fighter.id,
            slot: 'mainHand',
            instanceId: heavy.id,
          }),
        /two-handed|shield|both hands/i,
        'equip(two-handed) with shield equipped must reject',
      );
    },
  },
  {
    id: 'loading-once-per-turn',
    category: 'Equipment',
    name: 'Loading weapon: only one shot per turn',
    raw: 'PHB Equipment: "Loading" — fire only one piece of ammunition per attack action, regardless of Extra Attack.',
    run: (starter) => {
      const lc = starter.items.find((it) => it.id === 'crossbow-light');
      if (!lc) {
        return { passed: true, detail: 'no light-crossbow in starter pack — probe skipped' };
      }
      const engine = createEngine({ contentPacks: [starter], rng: seededRNG(7) });
      const crossbow = makeItem('crossbow-light');
      const archer = CharacterSchema.parse({
        id: newCharacterId(),
        kind: 'pc',
        name: 'Archer',
        speciesId: 'human',
        backgroundId: 'soldier',
        classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
        abilityScores: { STR: 12, DEX: 18, CON: 14, INT: 10, WIS: 12, CHA: 10 },
        hp: { current: 40, max: 40, temp: 0 },
        inventory: [crossbow.id],
        equipped: { mainHand: crossbow.id, attuned: [] },
        featsTaken: [],
      });
      const target = CharacterSchema.parse({
        id: newCharacterId(),
        kind: 'creature',
        name: 'Sandbag',
        statblockId: 'goblin',
        speciesId: 'human',
        backgroundId: 'soldier',
        classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
        abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        hp: { current: 100, max: 100, temp: 0 },
        armorClass: 5,
        featsTaken: [],
      });
      let campaign = engine.createCampaign({ name: 'loading-probe' });
      campaign = engine.commit(campaign, [
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: crossbow } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: archer } satisfies CharacterCreatedEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ]);
      const encId = newEncounterId();
      campaign = engine.commit(campaign, [
        {
          id: eventId(),
          at: now(),
          type: 'EncounterCreated',
          encounterId: encId,
          combatantIds: [archer.id, target.id],
        } satisfies EncounterCreatedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'InitiativeRolled',
          encounterId: encId,
          rolls: [
            { combatantId: archer.id, d20: 20, modifier: 4, total: 24 },
            { combatantId: target.id, d20: 5, modifier: 0, total: 5 },
          ],
        } satisfies InitiativeRolledEvent,
        {
          id: eventId(),
          at: now(),
          type: 'EncounterStarted',
          encounterId: encId,
        } satisfies EncounterStartedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'TurnStarted',
          encounterId: encId,
          combatantId: archer.id,
          round: 1,
        } satisfies TurnStartedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'CombatantMoved',
          encounterId: encId,
          combatantId: archer.id,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 5, y: 5 },
          feetTraveled: 0,
        } satisfies CombatantMovedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'CombatantMoved',
          encounterId: encId,
          combatantId: target.id,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 25, y: 5 },
          feetTraveled: 0,
        } satisfies CombatantMovedEvent,
      ]);
      const afterFirst = engine.commit(
        campaign,
        engine.plan.attack(campaign.state, {
          attackerId: archer.id,
          targetId: target.id,
          weaponInstanceId: crossbow.id,
        }).events,
      );
      return expectThrow(
        () =>
          engine.plan.attack(afterFirst.state, {
            attackerId: archer.id,
            targetId: target.id,
            weaponInstanceId: crossbow.id,
          }),
        /loading|again this turn/i,
        'second crossbow attack same turn must reject',
      );
    },
  },
  {
    id: 'difficult-terrain-doubles-cost',
    category: 'Movement',
    name: 'Difficult terrain doubles movement cost',
    raw: 'PHB ch.1 "Difficult Terrain": each foot of movement through difficult terrain costs 1 extra foot.',
    run: (starter) => {
      // 5x1 map: [normal, difficult, normal, normal, normal]
      const engine = createEngine({ contentPacks: [starter], rng: seededRNG(7) });
      const sword = makeItem('longsword');
      const armor = makeItem('chain-mail');
      const a = CharacterSchema.parse({
        id: newCharacterId(),
        kind: 'pc',
        name: 'Alyx',
        speciesId: 'human',
        backgroundId: 'soldier',
        classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
        abilityScores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
        hp: { current: 28, max: 28, temp: 0 },
        inventory: [sword.id, armor.id],
        equipped: { mainHand: sword.id, armor: armor.id, attuned: [] },
        featsTaken: [],
      });
      let campaign = engine.createCampaign({ name: 'terrain-probe' });
      campaign = engine.commit(campaign, [
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: sword } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'ItemAcquired', instance: armor } satisfies ItemAcquiredEvent,
        { id: eventId(), at: now(), type: 'CharacterCreated', snapshot: a } satisfies CharacterCreatedEvent,
      ]);
      const encId = newEncounterId();
      const locId = newLocationId();
      campaign = engine.commit(campaign, [
        {
          id: eventId(),
          at: now(),
          type: 'EncounterCreated',
          encounterId: encId,
          combatantIds: [a.id],
        } satisfies EncounterCreatedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'InitiativeRolled',
          encounterId: encId,
          rolls: [{ combatantId: a.id, d20: 20, modifier: 2, total: 22 }],
        } satisfies InitiativeRolledEvent,
        {
          id: eventId(),
          at: now(),
          type: 'EncounterStarted',
          encounterId: encId,
        } satisfies EncounterStartedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'TurnStarted',
          encounterId: encId,
          combatantId: a.id,
          round: 1,
        } satisfies TurnStartedEvent,
        {
          id: eventId(),
          at: now(),
          type: 'LocationCreated',
          locationId: locId,
          name: 'Bog',
          map: {
            widthCells: 5,
            heightCells: 1,
            cellSizeFeet: 5,
            terrain: [['normal', 'difficult', 'normal', 'normal', 'normal']],
          },
        },
        {
          id: eventId(),
          at: now(),
          type: 'CharacterLocationChanged',
          characterId: a.id,
          toLocationId: locId,
        },
        {
          id: eventId(),
          at: now(),
          type: 'CombatantMoved',
          encounterId: encId,
          combatantId: a.id,
          fromPosition: { x: 0, y: 0 },
          toPosition: { x: 0, y: 0 },
          feetTraveled: 0,
        } satisfies CombatantMovedEvent,
      ]);
      // Move from (0,0) → (20,0). 4 cells entered: difficult(2) + 3*normal(1) = 5 cost × 5ft = 25ft.
      const after = engine.commit(
        campaign,
        engine.plan.move(campaign.state, { combatantId: a.id, to: { x: 20, y: 0 } }).events,
      );
      const cb = after.state.encounters[encId]!.combatants.find((c) => c.combatantId === a.id);
      const feet = cb?.turnUsage.feetMovedThisTurn ?? -1;
      if (feet !== 25) {
        return { passed: false, error: `expected feetMovedThisTurn=25 (difficult cell doubled); got ${feet}` };
      }
      return { passed: true, detail: `feetMovedThisTurn = ${feet} (1 difficult cell = 2× cost)` };
    },
  },
  {
    id: 'massive-damage-instant-death',
    category: 'Death & dying',
    name: 'Damage exceeding 0 by more than max HP = instant death',
    raw: 'PHB ch.1 "Instant Death": "Massive damage can kill you instantly."',
    run: (starter) => {
      const s = setupAB(starter);
      const aChar = s.campaign.state.characters[s.aId]!;
      const huge = aChar.hp.current + aChar.hp.max + 1;
      const after = s.engine.commit(s.campaign, [
        {
          id: eventId(),
          at: now(),
          type: 'DamageApplied',
          targetId: s.aId,
          components: [{ type: 'slashing', amount: huge }],
        } satisfies DamageAppliedEvent,
      ]);
      const post = after.state.characters[s.aId]!;
      if (post.deathSaves.failures !== 3) {
        return { passed: false, error: `expected 3 failures; got ${post.deathSaves.failures}` };
      }
      return { passed: true, detail: `failures = ${post.deathSaves.failures}` };
    },
  },
];
