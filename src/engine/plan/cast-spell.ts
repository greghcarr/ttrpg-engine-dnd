import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type {
  PactSlotConsumedEvent,
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
  SpellSlotSource,
} from '../../schemas/events/spellcasting.js';
import type {
  AttackRolledEvent,
  DamageRolledEvent,
  DamageRoll,
} from '../../schemas/events/attack.js';
import type {
  DamageAppliedEvent,
  ConditionAppliedEvent,
  HealedEvent,
} from '../../schemas/events/combat.js';
import type { SaveRolledEvent } from '../../schemas/events/checks.js';
import type {
  ConcentrationBrokenEvent,
  ConcentrationStartedEvent,
} from '../../schemas/events/concentration.js';
import type { Spell, SpellMechanic } from '../../schemas/content/spell.js';
import { cantripExtraDice } from '../../schemas/content/spell.js';
import type { Character } from '../../schemas/runtime/character.js';
import { computeTotalLevel } from '../../schemas/runtime/character.js';
import type { AppliedConditionRef } from '../../schemas/runtime/effect-instance.js';
import type { RNG } from '../../rng/index.js';
import { rollDie, parseDiceExpression } from '../../rng/dice.js';
import { newAppliedConditionId, newEffectInstanceId, newEventId } from '../../ids.js';
import { computeSpellSaveDC, computeSpellAttackBonus } from '../../derive/spell-dc.js';
import { computeAvailableSpellSlots } from '../../derive/spell-slots.js';
import { computeAC } from '../../derive/ac.js';
import { computeSavingThrow } from '../../derive/save.js';
import { abilityModifier } from '../../derive/ability.js';
import { mitigateDamage } from '../../derive/damage-mitigation.js';
import {
  CANTRIP_LEVEL,
  D20_SIDES,
  NAT_1,
  NAT_20,
} from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

export interface CastSpellIntent {
  readonly type: 'CastSpell';
  readonly characterId: string;
  readonly spellId: string;
  readonly slotLevel: number;
  readonly slotSource?: SpellSlotSource;
  readonly targetIds: ReadonlyArray<string>;
  readonly castingClassId?: string;
  readonly asRitual?: boolean;
  readonly at?: string;
}

const findCastingClass = (
  character: Character,
  content: ResolvedContent,
  preferred?: string,
): string => {
  if (preferred !== undefined) return preferred;
  for (const enrollment of character.classes) {
    const cls = content.classes.get(enrollment.classId);
    if (cls?.spellcasting !== undefined) return enrollment.classId;
  }
  throw new Error(`Character has no spellcasting class`);
};

const characterKnowsSpell = (character: Character, spellId: string): boolean =>
  character.knownSpells.includes(spellId) || character.preparedSpells.includes(spellId);

const chooseSlotSource = (
  spell: Spell,
  intent: CastSpellIntent,
  state: CampaignState,
  content: ResolvedContent,
): SpellSlotSource => {
  if (intent.slotSource !== undefined) return intent.slotSource;
  if (spell.level === CANTRIP_LEVEL) return 'standard';
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  const available = computeAvailableSpellSlots(character, content.classes);
  if (
    available.pact !== undefined &&
    available.pact.count > 0 &&
    intent.slotLevel <= available.pact.level
  ) {
    return 'pact';
  }
  return 'standard';
};

const rollDamage = (
  baseExpression: string,
  bonusDice: number,
  rng: RNG,
  doubleDice: boolean,
): { rolls: number[]; modifier: number } => {
  const parsed = parseDiceExpression(baseExpression);
  const totalDieCount = (parsed.count + bonusDice) * (doubleDice ? 2 : 1);
  const rolls: number[] = [];
  for (let i = 0; i < totalDieCount; i++) {
    rolls.push(rollDie(parsed.die, rng));
  }
  return { rolls, modifier: parsed.modifier };
};

