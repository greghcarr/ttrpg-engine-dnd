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

export const planShortRest = (
  _state: CampaignState,
  intent: ShortRestIntent,
): ReadonlyArray<Event> => {
  const at = intent.at ?? nowIso();
  const start: ShortRestStartedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ShortRestStarted',
    participantIds: [...intent.participantIds],
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
  _state: CampaignState,
  intent: LongRestIntent,
): ReadonlyArray<Event> => {
  const at = intent.at ?? nowIso();
  const start: LongRestStartedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'LongRestStarted',
    participantIds: [...intent.participantIds],
  };
  const end: LongRestEndedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'LongRestEnded',
    causedByEventId: start.id,
  };
  return [start, end];
};
