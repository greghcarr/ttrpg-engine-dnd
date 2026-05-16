import type { CampaignState } from '../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../content/pack.js';
import { buildEffectStack } from './effect-stack.js';

// Looks up whether the named target is immune to the named condition,
// folding in every source of `GrantConditionImmunity` on their effect
// stack (class features, feats, applied conditions including aura
// projections, items, resolved choices). Planners that emit
// `ConditionApplied` should call this before staging the event and
// skip it when the target is immune; this is the engine-side gate for
// features like Aura of Courage (Frightened immunity) and Protection
// from Poison (poisoned immunity).
//
// The `characters` map is threaded through so condition-sourced
// immunities with `sourceCharacterId` links resolve their formulas
// (currently a no-op for immunity since `GrantConditionImmunity` is
// numeric-free, but kept symmetric with other derive entry points so
// future source-relative immunity grants behave consistently).
export const isImmuneToCondition = (input: {
  readonly state: CampaignState;
  readonly content: ResolvedContent;
  readonly targetId: string;
  readonly conditionId: string;
}): boolean => {
  const target = input.state.characters[input.targetId];
  if (target === undefined) return false;
  const stack = buildEffectStack({
    character: target,
    content: input.content,
    itemInstances: input.state.itemInstances,
    pendingChoices: input.state.pendingChoices,
    characters: input.state.characters,
  });
  return stack.hasConditionImmunity(input.conditionId);
};
