import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  LongRestEndedEvent,
  LongRestStartedEvent,
  ShortRestEndedEvent,
  ShortRestStartedEvent,
} from '../../schemas/events/rest.js';
import type { Event } from '../../schemas/events/index.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../../engine/ids-utils.js';

export interface LongRestIntent {
  readonly type: 'LongRest';
  readonly participantIds: ReadonlyArray<string>;
  readonly at?: string;
}

export interface ShortRestIntent {
  readonly type: 'ShortRest';
  readonly participantIds: ReadonlyArray<string>;
  readonly at?: string;
}

export type RestIntent = LongRestIntent | ShortRestIntent;

// Standard rest durations (PHB 2024 ch.1).
const SHORT_REST_STANDARD_MINUTES = 60;
const LONG_REST_STANDARD_MINUTES = 60 * 8;
// Gritty Realism variant (DMG 2024). Short rest = a night's sleep,
// long rest = a week of downtime.
const SHORT_REST_GRITTY_MINUTES = 60 * 8;
const LONG_REST_GRITTY_MINUTES = 60 * 24 * 7;

export const planShortRest = (
  state: CampaignState,
  intent: ShortRestIntent,
): ReadonlyArray<Event> => {
  const at = intent.at ?? nowIso();
  const expectedDurationMinutes = state.settings.grittyRest
    ? SHORT_REST_GRITTY_MINUTES
    : SHORT_REST_STANDARD_MINUTES;
  const start: ShortRestStartedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ShortRestStarted',
    participantIds: [...intent.participantIds],
    expectedDurationMinutes,
  };
  const end: ShortRestEndedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ShortRestEnded',
    causedByEventId: start.id,
  };
  return [start, end];
};

export const planLongRest = (
  state: CampaignState,
  intent: LongRestIntent,
): ReadonlyArray<Event> => {
  const at = intent.at ?? nowIso();
  const expectedDurationMinutes = state.settings.grittyRest
    ? LONG_REST_GRITTY_MINUTES
    : LONG_REST_STANDARD_MINUTES;
  const start: LongRestStartedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'LongRestStarted',
    participantIds: [...intent.participantIds],
    expectedDurationMinutes,
  };
  const end: LongRestEndedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'LongRestEnded',
    causedByEventId: start.id,
  };
  return [start, end];
};
