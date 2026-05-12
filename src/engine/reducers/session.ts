import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  SessionStartedEvent,
  SessionEndedEvent,
  JournalEntryAddedEvent,
  InGameTimeAdvancedEvent,
} from '../../schemas/events/session.js';
import { invariant } from '../../internal/invariants.js';
import { advanceInGameTime } from '../../schemas/runtime/in-game-time.js';

export const applySessionStarted = (
  state: Draft<CampaignState>,
  event: SessionStartedEvent,
): void => {
  invariant(state.sessions[event.sessionId] === undefined, `Session ${event.sessionId} already exists`);
  invariant(state.activeSessionId === undefined, `Another session ${state.activeSessionId} is already active`);
  if (event.inGameStart !== undefined) {
    invariant(
      event.inGameStart.totalMinutes >= state.inGameTime.totalMinutes,
      `Session inGameStart cannot rewind the campaign clock`,
    );
    state.inGameTime = { totalMinutes: event.inGameStart.totalMinutes };
  }
  state.sessions[event.sessionId] = {
    id: event.sessionId,
    name: event.name,
    startedAtIso: event.at,
    inGameStart: { totalMinutes: state.inGameTime.totalMinutes },
    journalEntryIds: [],
  };
  state.activeSessionId = event.sessionId;
};

export const applySessionEnded = (
  state: Draft<CampaignState>,
  event: SessionEndedEvent,
): void => {
  const session = state.sessions[event.sessionId];
  invariant(session !== undefined, `Session ${event.sessionId} not found`);
  invariant(session.endedAtIso === undefined, `Session ${event.sessionId} already ended`);
  session.endedAtIso = event.at;
  session.inGameEnd = state.inGameTime;
  if (event.summary !== undefined) session.summary = event.summary;
  if (state.activeSessionId === event.sessionId) state.activeSessionId = undefined;
};

export const applyJournalEntryAdded = (
  state: Draft<CampaignState>,
  event: JournalEntryAddedEvent,
): void => {
  invariant(state.journalEntries[event.entryId] === undefined, `Journal entry ${event.entryId} already exists`);
  if (event.sessionId !== undefined) {
    invariant(state.sessions[event.sessionId] !== undefined, `Session ${event.sessionId} not found`);
  }
  if (event.authorCharacterId !== undefined) {
    invariant(
      state.characters[event.authorCharacterId] !== undefined,
      `Author ${event.authorCharacterId} not found`,
    );
  }
  state.journalEntries[event.entryId] = {
    id: event.entryId,
    sessionId: event.sessionId,
    authorKind: event.authorKind,
    authorCharacterId: event.authorCharacterId,
    visibility: event.visibility,
    visibleToCharacterIds: [...event.visibleToCharacterIds],
    title: event.title,
    body: event.body,
    createdAtIso: event.at,
    inGameAt: state.inGameTime,
  };
  if (event.sessionId !== undefined) {
    state.sessions[event.sessionId]!.journalEntryIds.push(event.entryId);
  }
};

export const applyInGameTimeAdvanced = (
  state: Draft<CampaignState>,
  event: InGameTimeAdvancedEvent,
): void => {
  state.inGameTime = advanceInGameTime(state.inGameTime, event.minutes);
};
