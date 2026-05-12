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
import type { Character } from '../../schemas/runtime/character.js';
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

    const { rolls, modifier } = rollDamage(mechanic.damageDice, bonusDice, rng, isCrit);
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
  const events: Event[] = [];
  const conditionsApplied: AppliedConditionRef[] = [];

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
    };
    events.push(saveEvent);

    if (mechanic.damageDice !== undefined && mechanic.damageType !== undefined) {
      const { rolls, modifier } = rollDamage(mechanic.damageDice, bonusDice, rng, false);
      const raw = rolls.reduce((s, v) => s + v, 0) + modifier;
      const finalAmount = success && mechanic.halfOnSuccess === true ? halveDamage(raw) : success ? 0 : raw;
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
  const events: Event[] = [];
  for (const targetId of intent.targetIds) {
    const { rolls, modifier } = rollDamage(mechanic.amountDice, bonusDice, rng, false);
    const amount = Math.max(0, rolls.reduce((s, v) => s + v, 0) + modifier + castingAbilityMod);
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

  if (spell.level > CANTRIP_LEVEL) {
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
    castAsRitual: false,
  };
  const events: Event[] = [declared];

  if (spell.level > CANTRIP_LEVEL) {
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
