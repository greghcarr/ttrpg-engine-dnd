import { describe, expect, it } from 'vitest';
import { apply } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import {
  newJournalEntryId,
  newPartyId,
} from '../../../src/ids.js';
import { eventId, isoTimestamp, buildFighter } from '../../fixtures/index.js';
import type {
  QuestStartedEvent,
  ObjectiveProgressedEvent,
  ObjectiveCompletedEvent,
  ObjectiveFailedEvent,
  QuestCompletedEvent,
  QuestFailedEvent,
  QuestAbandonedEvent,
  QuestRewardClaimedEvent,
  XPAwardedEvent,
  MilestoneAwardedEvent,
} from '../../../src/schemas/events/quests.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { PartyCreatedEvent } from '../../../src/schemas/events/party.js';

const evt = <T extends { id: string; at: string }>(e: Omit<T, 'id' | 'at'>): T =>
  ({ id: eventId(), at: isoTimestamp(), ...e }) as T;

const startSimpleQuest = (questId: string, objectiveIds: ReadonlyArray<string>): QuestStartedEvent =>
  evt<QuestStartedEvent>({
    type: 'QuestStarted',
    questId,
    title: 'Save the village',
    description: 'The goblins must be driven out.',
    objectives: objectiveIds.map((id, i) => ({
      id,
      description: `Objective ${i + 1}`,
      status: 'pending',
      optional: false,
      progress: 0,
      required: 3,
    })),
    reward: {
      xpPerCharacter: 250,
      currency: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 },
      itemDefinitionIds: [],
    },
  });

