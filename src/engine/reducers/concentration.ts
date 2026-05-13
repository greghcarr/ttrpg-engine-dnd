import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  ConcentrationBrokenEvent,
  ConcentrationStartedEvent,
} from '../../schemas/events/concentration.js';
import { invariant } from '../../internal/invariants.js';

export const applyConcentrationStarted = (
  state: Draft<CampaignState>,
  event: ConcentrationStartedEvent,
): void => {
  const caster = state.characters[event.casterId];
  invariant(caster !== undefined, `Caster ${event.casterId} not found`);
  invariant(
    state.effectInstances[event.effectInstanceId] === undefined,
    `EffectInstance ${event.effectInstanceId} already exists`,
  );
  state.effectInstances[event.effectInstanceId] = {
    id: event.effectInstanceId,
    spellId: event.spellId,
    casterId: event.casterId,
    targetIds: [...event.targetIds],
    conditionsApplied: [...event.conditionsApplied],
    requiresConcentration: true,
    ...(event.durationRounds !== undefined ? { durationRounds: event.durationRounds } : {}),
    ...(event.durationMinutes !== undefined
      ? {
          durationMinutes: event.durationMinutes,
          startedAtMinutes: state.inGameTime.totalMinutes,
        }
      : {}),
    startedAtEventId: event.id,
  };
  caster.concentrationEffectId = event.effectInstanceId;
};

export const applyConcentrationBroken = (
  state: Draft<CampaignState>,
  event: ConcentrationBrokenEvent,
): void => {
  const effect = state.effectInstances[event.effectInstanceId];
  invariant(effect !== undefined, `EffectInstance ${event.effectInstanceId} not found`);
  const caster = state.characters[effect.casterId];
  for (const applied of effect.conditionsApplied) {
    const target = state.characters[applied.targetId];
    if (!target) continue;
    target.appliedConditions = target.appliedConditions.filter(
      (c) => c.id !== applied.appliedConditionId,
    );
  }
  if (caster?.concentrationEffectId === event.effectInstanceId) {
    caster.concentrationEffectId = undefined;
  }
  delete state.effectInstances[event.effectInstanceId];
};