const rollCantripScaling = (
  scalingExpression: string | undefined,
  extraSteps: number,
  rng: RNG,
  doubleDice: boolean,
): number[] => {
  if (scalingExpression === undefined || extraSteps <= 0) return [];
  const parsed = parseDiceExpression(scalingExpression);
  const dieCount = parsed.count * extraSteps * (doubleDice ? 2 : 1);
  const rolls: number[] = [];
  for (let i = 0; i < dieCount; i++) {
    rolls.push(rollDie(parsed.die, rng));
  }
  return rolls;
};

const halveDamage = (totalDamage: number): number => Math.floor(totalDamage / 2);

const planAttackMechanic = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: CastSpellIntent,
  spell: Spell,
  mechanic: Extract<SpellMechanic, { kind: 'attack' }>,
  declaredEventId: string,
  at: string,
  castingClassId: string,
): Event[] => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  const attackBonus = computeSpellAttackBonus({
    character,
    itemInstances: state.itemInstances,
    content,
    classId: castingClassId,
  });
  const bonusDice = (mechanic.extraDicePerSlotLevel ?? 0) * Math.max(0, intent.slotLevel - spell.level);
  const cantripSteps = spell.level === CANTRIP_LEVEL ? cantripExtraDice(computeTotalLevel(character)) : 0;
  const events: Event[] = [];
  for (const targetId of intent.targetIds) {
    const target = state.characters[targetId];
    if (!target) continue;
    const targetAC = computeAC({
      character: target,
      itemInstances: state.itemInstances,
      content,
    });
    const d20 = rollDie(D20_SIDES, rng);
    const total = d20 + attackBonus.total;
    const isCrit = d20 === NAT_20;
    const isMiss = d20 === NAT_1;
    const hit = !isMiss && (isCrit || total >= targetAC.total);

    const attackEvent: AttackRolledEvent = {
      id: newEventId() as ULID,
      at,
      type: 'AttackRolled',
      attackerId: intent.characterId,
      targetId,
      weaponInstanceId: intent.spellId as ULID,
      d20: [d20],
      used: 'none',
      attackBonus: attackBonus.total,
      total,
      targetAC: targetAC.total,
      hit,
      critical: isCrit,
      causedByEventId: declaredEventId as ULID,
    };
    events.push(attackEvent);

    if (!hit) continue;

    const { rolls: baseRolls, modifier } = rollDamage(mechanic.damageDice, bonusDice, rng, isCrit);
    const scalingRolls = rollCantripScaling(mechanic.cantripScalingDice, cantripSteps, rng, isCrit);
    const rolls = [...baseRolls, ...scalingRolls];
    const damageTotal = rolls.reduce((s, v) => s + v, 0) + modifier;
    const damageRolled: DamageRolledEvent = {
      id: newEventId() as ULID,
      at,
      type: 'DamageRolled',
      attackerId: intent.characterId,
      targetId,
      weaponInstanceId: intent.spellId as ULID,
      rolls: [
        {
          expression: mechanic.damageDice,
          rolls,
          modifier,
          type: mechanic.damageType,
        } satisfies DamageRoll,
      ],
      critical: isCrit,
      causedByEventId: attackEvent.id,
    };
    events.push(damageRolled);
    const mitigated = mitigateDamage({
      character: target,
      itemInstances: state.itemInstances,
      content,
      rawComponents: [{ amount: Math.max(0, damageTotal), type: mechanic.damageType }],
    });
    const damageApplied: DamageAppliedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'DamageApplied',
      targetId,
      components: mitigated,
      causedByEventId: damageRolled.id,
      sourceCharacterId: intent.characterId as ULID,
      source: spell.id,
    };
    events.push(damageApplied);
  }
  return events;
};

interface SaveMechanicOutcome {
  readonly events: Event[];
  readonly conditionsApplied: AppliedConditionRef[];
}

