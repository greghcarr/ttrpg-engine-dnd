import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import { invariant } from '../../internal/invariants.js';
import type {
  BreathWeaponFiredEvent,
  BreathWeaponRechargedEvent,
} from '../../schemas/events/breath-weapon.js';

export const applyBreathWeaponFired = (
  draft: Draft<CampaignState>,
  event: BreathWeaponFiredEvent,
): void => {
  const monster = draft.characters[event.monsterId];
  invariant(monster !== undefined, `Monster ${event.monsterId} not found`);
  monster.breathWeaponExpended = true;
};

export const applyBreathWeaponRecharged = (
  draft: Draft<CampaignState>,
  event: BreathWeaponRechargedEvent,
): void => {
  const monster = draft.characters[event.monsterId];
  invariant(monster !== undefined, `Monster ${event.monsterId} not found`);
  monster.breathWeaponExpended = false;
};
