import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { Character } from '../../schemas/runtime/character.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { Effect } from '../../schemas/effects.js';
import type { Predicate } from '../../schemas/predicate.js';
import type { RNG } from '../../rng/index.js';
import { rollDie, parseDiceExpression } from '../../rng/dice.js';
import { evaluatePredicate } from '../../effects/predicate.js';
import { collectEffectsFromCharacter } from '../../derive/effect-stack.js';
import { newEventId } from '../../ids.js';
import type { ULID } from '../ids-utils.js';
import type { DamageAppliedEvent } from '../../schemas/events/combat.js';
import type { TriggerFiredEvent } from '../../schemas/events/triggers.js';

type OnEventEffect = Extract<Effect, { kind: 'OnEvent' }>;
type AddDamageAction = Extract<OnEventEffect['actions'][number], { kind: 'AddDamage' }>;

const buildEventFacts = (event: Event, characterId: string): Map<string, unknown> => {
  const facts = new Map<string, unknown>([['event.type', event.type]]);
  if (event.type === 'AttackRolled') {
    facts.set('event.attackerIsSelf', event.attackerId === characterId);
    facts.set('event.targetIsSelf', event.targetId === characterId);
    facts.set('event.hit', event.hit);
    facts.set('event.critical', event.critical);
    facts.set('event.used', event.used);
    facts.set('event.weaponInstanceId', event.weaponInstanceId);
  } else if (event.type === 'DamageApplied') {
    facts.set('event.targetIsSelf', event.targetId === characterId);
  }
  return facts;
};

const cadenceAllowsFiring = (
  character: Character,
  triggerId: string,
  oncePer: OnEventEffect['oncePer'],
): boolean => {
  if (oncePer === undefined) return true;
  const counter = character.triggerCounters[triggerId];
  if (counter === undefined) return true;
  switch (oncePer) {
    case 'turn':
      return counter.firedThisTurn !== true;
    case 'round':
      return counter.firedThisRound !== true;
    case 'shortRest':
      return counter.firedThisShortRest !== true;
    case 'longRest':
      return counter.firedThisLongRest !== true;
  }
};

const cadencePayload = (
  oncePer: OnEventEffect['oncePer'],
): TriggerFiredEvent['cadence'] => {
  if (oncePer === undefined) return {};
  switch (oncePer) {
    case 'turn':
      return { firedThisTurn: true };
    case 'round':
      return { firedThisRound: true };
    case 'shortRest':
      return { firedThisShortRest: true };
    case 'longRest':
      return { firedThisLongRest: true };
  }
};

const rollAddDamage = (
  action: AddDamageAction,
  rng: RNG,
  critical: boolean,
): { amount: number; rolls: number[] } => {
  const parsed = parseDiceExpression(action.dice);
  const count = critical ? parsed.count * 2 : parsed.count;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(parsed.die, rng));
  }
  const amount = rolls.reduce((s, v) => s + v, 0) + parsed.modifier;
  return { amount: Math.max(0, amount), rolls };
};

interface FiredTrigger {
  readonly events: Event[];
  readonly triggerId: string;
  readonly cadence: TriggerFiredEvent['cadence'];
}

const fireAddDamage = (
  action: AddDamageAction,
  event: Event,
  rng: RNG,
  causedByEventId: string,
): Event[] => {
  if (event.type !== 'AttackRolled') return [];
  const { amount } = rollAddDamage(action, rng, event.critical);
  if (amount <= 0) return [];
  const damageApplied: DamageAppliedEvent = {
    id: newEventId() as ULID,
    at: event.at,
    type: 'DamageApplied',
    targetId: event.targetId,
    components: [{ amount, type: action.damageType }],
    causedByEventId: causedByEventId as ULID,
  };
  return [damageApplied];
};

const fireTrigger = (
  effect: OnEventEffect,
  character: Character,
  triggerId: string,
  event: Event,
  rng: RNG,
  at: string,
): FiredTrigger | null => {
  const cadence = cadencePayload(effect.oncePer);
  const triggerFired: TriggerFiredEvent = {
    id: newEventId() as ULID,
    at,
    type: 'TriggerFired',
    characterId: character.id as ULID,
    triggerId,
    cadence,
  };
  const events: Event[] = [triggerFired];

  for (const action of effect.actions) {
    if (action.kind === 'AddDamage') {
      events.push(...fireAddDamage(action, event, rng, triggerFired.id));
    }
  }
  return { events, triggerId, cadence };
};

const triggerIdOf = (effect: OnEventEffect, characterId: string): string => {
  const explicit = (effect as OnEventEffect & { id?: string }).id;
  if (typeof explicit === 'string') return `${characterId}:${explicit}`;
  const filterHash = JSON.stringify(effect.trigger);
  return `${characterId}:${effect.trigger.eventType}:${filterHash}`;
};

export interface DispatchInput {
  readonly state: CampaignState;
  readonly content: ResolvedContent;
  readonly rng: RNG;
  readonly event: Event;
  readonly at: string;
}

export const dispatchTriggers = (input: DispatchInput): Event[] => {
  const { state, content, rng, event, at } = input;
  const emitted: Event[] = [];
  for (const characterId of Object.keys(state.characters)) {
    const character = state.characters[characterId];
    if (character === undefined) continue;
    const effects = collectEffectsFromCharacter({
      character,
      content,
      itemInstances: state.itemInstances,
      pendingChoices: state.pendingChoices,
    });
    for (const effect of effects) {
      if (effect.kind !== 'OnEvent') continue;
      if (effect.trigger.eventType !== event.type) continue;
      const facts = buildEventFacts(event, characterId);
      const filter = effect.trigger.filter as Predicate | undefined;
      if (filter !== undefined && !evaluatePredicate(filter, { facts })) continue;
      const triggerId = triggerIdOf(effect, characterId);
      if (!cadenceAllowsFiring(character, triggerId, effect.oncePer)) continue;
      const fired = fireTrigger(effect, character, triggerId, event, rng, at);
      if (fired === null) continue;
      emitted.push(...fired.events);
    }
  }
  return emitted;
};
