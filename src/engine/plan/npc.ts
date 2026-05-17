import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { RNG } from '../../rng/index.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { D20_SIDES } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import { invariant } from '../../internal/invariants.js';
import { computeAbilityCheck } from '../../derive/ability-check.js';
import { abilityModifier } from '../../derive/ability.js';
import type { ULID } from '../ids-utils.js';
import type {
  MoraleCheckRolledEvent,
  MoraleBrokenEvent,
  AttitudeChangedEvent,
} from '../../schemas/events/npc.js';
import type { AbilityCheckRolledEvent } from '../../schemas/events/checks.js';

export interface MoraleCheckIntent {
  readonly type: 'MoraleCheck';
  readonly npcId: string;
  readonly dc: number;
  readonly breakAction?: 'flee' | 'surrender';
  readonly at?: string;
}

export const planMoraleCheck = (
  state: CampaignState,
  _content: ResolvedContent,
  rng: RNG,
  intent: MoraleCheckIntent,
): ReadonlyArray<Event> => {
  const npc = state.characters[intent.npcId];
  invariant(npc !== undefined, `NPC ${intent.npcId} not found`);
  const at = intent.at ?? nowIso();
  const bonus = abilityModifier(npc.abilityScores.WIS);
  const d20 = rollDie(D20_SIDES, rng);
  const total = d20 + bonus;
  const success = total >= intent.dc;
  const events: Event[] = [];
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'MoraleCheckRolled',
    characterId: intent.npcId,
    d20,
    bonus,
    total,
    dc: intent.dc,
    success,
  } satisfies MoraleCheckRolledEvent);
  if (!success && npc.morale !== undefined && npc.morale.current <= 1) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'MoraleBroken',
      characterId: intent.npcId,
      action: intent.breakAction ?? 'flee',
    } satisfies MoraleBrokenEvent);
  }
  return events;
};

export interface ReactionRollIntent {
  readonly type: 'ReactionRoll';
  readonly npcId: string;
  readonly presenterId: string;
  readonly dc?: number;
  readonly at?: string;
}

const reactionAttitudeFor = (total: number, dc: number): 'hostile' | 'unfriendly' | 'indifferent' | 'friendly' | 'helpful' => {
  const delta = total - dc;
  if (delta >= 10) return 'helpful';
  if (delta >= 5) return 'friendly';
  if (delta >= 0) return 'indifferent';
  if (delta >= -5) return 'unfriendly';
  return 'hostile';
};

export const planReactionRoll = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: ReactionRollIntent,
): ReadonlyArray<Event> => {
  const npc = state.characters[intent.npcId];
  invariant(npc !== undefined, `NPC ${intent.npcId} not found`);
  const presenter = state.characters[intent.presenterId];
  invariant(presenter !== undefined, `Presenter ${intent.presenterId} not found`);
  const dc = intent.dc ?? 10;
  const at = intent.at ?? nowIso();
  const derivation = computeAbilityCheck({
    character: presenter,
    itemInstances: state.itemInstances,
    content,
    ability: 'CHA',
    skill: 'persuasion',
    pendingChoices: state.pendingChoices,
    characters: state.characters,
  });
  const d20 = rollDie(D20_SIDES, rng);
  const total = d20 + derivation.total;
  const newAttitude = reactionAttitudeFor(total, dc);
  return [
    {
      id: newEventId() as ULID,
      at,
      type: 'AbilityCheckRolled',
      characterId: intent.presenterId,
      ability: 'CHA',
      skill: 'persuasion',
      dc,
      success: total >= dc,
      d20: [d20],
      used: 'none',
      bonus: derivation.total,
      total,
      breakdown: [...derivation.breakdown],
    } satisfies AbilityCheckRolledEvent,
    {
      id: newEventId() as ULID,
      at,
      type: 'AttitudeChanged',
      characterId: intent.npcId,
      ...(npc.attitude !== undefined ? { fromAttitude: npc.attitude } : {}),
      toAttitude: newAttitude,
      cause: 'social-check shift',
    } satisfies AttitudeChangedEvent,
  ];
};
