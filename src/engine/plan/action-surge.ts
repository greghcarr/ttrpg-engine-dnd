import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ResourceSpentEvent } from '../../schemas/events/resources.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';
import type { Combatant } from '../../schemas/runtime/encounter.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

const ACTION_SURGE_RESOURCE_ID = 'action-surge';

export interface ActionSurgeIntent {
  readonly type: 'ActionSurge';
  readonly combatantId: string;
  readonly at?: string;
}

const findActive = (
  state: CampaignState,
  combatantId: string,
): { encounterId: string; combatant: Combatant; activeIndex: number } => {
  const encounterId = state.activeEncounterId;
  if (encounterId === undefined) {
    throw new Error('Action Surge requires an active encounter');
  }
  const encounter = state.encounters[encounterId];
  if (!encounter || encounter.status !== 'active') {
    throw new Error('Action Surge requires an active encounter');
  }
  const active = encounter.combatants[encounter.activeIndex];
  if (!active || active.combatantId !== combatantId) {
    throw new Error('Action Surge can only be used on your own turn');
  }
  return { encounterId, combatant: active, activeIndex: encounter.activeIndex };
};

export const planActionSurge = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: ActionSurgeIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.combatantId];
  if (!character) throw new Error(`Unknown character ${intent.combatantId}`);
  const resource = character.resources.find((r) => r.resourceId === ACTION_SURGE_RESOURCE_ID);
  if (!resource || resource.current <= 0) {
    throw new Error(`${character.name} has no Action Surge available`);
  }
  const { combatant } = findActive(state, intent.combatantId);
  if (!combatant.turnUsage.actionUsed) {
    throw new Error('Action Surge is only meaningful after the Action is used');
  }

  const at = intent.at ?? nowIso();
  const spend: ResourceSpentEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ResourceSpent',
    characterId: intent.combatantId,
    resourceId: ACTION_SURGE_RESOURCE_ID,
    amount: 1,
  };
  return [spend];
};
