import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  AttackRolledEvent,
  DamageRolledEvent,
  WeaponLoadedEvent,
} from '../../schemas/events/attack.js';

export const applyAttackRolled = (
  _state: Draft<CampaignState>,
  _event: AttackRolledEvent,
): void => {
  // AttackRolled is a record-only resolution event; the hit/miss outcome
  // is consumed by subsequent DamageRolled + DamageApplied notification events.
};

export const applyDamageRolled = (
  _state: Draft<CampaignState>,
  _event: DamageRolledEvent,
): void => {
  // DamageRolled is a record-only resolution event; the actual HP change comes
  // via the paired DamageApplied notification event.
};

export const applyWeaponLoaded = (
  state: Draft<CampaignState>,
  event: WeaponLoadedEvent,
): void => {
  const encounter = state.encounters[event.encounterId];
  if (!encounter) return;
  const combatant = encounter.combatants.find((c) => c.combatantId === event.combatantId);
  if (!combatant) return;
  if (combatant.turnUsage.loadedWeaponsFiredThisTurn.includes(event.weaponInstanceId)) return;
  combatant.turnUsage.loadedWeaponsFiredThisTurn.push(event.weaponInstanceId);
};
