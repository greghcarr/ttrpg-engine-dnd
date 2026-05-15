import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { Event } from '../../schemas/events/index.js';
import type { CompanionDismissedEvent } from '../../schemas/events/summons.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

export interface DismissCompanionIntent {
  readonly type: 'DismissCompanion';
  readonly companionId: string;
  readonly at?: string;
}

// Explicit dismissal of a companion. Use when a non-concentration
// summon (Find Familiar, Animate Dead, Phantom Steed) needs to go
// away. Concentration-driven dismissal is handled inside
// `clearConcentrationEffect` without firing this event.
export const planDismissCompanion = (
  state: CampaignState,
  intent: DismissCompanionIntent,
): ReadonlyArray<Event> => {
  const companion = state.characters[intent.companionId];
  if (companion === undefined) {
    throw new Error(`Companion ${intent.companionId} not found`);
  }
  if (companion.summonSource === undefined) {
    throw new Error(`${intent.companionId} is not a summoned companion`);
  }
  const at = intent.at ?? nowIso();
  const dismissed: CompanionDismissedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'CompanionDismissed',
    companionId: intent.companionId as ULID,
  };
  return [dismissed];
};
