import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  SpellCounteredEvent,
  SpellDispelledEvent,
  ItemIdentifiedEvent,
} from '../../schemas/events/reactive-spells.js';
import { invariant } from '../../internal/invariants.js';

export const applySpellCountered = (
  _state: Draft<CampaignState>,
  _event: SpellCounteredEvent,
): void => {
  // Record-only: the original spell's slot was already consumed by
  // SpellSlotConsumed. The spell's effects are simply not applied; this
  // event documents the counter for replay / narrative.
};

export const applySpellDispelled = (
  state: Draft<CampaignState>,
  event: SpellDispelledEvent,
): void => {
  const effect = state.effectInstances[event.effectInstanceId];
  invariant(effect !== undefined, `EffectInstance ${event.effectInstanceId} not found`);
  invariant(
    state.characters[event.dispelledByCharacterId] !== undefined,
    `Caster ${event.dispelledByCharacterId} not found`,
  );
  for (const applied of effect.conditionsApplied) {
    const target = state.characters[applied.targetId];
    if (!target) continue;
    target.appliedConditions = target.appliedConditions.filter(
      (c) => c.id !== applied.appliedConditionId,
    );
  }
  const caster = state.characters[effect.casterId];
  if (caster?.concentrationEffectId === event.effectInstanceId) {
    caster.concentrationEffectId = undefined;
  }
  delete state.effectInstances[event.effectInstanceId];
};

export const applyItemIdentified = (
  state: Draft<CampaignState>,
  event: ItemIdentifiedEvent,
): void => {
  const item = state.itemInstances[event.itemInstanceId];
  invariant(item !== undefined, `Item ${event.itemInstanceId} not found`);
  invariant(
    state.characters[event.identifiedByCharacterId] !== undefined,
    `Identifier ${event.identifiedByCharacterId} not found`,
  );
  if (!item.identifiedByCharacterIds.includes(event.identifiedByCharacterId)) {
    item.identifiedByCharacterIds.push(event.identifiedByCharacterId);
  }
};
