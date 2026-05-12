import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';
import type { ResourceSpentEvent } from '../../schemas/events/resources.js';
import { invariant } from '../../internal/invariants.js';

const ACTION_SURGE_RESOURCE_ID = 'action-surge';

export const resetActionForActionSurgeIfApplicable = (
  state: Draft<CampaignState>,
  event: ResourceSpentEvent,
): void => {
  if (event.resourceId !== ACTION_SURGE_RESOURCE_ID) return;
  const encounterId = state.activeEncounterId;
  if (encounterId === undefined) return;
  const encounter = state.encounters[encounterId];
  if (!encounter) return;
  const combatant = encounter.combatants.find((c) => c.combatantId === event.characterId);
  if (!combatant) return;
  combatant.turnUsage.actionUsed = false;
  combatant.turnUsage.attacksMadeThisTurn = 0;
};

export const applyActionEconomyConsumed = (
  state: Draft<CampaignState>,
  event: ActionEconomyConsumedEvent,
): void => {
  const encounter = state.encounters[event.encounterId];
  invariant(encounter !== undefined, `Encounter ${event.encounterId} not found`);
  const combatant = encounter.combatants.find((c) => c.combatantId === event.combatantId);
  invariant(combatant !== undefined, `Combatant ${event.combatantId} not in encounter`);

  switch (event.kind) {
    case 'action':
      invariant(!combatant.turnUsage.actionUsed, 'Action already used this turn');
      combatant.turnUsage.actionUsed = true;
      break;
    case 'bonusAction':
      invariant(
        !combatant.turnUsage.bonusActionUsed,
        'Bonus action already used this turn',
      );
      combatant.turnUsage.bonusActionUsed = true;
      break;
    case 'reaction':
      invariant(
        !combatant.turnUsage.reactionUsedThisRound,
        'Reaction already used this round',
      );
      combatant.turnUsage.reactionUsedThisRound = true;
      break;
    case 'attack':
      combatant.turnUsage.attacksMadeThisTurn += 1;
      break;
  }
};

export const resetActionForActionSurge = (
  combatant: { turnUsage: { actionUsed: boolean } },
): void => {
  combatant.turnUsage.actionUsed = false;
};