describe('reducer: quests', () => {
  it('starts a quest with objectives and a reward', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    const state = apply(emptyCampaignState(), startSimpleQuest(questId, [obj1]));
    expect(state.quests[questId]?.status).toBe('active');
    expect(state.quests[questId]?.objectives).toHaveLength(1);
    expect(state.quests[questId]?.reward.xpPerCharacter).toBe(250);
  });

  it('rejects starting a duplicate quest', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    const start = startSimpleQuest(questId, [obj1]);
    const state = apply(emptyCampaignState(), start);
    expect(() => apply(state, start)).toThrow(/already exists/);
  });

  it('progresses an objective and auto-completes when required is met', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    let state = apply(emptyCampaignState(), startSimpleQuest(questId, [obj1]));
    state = apply(
      state,
      evt<ObjectiveProgressedEvent>({
        type: 'ObjectiveProgressed',
        questId,
        objectiveId: obj1,
        delta: 2,
      }),
    );
    expect(state.quests[questId]?.objectives[0]?.status).toBe('pending');
    expect(state.quests[questId]?.objectives[0]?.progress).toBe(2);
    state = apply(
      state,
      evt<ObjectiveProgressedEvent>({
        type: 'ObjectiveProgressed',
        questId,
        objectiveId: obj1,
        delta: 1,
      }),
    );
    expect(state.quests[questId]?.objectives[0]?.status).toBe('completed');
    expect(state.quests[questId]?.objectives[0]?.progress).toBe(3);
  });

  it('refuses progress on a completed objective', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    let state = apply(emptyCampaignState(), startSimpleQuest(questId, [obj1]));
    state = apply(
      state,
      evt<ObjectiveCompletedEvent>({
        type: 'ObjectiveCompleted',
        questId,
        objectiveId: obj1,
      }),
    );
    expect(() =>
      apply(
        state,
        evt<ObjectiveProgressedEvent>({
          type: 'ObjectiveProgressed',
          questId,
          objectiveId: obj1,
          delta: 1,
        }),
      ),
    ).toThrow(/not pending/);
  });

  it('explicit completion fills progress to required', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    let state = apply(emptyCampaignState(), startSimpleQuest(questId, [obj1]));
    state = apply(
      state,
      evt<ObjectiveCompletedEvent>({
        type: 'ObjectiveCompleted',
        questId,
        objectiveId: obj1,
      }),
    );
    expect(state.quests[questId]?.objectives[0]?.progress).toBe(3);
  });

  it('refuses to complete a quest with unfinished required objectives', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    const state = apply(emptyCampaignState(), startSimpleQuest(questId, [obj1]));
    expect(() =>
      apply(state, evt<QuestCompletedEvent>({ type: 'QuestCompleted', questId })),
    ).toThrow(/not completed/);
  });

  it('completes a quest after all required objectives are done; optional unfinished is allowed', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    const obj2 = newJournalEntryId();
    let state = apply(
      emptyCampaignState(),
      evt<QuestStartedEvent>({
        type: 'QuestStarted',
        questId,
        title: 'T',
        objectives: [
          {
            id: obj1,
            description: 'Required',
            status: 'pending',
            optional: false,
            progress: 0,
            required: 1,
          },
          {
            id: obj2,
            description: 'Optional',
            status: 'pending',
            optional: true,
            progress: 0,
            required: 1,
          },
        ],
        reward: {
          xpPerCharacter: 0,
          currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
          itemDefinitionIds: [],
        },
      }),
    );
    state = apply(
      state,
      evt<ObjectiveCompletedEvent>({ type: 'ObjectiveCompleted', questId, objectiveId: obj1 }),
    );
    state = apply(state, evt<QuestCompletedEvent>({ type: 'QuestCompleted', questId }));
    expect(state.quests[questId]?.status).toBe('completed');
  });

  it('fails objectives and quests with a reason', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    let state = apply(emptyCampaignState(), startSimpleQuest(questId, [obj1]));
    state = apply(
      state,
      evt<ObjectiveFailedEvent>({ type: 'ObjectiveFailed', questId, objectiveId: obj1 }),
    );
    expect(state.quests[questId]?.objectives[0]?.status).toBe('failed');
    state = apply(
      state,
      evt<QuestFailedEvent>({ type: 'QuestFailed', questId, reason: 'village destroyed' }),
    );
    expect(state.quests[questId]?.status).toBe('failed');
  });

  it('abandons an active quest', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    let state = apply(emptyCampaignState(), startSimpleQuest(questId, [obj1]));
    state = apply(
      state,
      evt<QuestAbandonedEvent>({ type: 'QuestAbandoned', questId, reason: 'too dangerous' }),
    );
    expect(state.quests[questId]?.status).toBe('abandoned');
  });

  it('claims a reward distributing XP to each beneficiary and currency to the party', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    const partyId = newPartyId();
    const alyx = buildFighter({ name: 'Alyx' });
    const borin = buildFighter({ name: 'Borin' });
    let state = apply(
      emptyCampaignState(),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    );
    state = apply(
      state,
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: borin }),
    );
    state = apply(
      state,
      evt<PartyCreatedEvent>({
        type: 'PartyCreated',
        partyId,
        name: 'Heroes',
        memberIds: [alyx.id, borin.id],
      }),
    );
    state = apply(
      state,
      evt<QuestStartedEvent>({
        type: 'QuestStarted',
        questId,
        title: 'T',
        partyId,
        objectives: [
          {
            id: obj1,
            description: 'Done',
            status: 'pending',
            optional: false,
            progress: 0,
            required: 1,
          },
        ],
        reward: {
          xpPerCharacter: 100,
          currency: { cp: 0, sp: 0, ep: 0, gp: 25, pp: 0 },
          itemDefinitionIds: [],
        },
      }),
    );
    state = apply(
      state,
      evt<ObjectiveCompletedEvent>({ type: 'ObjectiveCompleted', questId, objectiveId: obj1 }),
    );
    state = apply(state, evt<QuestCompletedEvent>({ type: 'QuestCompleted', questId }));
    state = apply(
      state,
      evt<QuestRewardClaimedEvent>({
        type: 'QuestRewardClaimed',
        questId,
        beneficiaryCharacterIds: [alyx.id, borin.id],
      }),
    );
    expect(state.characters[alyx.id]?.xp).toBe(100);
    expect(state.characters[borin.id]?.xp).toBe(100);
    expect(state.parties[partyId]?.purse.gp).toBe(25);
    expect(state.quests[questId]?.rewardClaimed).toBe(true);
  });

  it('refuses to claim a reward twice', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    const alyx = buildFighter({ name: 'Alyx' });
    let state = apply(
      emptyCampaignState(),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    );
    state = apply(state, startSimpleQuest(questId, [obj1]));
    state = apply(
      state,
      evt<ObjectiveCompletedEvent>({ type: 'ObjectiveCompleted', questId, objectiveId: obj1 }),
    );
    state = apply(state, evt<QuestCompletedEvent>({ type: 'QuestCompleted', questId }));
    state = apply(
      state,
      evt<QuestRewardClaimedEvent>({
        type: 'QuestRewardClaimed',
        questId,
        beneficiaryCharacterIds: [alyx.id],
      }),
    );
    expect(() =>
      apply(
        state,
        evt<QuestRewardClaimedEvent>({
          type: 'QuestRewardClaimed',
          questId,
          beneficiaryCharacterIds: [alyx.id],
        }),
      ),
    ).toThrow(/already claimed/);
  });

  it('refuses to claim a reward before the quest is completed', () => {
    const questId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    const alyx = buildFighter({ name: 'Alyx' });
    let state = apply(
      emptyCampaignState(),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    );
    state = apply(state, startSimpleQuest(questId, [obj1]));
    expect(() =>
      apply(
        state,
        evt<QuestRewardClaimedEvent>({
          type: 'QuestRewardClaimed',
          questId,
          beneficiaryCharacterIds: [alyx.id],
        }),
      ),
    ).toThrow(/must be completed/);
  });

  it('XPAwarded adds XP directly to a character', () => {
    const alyx = buildFighter({ name: 'Alyx' });
    let state = apply(
      emptyCampaignState(),
      evt<CharacterCreatedEvent>({ type: 'CharacterCreated', snapshot: alyx }),
    );
    state = apply(
      state,
      evt<XPAwardedEvent>({
        type: 'XPAwarded',
        characterId: alyx.id,
        amount: 50,
        source: 'scouting reward',
      }),
    );
    expect(state.characters[alyx.id]?.xp).toBe(50);
  });

  it('MilestoneAwarded appends to the milestones list', () => {
    const state = apply(
      emptyCampaignState(),
      evt<MilestoneAwardedEvent>({
        type: 'MilestoneAwarded',
        kind: 'major',
        title: 'First boss defeated',
      }),
    );
    expect(state.milestones).toHaveLength(1);
    expect(state.milestones[0]?.kind).toBe('major');
  });
});
