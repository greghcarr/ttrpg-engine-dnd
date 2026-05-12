import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { DowntimeActivityResolvedEvent } from '../../schemas/events/downtime.js';
import { invariant } from '../../internal/invariants.js';

export const applyDowntimeActivityResolved = (
  state: Draft<CampaignState>,
  event: DowntimeActivityResolvedEvent,
): void => {
  invariant(
    state.characters[event.characterId] !== undefined,
    `Character ${event.characterId} not found`,
  );
  state.downtimeLog.push({
    characterId: event.characterId,
    kind: event.kind,
    days: event.days,
    outcome: event.outcome,
    summary: event.summary,
    atIso: event.at,
    producedItemDefinitionId: event.producedItemDefinitionId,
    toolProficiencyGained: event.toolProficiencyGained,
  });
  if (event.toolProficiencyGained !== undefined) {
    const existing = state.toolProficienciesByCharacter[event.characterId] ?? [];
    if (!existing.includes(event.toolProficiencyGained)) {
      state.toolProficienciesByCharacter[event.characterId] = [
        ...existing,
        event.toolProficiencyGained,
      ];
    }
  }
};