const planSaveMechanic = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: CastSpellIntent,
  spell: Spell,
  mechanic: Extract<SpellMechanic, { kind: 'save' }>,
  declaredEventId: string,
  at: string,
  castingClassId: string,
): SaveMechanicOutcome => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  const dcResult = computeSpellSaveDC({
    character,
    itemInstances: state.itemInstances,
    content,
    classId: castingClassId,
  });
  const bonusDice = (mechanic.extraDicePerSlotLevel ?? 0) * Math.max(0, intent.slotLevel - spell.level);
  const cantripSteps = spell.level === CANTRIP_LEVEL ? cantripExtraDice(computeTotalLevel(character)) : 0;
  const events: Event[] = [];
  const conditionsApplied: AppliedConditionRef[] = [];

  // Per PHB 2024 "Areas of Effect" — damage is rolled once for the spell and
  // applied to every target (halved on a successful save where applicable).
  let rawDamage = 0;
  if (mechanic.damageDice !== undefined && mechanic.damageType !== undefined) {
    const { rolls: baseRolls, modifier } = rollDamage(mechanic.damageDice, bonusDice, rng, false);
    const scalingRolls = rollCantripScaling(mechanic.cantripScalingDice, cantripSteps, rng, false);
    rawDamage = [...baseRolls, ...scalingRolls].reduce((s, v) => s + v, 0) + modifier;
  }

  for (const targetId of intent.targetIds) {
    const target = state.characters[targetId];
    if (!target) continue;
    const saveDerivation = computeSavingThrow({
      character: target,
      itemInstances: state.itemInstances,
      content,
      ability: mechanic.ability,
    });
    const d20 = rollDie(D20_SIDES, rng);
    const total = d20 + saveDerivation.total;
    const success = total >= dcResult.total;
    const saveEvent: SaveRolledEvent = {
      id: newEventId() as ULID,
      at,
      type: 'SaveRolled',
      targetId,
      ability: mechanic.ability,
      dc: dcResult.total,
      d20: [d20],
      used: 'none',
      bonus: saveDerivation.total,
      total,
      success,
      causedByEventId: declaredEventId as ULID,
      breakdown: [...saveDerivation.breakdown],
    };
    events.push(saveEvent);

    if (mechanic.damageDice !== undefined && mechanic.damageType !== undefined) {
      const finalAmount = success && mechanic.halfOnSuccess === true ? halveDamage(rawDamage) : success ? 0 : rawDamage;
      if (finalAmount > 0) {
        const mitigated = mitigateDamage({
          character: target,
          itemInstances: state.itemInstances,
          content,
          rawComponents: [{ amount: finalAmount, type: mechanic.damageType }],
        });
        const damageApplied: DamageAppliedEvent = {
          id: newEventId() as ULID,
          at,
          type: 'DamageApplied',
          targetId,
          components: mitigated,
          causedByEventId: saveEvent.id,
          sourceCharacterId: intent.characterId as ULID,
          source: spell.id,
        };
        events.push(damageApplied);
      }
    }
    if (!success && mechanic.conditionOnFail !== undefined) {
      const appliedConditionId = newAppliedConditionId();
      const cond: ConditionAppliedEvent = {
        id: newEventId() as ULID,
        at,
        type: 'ConditionApplied',
        targetId,
        conditionId: mechanic.conditionOnFail,
        appliedConditionId,
        causedByEventId: saveEvent.id,
      };
      events.push(cond);
      conditionsApplied.push({
        targetId: targetId as ULID,
        conditionId: mechanic.conditionOnFail,
        appliedConditionId,
      });
    }
  }
  return { events, conditionsApplied };
};

const planHealMechanic = (
  state: CampaignState,
  rng: RNG,
  intent: CastSpellIntent,
  spell: Spell,
  mechanic: Extract<SpellMechanic, { kind: 'heal' }>,
  declaredEventId: string,
  at: string,
): Event[] => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  const castingAbilityMod = abilityModifier(character.abilityScores.WIS);
  const bonusDice = (mechanic.extraDicePerSlotLevel ?? 0) * Math.max(0, intent.slotLevel - spell.level);
  const flatAmount = mechanic.flatAmount ?? 0;
  const events: Event[] = [];
  for (const targetId of intent.targetIds) {
    let rolledAmount = 0;
    if (mechanic.amountDice !== undefined) {
      const { rolls, modifier } = rollDamage(mechanic.amountDice, bonusDice, rng, false);
      rolledAmount = rolls.reduce((s, v) => s + v, 0) + modifier + castingAbilityMod;
    }
    const amount = Math.max(0, rolledAmount + flatAmount);
    const heal: HealedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'Healed',
      targetId,
      amount,
      source: spell.id,
      causedByEventId: declaredEventId as ULID,
    };
    events.push(heal);
  }
  return events;
};

