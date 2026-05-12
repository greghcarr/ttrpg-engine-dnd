import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  BastionFoundedEvent,
  BastionFacilityAddedEvent,
  BastionHirelingAddedEvent,
  BastionTurnTakenEvent,
  BastionDamagedEvent,
  BastionLevelChangedEvent,
} from '../../schemas/events/bastion.js';
import { invariant } from '../../internal/invariants.js';

export const applyBastionFounded = (
  state: Draft<CampaignState>,
  event: BastionFoundedEvent,
): void => {
  invariant(state.bastions[event.bastionId] === undefined, `Bastion ${event.bastionId} already exists`);
  invariant(
    state.characters[event.ownerCharacterId] !== undefined,
    `Owner ${event.ownerCharacterId} not found`,
  );
  if (event.locationId !== undefined) {
    invariant(state.locations[event.locationId] !== undefined, `Location ${event.locationId} not found`);
  }
  state.bastions[event.bastionId] = {
    id: event.bastionId,
    name: event.name,
    ownerCharacterId: event.ownerCharacterId,
    locationId: event.locationId,
    level: event.level,
    facilities: [],
    hirelings: [],
    defenders: 0,
    treasuryGp: 0,
    hpCurrent: event.hpMax,
    hpMax: event.hpMax,
  };
};

export const applyBastionFacilityAdded = (
  state: Draft<CampaignState>,
  event: BastionFacilityAddedEvent,
): void => {
  const bastion = state.bastions[event.bastionId];
  invariant(bastion !== undefined, `Bastion ${event.bastionId} not found`);
  invariant(
    !bastion.facilities.some((f) => f.id === event.facilityId),
    `Facility ${event.facilityId} already exists on bastion`,
  );
  bastion.facilities.push({
    id: event.facilityId,
    name: event.name,
    kind: event.kind,
    space: event.space,
    description: event.description,
  });
};

export const applyBastionHirelingAdded = (
  state: Draft<CampaignState>,
  event: BastionHirelingAddedEvent,
): void => {
  const bastion = state.bastions[event.bastionId];
  invariant(bastion !== undefined, `Bastion ${event.bastionId} not found`);
  bastion.hirelings.push({ id: event.hirelingId, name: event.name, role: event.role });
};

export const applyBastionTurnTaken = (
  state: Draft<CampaignState>,
  event: BastionTurnTakenEvent,
): void => {
  const bastion = state.bastions[event.bastionId];
  invariant(bastion !== undefined, `Bastion ${event.bastionId} not found`);
  bastion.treasuryGp = Math.max(0, bastion.treasuryGp + event.treasuryDeltaGp);
};

export const applyBastionDamaged = (
  state: Draft<CampaignState>,
  event: BastionDamagedEvent,
): void => {
  const bastion = state.bastions[event.bastionId];
  invariant(bastion !== undefined, `Bastion ${event.bastionId} not found`);
  bastion.hpCurrent = Math.max(0, bastion.hpCurrent - event.amount);
};

export const applyBastionLevelChanged = (
  state: Draft<CampaignState>,
  event: BastionLevelChangedEvent,
): void => {
  const bastion = state.bastions[event.bastionId];
  invariant(bastion !== undefined, `Bastion ${event.bastionId} not found`);
  invariant(bastion.level === event.fromLevel, `Bastion level mismatch (expected ${event.fromLevel}, got ${bastion.level})`);
  bastion.level = event.toLevel;
};
