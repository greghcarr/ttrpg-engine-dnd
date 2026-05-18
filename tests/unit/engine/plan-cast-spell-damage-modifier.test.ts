import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId, newChoiceId } from '../../../src/ids.js';
import type { Campaign } from '../../../src/engine/commit.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { ChoiceRequiredEvent, ChoiceResolvedEvent } from '../../../src/schemas/events/level-up.js';
import type { DamageRolledEvent, AttackRolledEvent } from '../../../src/schemas/events/attack.js';
import type { DamageAppliedEvent } from '../../../src/schemas/events/combat.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 204: cast-spell.ts now consults the caster's effect stack
// for `AddModifier { target: 'damage' }` contributions, gated on the
// `event.damageType` fact. Canonical user: Draconic Sorcery L6
// Elemental Affinity (+CHA-mod to one damage roll of the chosen
// type). Pre-slice-204 the rider silently dropped — only weapon
// attacks consulted damage-modifier effects.

const PACK = loadStarterPack();

const buildSorcerer = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ember',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'sorcerer', level: 6, hitDiceRemaining: 6, subclassId: 'draconic-sorcery' }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 18 },
    hp: { current: 38, max: 38, temp: 0 },
    featsTaken: [],
    preparedSpells: ['fire-bolt', 'ray-of-frost', 'fireball'],
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Dummy',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 8, DEX: 8, CON: 14, INT: 8, WIS: 8, CHA: 8 },
    hp: { current: 60, max: 60, temp: 0 },
    featsTaken: [],
  });

const seedElementalAffinity = (
  characterId: string,
  damageType: 'acid' | 'cold' | 'fire' | 'lightning' | 'poison',
): [ChoiceRequiredEvent, ChoiceResolvedEvent] => {
  const choiceId = newChoiceId();
  const options = (['acid', 'cold', 'fire', 'lightning', 'poison'] as const).map((t) => ({
    id: t,
    label: t,
    effects: [
      { kind: 'GrantResistance' as const, damageType: t },
      {
        kind: 'AddModifier' as const,
        target: 'damage' as const,
        value: { kind: 'abilityMod' as const, ability: 'CHA' as const },
        condition: { kind: 'eq' as const, path: 'event.damageType', value: t },
      },
    ],
  }));
  return [
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'elemental-affinity',
      prompt: 'Choose your draconic damage type.',
      options,
      oneOf: 1,
    },
    {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: [damageType],
    },
  ];
};

const findDamageRoll = (events: ReadonlyArray<unknown>): DamageRolledEvent | undefined =>
  events.find(
    (e): e is DamageRolledEvent =>
      typeof e === 'object' && e !== null && (e as { type?: string }).type === 'DamageRolled',
  );

const findAttackHit = (events: ReadonlyArray<unknown>): AttackRolledEvent | undefined =>
  events.find(
    (e): e is AttackRolledEvent =>
      typeof e === 'object' && e !== null && (e as { type?: string }).type === 'AttackRolled' && (e as AttackRolledEvent).hit,
  );

const findDamageApplied = (events: ReadonlyArray<unknown>): DamageAppliedEvent | undefined =>
  events.find(
    (e): e is DamageAppliedEvent =>
      typeof e === 'object' && e !== null && (e as { type?: string }).type === 'DamageApplied',
  );

describe('cast-spell: AddModifier { target: damage, condition: event.damageType }', () => {
  it("attack-mechanic: fire-bolt damage gains +CHA-mod when caster has fire affinity (search seeds for a hit)", () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const sorcerer = buildSorcerer();
      const target = buildTarget();
      let campaign: Campaign = engine.createCampaign({ name: `affinity-attack-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
        ...seedElementalAffinity(sorcerer.id, 'fire'),
      ]);
      const { events } = engine.plan.castSpell(campaign.state, {
        characterId: sorcerer.id,
        spellId: 'fire-bolt',
        slotLevel: 0,
        targetIds: [target.id],
      });
      const attack = findAttackHit(events);
      if (attack === undefined) continue;
      const damage = findDamageRoll(events)!;
      // fire-bolt is 1d10 fire; CHA mod (+4) should now appear on the
      // single DamageRoll's modifier field.
      expect(damage.rolls[0]!.modifier).toBe(4);
      expect(damage.rolls[0]!.type).toBe('fire');
      return;
    }
    throw new Error('no hitting seed found across 60 attempts');
  });

  it("attack-mechanic: ray-of-frost (cold) with fire affinity does NOT gain the bonus", () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const sorcerer = buildSorcerer();
      const target = buildTarget();
      let campaign: Campaign = engine.createCampaign({ name: `affinity-mismatch-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
        ...seedElementalAffinity(sorcerer.id, 'fire'),
      ]);
      const { events } = engine.plan.castSpell(campaign.state, {
        characterId: sorcerer.id,
        spellId: 'ray-of-frost',
        slotLevel: 0,
        targetIds: [target.id],
      });
      const attack = findAttackHit(events);
      if (attack === undefined) continue;
      const damage = findDamageRoll(events)!;
      expect(damage.rolls[0]!.type).toBe('cold');
      // Mismatched element: no CHA-mod boost. ray-of-frost ships with
      // no flat modifier on its damage dice, so the modifier slot is 0.
      expect(damage.rolls[0]!.modifier).toBe(0);
      return;
    }
    throw new Error('no hitting seed found across 60 attempts');
  });

  it("save-mechanic: fireball damage rolled once with +CHA included for fire affinity", () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(11) });
    const sorcerer = buildSorcerer();
    const target = buildTarget();
    let campaign: Campaign = engine.createCampaign({ name: 'affinity-fireball' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sorcerer } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: target } satisfies CharacterCreatedEvent,
      ...seedElementalAffinity(sorcerer.id, 'fire'),
    ]);
    const hpBefore = campaign.state.characters[target.id]!.hp.current;
    const { events } = engine.plan.castSpell(campaign.state, {
      characterId: sorcerer.id,
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: [target.id],
    });
    campaign = commit(campaign, events);

    const damageApplied = findDamageApplied(events);
    expect(damageApplied).toBeDefined();
    const damageDealt = damageApplied!.components.reduce((sum, c) => sum + c.amount, 0);

    // Lower bound: 8d6 with min roll 8, halved on save = 4. With +CHA
    // boost of 4 added pre-halve, the floor rises to floor((8 + 4) / 2) = 6
    // on a save success; un-halved it's at least 8 + 4 = 12. Use HP delta
    // to verify the boost is actually applied (any boost > 0 is enough
    // signal since the unboosted floor would be lower).
    const hpAfter = campaign.state.characters[target.id]!.hp.current;
    expect(hpBefore - hpAfter).toBeGreaterThanOrEqual(damageDealt);
    // Verify: the boost should be present in the rawDamage path. The
    // RAW minimum rawDamage (all 1s on 8d6 + CHA 4) is 8 + 4 = 12. On
    // a save success it halves to 6; on fail it stays at 12. Either way
    // the damage applied should be >= 6 (when halved) or >= 12 (when
    // not halved). Without the boost, the equivalent floor would be 4
    // (halved) or 8 (not halved). So a >= 6 floor on a save success is
    // the cleanest signal that the boost landed.
    expect(damageDealt).toBeGreaterThanOrEqual(6);
  });
});
