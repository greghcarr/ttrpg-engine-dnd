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
    ...(event.slotLevel !== undefined ? { slotLevel: event.slotLevel } : {}),
    startedAtEventId: event.id,
  };
  caster.concentrationEffectId = event.effectInstanceId;
};

/**
 * Cascading cleanup for an effect that the caster is concentrating on:
 * remove any conditions the effect applied to other characters, reverse
 * hpMax bonuses contributed by those conditions, clear the caster's
 * concentration pointer, and delete the effect instance.
 *
 * Tolerates a dangling `concentrationEffectId` pointing at a missing
 * effect instance (e.g. when the damage reducer needs to defensively
 * clear concentration on a character whose effect record never got
 * registered). In that case it just clears the caster's pointer.
 */
export const clearConcentrationEffect = (
  state: Draft<CampaignState>,
  effectInstanceId: string,
): void => {
  const effect = state.effectInstances[effectInstanceId];
  if (effect === undefined) {
    // Dangling pointer: walk characters and unset any matching
    // concentrationEffectId. Cheap; the character table is small.
    for (const ch of Object.values(state.characters)) {
      if (ch.concentrationEffectId === effectInstanceId) {
        ch.concentrationEffectId = undefined;
      }
    }
    return;
  }
  const caster = state.characters[effect.casterId];
  for (const applied of effect.conditionsApplied) {
    const target = state.characters[applied.targetId];
    if (!target) continue;
    // Reverse any hpMax bonus the dropped condition contributed,
    // mirroring applyConditionRemoved.
    const entry = target.appliedConditions.find((c) => c.id === applied.appliedConditionId);
    if (entry?.hpMaxBonusDelta !== undefined && entry.hpMaxBonusDelta !== 0) {
      target.hp.maxBonus = (target.hp.maxBonus ?? 0) - entry.hpMaxBonusDelta;
    }
    target.appliedConditions = target.appliedConditions.filter(
      (c) => c.id !== applied.appliedConditionId,
    );
  }
  if (caster?.concentrationEffectId === effectInstanceId) {
    caster.concentrationEffectId = undefined;
  }
  delete state.effectInstances[effectInstanceId];
};

export const applyConcentrationBroken = (
  state: Draft<CampaignState>,
  event: ConcentrationBrokenEvent,
): void => {
  invariant(
    state.effectInstances[event.effectInstanceId] !== undefined,
    `EffectInstance ${event.effectInstanceId} not found`,
  );
  clearConcentrationEffect(state, event.effectInstanceId);
};