interface BuffOutcome {
  readonly events: Event[];
  readonly conditionsApplied: AppliedConditionRef[];
}

const planBuffMechanic = (
  intent: CastSpellIntent,
  mechanic: Extract<SpellMechanic, { kind: 'buff' }>,
  declaredEventId: string,
  at: string,
): BuffOutcome => {
  // Buff spells (Bless, Aid, etc.) apply a beneficial condition to each
  // target. The condition holds the actual mechanical bonuses; this
  // planner just stages the ConditionApplied events and threads the
  // appliedConditionIds back to ConcentrationStarted (when applicable)
  // so the condition lifts together with the spell.
  const events: Event[] = [];
  const conditionsApplied: AppliedConditionRef[] = [];
  for (const targetId of intent.targetIds) {
    const appliedConditionId = newAppliedConditionId();
    const cond: ConditionAppliedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'ConditionApplied',
      targetId,
      conditionId: mechanic.conditionId,
      appliedConditionId,
      causedByEventId: declaredEventId as ULID,
    };
    events.push(cond);
    conditionsApplied.push({
      targetId: targetId as ULID,
      conditionId: mechanic.conditionId,
      appliedConditionId,
    });
  }
  return { events, conditionsApplied };
};

const planAutoHitMechanic = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: CastSpellIntent,
  spell: Spell,
  mechanic: Extract<SpellMechanic, { kind: 'auto-hit' }>,
  declaredEventId: string,
  at: string,
): Event[] => {
  // Auto-hit spells (Magic Missile, etc.) fire N darts; the dart count
  // scales with the slot level used. Each dart hits an independently
  // targeted creature (the targetIds list is expected to be padded to
  // dartCount; Magic Missile can repeat the same target). Each dart's
  // damage is rolled separately and mitigated independently so a target
  // with resistance benefits per dart.
  const slotsAboveBase = Math.max(0, intent.slotLevel - spell.level);
  const dartCount = mechanic.dartsAtBaseSlot + slotsAboveBase * (mechanic.extraDartsPerSlotLevel ?? 0);
  const events: Event[] = [];
  for (let i = 0; i < dartCount; i++) {
    const targetId = intent.targetIds[i] ?? intent.targetIds[intent.targetIds.length - 1];
    if (targetId === undefined) continue;
    const target = state.characters[targetId];
    if (!target) continue;
    const { rolls, modifier } = rollDamage(mechanic.damageDicePerDart, 0, rng, false);
    const raw = rolls.reduce((s, v) => s + v, 0) + modifier;
    if (raw <= 0) continue;
    const mitigated = mitigateDamage({
      character: target,
      itemInstances: state.itemInstances,
      content,
      rawComponents: [{ amount: raw, type: mechanic.damageType }],
    });
    const damageApplied: DamageAppliedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'DamageApplied',
      targetId,
      components: mitigated,
      causedByEventId: declaredEventId as ULID,
      sourceCharacterId: intent.characterId as ULID,
      source: `${spell.id} (dart ${i + 1})`,
    };
    events.push(damageApplied);
  }
  return events;
};

