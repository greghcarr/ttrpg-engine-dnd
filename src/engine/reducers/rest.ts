import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  LongRestEndedEvent,
  LongRestStartedEvent,
  ShortRestEndedEvent,
  ShortRestStartedEvent,
} from '../../schemas/events/rest.js';
import { invariant } from '../../internal/invariants.js';
import {
  clearLongRestCountersForCharacters,
  clearShortRestCountersForCharacters,
} from './triggers.js';

export const applyShortRestStarted = (
  state: Draft<CampaignState>,
  event: ShortRestStartedEvent,
): void => {
  invariant(state.activeShortRest === undefined, 'A short rest is already in progress');
  invariant(state.activeLongRest === undefined, 'Cannot short rest during a long rest');
  state.activeShortRest = {
    startedAtEventId: event.id,
    participantIds: [...event.participantIds],
  };
};

export const applyShortRestEnded = (
  state: Draft<CampaignState>,
  _event: ShortRestEndedEvent,
): void => {
  const session = state.activeShortRest;
  invariant(session !== undefined, 'No active short rest to end');
  state.activeShortRest = undefined;
  for (const id of session.participantIds) {
    const character = state.characters[id];
    if (!character) continue;
    character.pactSlotsUsed = 0;
  }
  clearShortRestCountersForCharacters(state, session.participantIds);
};

const halfRoundedDown = (n: number): number => Math.floor(n / 2);
const oneMin = (n: number): number => Math.max(1, n);

export const applyLongRestStarted = (
  state: Draft<CampaignState>,
  event: LongRestStartedEvent,
): void => {
  invariant(state.activeShortRest === undefined, 'Cannot long rest during a short rest');
  invariant(state.activeLongRest === undefined, 'A long rest is already in progress');
  state.activeLongRest = {
    startedAtEventId: event.id,
    participantIds: [...event.participantIds],
  };
};

export const applyLongRestEnded = (
  state: Draft<CampaignState>,
  _event: LongRestEndedEvent,
): void => {
  const session = state.activeLongRest;
  invariant(session !== undefined, 'No active long rest to end');
  state.activeLongRest = undefined;
  for (const id of session.participantIds) {
    const character = state.characters[id];
    if (!character) continue;
    character.hp.current = character.hp.max;
    character.hp.temp = 0;
    character.deathSaves.successes = 0;
    character.deathSaves.failures = 0;
    character.deathSaves.stable = false;
    if (character.exhaustion > 0) {
      character.exhaustion = character.exhaustion - 1;
    }
    let totalHitDice = 0;
    for (const enrollment of character.classes) {
      totalHitDice += enrollment.level;
    }
    const recoveryBudget = oneMin(halfRoundedDown(totalHitDice));
    let remaining = recoveryBudget;
    for (const enrollment of character.classes) {
      if (remaining <= 0) break;
      const possible = enrollment.level - enrollment.hitDiceRemaining;
      const take = Math.min(remaining, possible);
      enrollment.hitDiceRemaining += take;
      remaining -= take;
    }
    for (const resource of character.resources) {
      resource.current = resource.max;
    }
    character.spellSlotsUsed = {};
    character.pactSlotsUsed = 0;
  }
  clearLongRestCountersForCharacters(state, session.participantIds);
};
