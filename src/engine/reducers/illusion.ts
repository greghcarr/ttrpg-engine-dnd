import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import { invariant } from '../../internal/invariants.js';
import type {
  IllusionCreatedEvent,
  IllusionInvestigatedEvent,
  IllusionDismissedEvent,
} from '../../schemas/events/illusions.js';

export const applyIllusionCreated = (
  draft: Draft<CampaignState>,
  event: IllusionCreatedEvent,
): void => {
  invariant(
    draft.illusions[event.illusionId] === undefined,
    `Illusion ${event.illusionId} already created`,
  );
  draft.illusions[event.illusionId] = {
    id: event.illusionId,
    label: event.label,
    location: event.location,
    kind: event.kind,
    casterId: event.casterId,
    sourceSpellId: event.sourceSpellId,
    sourceEffectInstanceId: event.sourceEffectInstanceId,
    investigationDC: event.investigationDC,
    disbelievedBy: [],
  };
};

export const applyIllusionInvestigated = (
  draft: Draft<CampaignState>,
  event: IllusionInvestigatedEvent,
): void => {
  const illusion = draft.illusions[event.illusionId];
  invariant(illusion !== undefined, `Illusion ${event.illusionId} not found`);
  if (!event.success) return;
  if (illusion.disbelievedBy.includes(event.investigatorId)) return;
  illusion.disbelievedBy.push(event.investigatorId);
};

export const applyIllusionDismissed = (
  draft: Draft<CampaignState>,
  event: IllusionDismissedEvent,
): void => {
  invariant(
    draft.illusions[event.illusionId] !== undefined,
    `Illusion ${event.illusionId} not found`,
  );
  delete draft.illusions[event.illusionId];
};
