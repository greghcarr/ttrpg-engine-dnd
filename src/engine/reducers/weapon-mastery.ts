import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { WeaponMasteryActivatedEvent } from '../../schemas/events/weapon-mastery.js';
import { invariant } from '../../internal/invariants.js';

export const applyWeaponMasteryActivated = (
  state: Draft<CampaignState>,
  event: WeaponMasteryActivatedEvent,
): void => {
  invariant(
    state.characters[event.attackerId] !== undefined,
    `Attacker ${event.attackerId} not found`,
  );
  invariant(
    state.itemInstances[event.weaponInstanceId] !== undefined,
    `Weapon ${event.weaponInstanceId} not found`,
  );
  if (event.targetId !== undefined) {
    invariant(
      state.characters[event.targetId] !== undefined,
      `Target ${event.targetId} not found`,
    );
  }
};
