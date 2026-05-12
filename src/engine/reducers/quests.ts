import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
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
} from '../../schemas/events/quests.js';
import { invariant } from '../../internal/invariants.js';
import { emptyCurrency, addCurrency } from '../../schemas/runtime/currency.js';

const cloneObjectives = (event: QuestStartedEvent) =>
  event.objectives.map((o) => ({
    id: o.id,
    description: o.description,
    status: o.status,
    optional: o.optional,
    progress: o.progress,
    ...(o.required !== undefined ? { required: o.required } : {}),
  }));

export const applyQuestStarted = (state: Draft<CampaignState>, event: QuestStartedEvent): void => {
  invariant(state.quests[event.questId] === undefined, `Quest ${event.questId} already exists`);
  if (event.partyId !== undefined) {
    invariant(state.parties[event.partyId] !== undefined, `Party ${event.partyId} not found`);
  }
  state.quests[event.questId] = {
    id: event.questId,
    title: event.title,
    description: event.description,
    status: 'active',
    partyId: event.partyId,
    objectives: cloneObjectives(event),
    reward: event.reward ?? {
      xpPerCharacter: 0,
      currency: emptyCurrency(),
      itemDefinitionIds: [],
    },
    rewardClaimed: false,
    startedAtIso: event.at,
  };
};

const findObjective = (
  state: Draft<CampaignState>,
  questId: string,
  objectiveId: string,
) => {
  const quest = state.quests[questId];
  invariant(quest !== undefined, `Quest ${questId} not found`);
  const objective = quest.objectives.find((o) => o.id === objectiveId);
  invariant(objective !== undefined, `Objective ${objectiveId} not found on quest ${questId}`);
  return { quest, objective };
};

export const applyObjectiveProgressed = (
  state: Draft<CampaignState>,
  event: ObjectiveProgressedEvent,
): void => {
  const { quest, objective } = findObjective(state, event.questId, event.objectiveId);
  invariant(quest.status === 'active', `Quest ${event.questId} is not active`);
  invariant(objective.status === 'pending', `Objective ${event.objectiveId} is not pending`);
  objective.progress += event.delta;
  if (objective.required !== undefined && objective.progress >= objective.required) {
    objective.status = 'completed';
  }
};

export const applyObjectiveCompleted = (
  state: Draft<CampaignState>,
  event: ObjectiveCompletedEvent,
): void => {
  const { objective } = findObjective(state, event.questId, event.objectiveId);
  invariant(objective.status !== 'completed', `Objective ${event.objectiveId} already completed`);
  objective.status = 'completed';
  if (objective.required !== undefined && objective.progress < objective.required) {
    objective.progress = objective.required;
  }
};

export const applyObjectiveFailed = (
  state: Draft<CampaignState>,
  event: ObjectiveFailedEvent,
): void => {
  const { objective } = findObjective(state, event.questId, event.objectiveId);
  invariant(objective.status === 'pending', `Objective ${event.objectiveId} is not pending`);
  objective.status = 'failed';
};

export const applyQuestCompleted = (
  state: Draft<CampaignState>,
  event: QuestCompletedEvent,
): void => {
  const quest = state.quests[event.questId];
  invariant(quest !== undefined, `Quest ${event.questId} not found`);
  invariant(quest.status === 'active', `Quest ${event.questId} is not active`);
  for (const o of quest.objectives) {
    if (!o.optional) {
      invariant(o.status === 'completed', `Required objective ${o.id} is not completed`);
    }
  }
  quest.status = 'completed';
  quest.endedAtIso = event.at;
};

export const applyQuestFailed = (
  state: Draft<CampaignState>,
  event: QuestFailedEvent,
): void => {
  const quest = state.quests[event.questId];
  invariant(quest !== undefined, `Quest ${event.questId} not found`);
  invariant(quest.status === 'active', `Quest ${event.questId} is not active`);
  quest.status = 'failed';
  quest.endedAtIso = event.at;
};

export const applyQuestAbandoned = (
  state: Draft<CampaignState>,
  event: QuestAbandonedEvent,
): void => {
  const quest = state.quests[event.questId];
  invariant(quest !== undefined, `Quest ${event.questId} not found`);
  invariant(quest.status === 'active', `Quest ${event.questId} is not active`);
  quest.status = 'abandoned';
  quest.endedAtIso = event.at;
};

export const applyQuestRewardClaimed = (
  state: Draft<CampaignState>,
  event: QuestRewardClaimedEvent,
): void => {
  const quest = state.quests[event.questId];
  invariant(quest !== undefined, `Quest ${event.questId} not found`);
  invariant(quest.status === 'completed', `Quest ${event.questId} must be completed before claiming reward`);
  invariant(!quest.rewardClaimed, `Quest ${event.questId} reward already claimed`);
  for (const beneficiaryId of event.beneficiaryCharacterIds) {
    invariant(
      state.characters[beneficiaryId] !== undefined,
      `Beneficiary ${beneficiaryId} not found`,
    );
    const beneficiary = state.characters[beneficiaryId]!;
    beneficiary.xp += quest.reward.xpPerCharacter;
  }
  if (quest.partyId !== undefined) {
    const party = state.parties[quest.partyId];
    invariant(party !== undefined, `Party ${quest.partyId} not found`);
    party.purse = addCurrency(party.purse, quest.reward.currency);
  }
  quest.rewardClaimed = true;
};

export const applyXPAwarded = (state: Draft<CampaignState>, event: XPAwardedEvent): void => {
  const character = state.characters[event.characterId];
  invariant(character !== undefined, `Character ${event.characterId} not found`);
  character.xp += event.amount;
};

export const applyMilestoneAwarded = (
  state: Draft<CampaignState>,
  event: MilestoneAwardedEvent,
): void => {
  if (event.partyId !== undefined) {
    invariant(state.parties[event.partyId] !== undefined, `Party ${event.partyId} not found`);
  }
  if (event.questId !== undefined) {
    invariant(state.quests[event.questId] !== undefined, `Quest ${event.questId} not found`);
  }
  state.milestones.push({
    kind: event.kind,
    title: event.title,
    atIso: event.at,
    partyId: event.partyId,
    questId: event.questId,
  });
};