export const planCastSpell = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: CastSpellIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  const spell = content.spells.get(intent.spellId);
  if (!spell) throw new Error(`Unknown spell ${intent.spellId}`);
  if (!characterKnowsSpell(character, intent.spellId)) {
    throw new Error(`Character does not know or prepare spell ${intent.spellId}`);
  }
  if (intent.slotLevel < spell.level) {
    throw new Error(
      `Slot level ${intent.slotLevel} insufficient for spell level ${spell.level}`,
    );
  }

  const castingClassId = findCastingClass(character, content, intent.castingClassId);
  const slotSource = chooseSlotSource(spell, intent, state, content);

  const castAsRitual = intent.asRitual === true;
  if (castAsRitual && spell.ritual !== true) {
    throw new Error(`Spell ${spell.id} cannot be cast as a ritual`);
  }

  if (spell.level > CANTRIP_LEVEL && !castAsRitual) {
    const available = computeAvailableSpellSlots(character, content.classes);
    if (slotSource === 'pact') {
      if (available.pact === undefined || available.pact.count <= 0) {
        throw new Error('No pact slots available');
      }
      if (intent.slotLevel !== available.pact.level) {
        throw new Error(
          `Pact slots are level ${available.pact.level}; requested level ${intent.slotLevel}`,
        );
      }
    } else {
      const slotsLeft = available.standardByLevel[intent.slotLevel - 1] ?? 0;
      if (slotsLeft <= 0) {
        throw new Error(`No spell slots of level ${intent.slotLevel} available`);
      }
    }
  }

  const at = intent.at ?? nowIso();
  const declared: SpellCastDeclaredEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SpellCastDeclared',
    characterId: intent.characterId,
    spellId: intent.spellId,
    slotLevel: intent.slotLevel,
    slotSource,
    targetIds: [...intent.targetIds],
    castAsRitual,
  };
  const events: Event[] = [declared];

  if (spell.level > CANTRIP_LEVEL && !castAsRitual) {
    if (slotSource === 'pact') {
      const consumed: PactSlotConsumedEvent = {
        id: newEventId() as ULID,
        at,
        type: 'PactSlotConsumed',
        characterId: intent.characterId,
        causedByEventId: declared.id,
      };
      events.push(consumed);
    } else {
      const consumed: SpellSlotConsumedEvent = {
        id: newEventId() as ULID,
        at,
        type: 'SpellSlotConsumed',
        characterId: intent.characterId,
        slotLevel: intent.slotLevel,
        causedByEventId: declared.id,
      };
      events.push(consumed);
    }
  }

  const conditionsApplied: AppliedConditionRef[] = [];
  for (const mechanic of spell.mechanicalEffects) {
    if (mechanic.kind === 'attack') {
      events.push(
        ...planAttackMechanic(state, content, rng, intent, spell, mechanic, declared.id, at, castingClassId),
      );
    } else if (mechanic.kind === 'save') {
      const outcome = planSaveMechanic(
        state, content, rng, intent, spell, mechanic, declared.id, at, castingClassId,
      );
      events.push(...outcome.events);
      conditionsApplied.push(...outcome.conditionsApplied);
    } else if (mechanic.kind === 'auto-hit') {
      events.push(...planAutoHitMechanic(state, content, rng, intent, spell, mechanic, declared.id, at));
    } else if (mechanic.kind === 'buff') {
      const outcome = planBuffMechanic(intent, mechanic, declared.id, at);
      events.push(...outcome.events);
      conditionsApplied.push(...outcome.conditionsApplied);
    } else {
      events.push(...planHealMechanic(state, rng, intent, spell, mechanic, declared.id, at));
    }
  }

  if (spell.concentration === true) {
    if (character.concentrationEffectId !== undefined) {
      const priorBroken: ConcentrationBrokenEvent = {
        id: newEventId() as ULID,
        at,
        type: 'ConcentrationBroken',
        effectInstanceId: character.concentrationEffectId,
        casterId: intent.characterId as ULID,
        reason: 'newConcentrationSpell',
        causedByEventId: declared.id,
      };
      events.push(priorBroken);
    }
    const started: ConcentrationStartedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'ConcentrationStarted',
      effectInstanceId: newEffectInstanceId(),
      casterId: intent.characterId as ULID,
      spellId: intent.spellId,
      targetIds: [...intent.targetIds] as ULID[],
      conditionsApplied,
      causedByEventId: declared.id,
    };
    events.push(started);
  }

  return events;
};
