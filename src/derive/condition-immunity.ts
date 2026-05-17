import type { CampaignState } from '../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../content/pack.js';
import { buildEffectStack } from './effect-stack.js';
import { getCreatureType } from './creature-type.js';

// Looks up whether the named target is immune to the named condition,
// folding in every source of `GrantConditionImmunity` on their effect
// stack (class features, feats, applied conditions including aura
// projections, items, resolved choices). Planners that emit
// `ConditionApplied` should call this before staging the event and
// skip it when the target is immune; this is the engine-side gate for
// features like Aura of Courage (Frightened immunity) and Protection
// from Poison (poisoned immunity).
//
// When `sourceCharacterId` is supplied, source-gated immunity entries
// (Protection from Evil and Good's charmed / frightened arm gated on
// the source being one of six creature types) can resolve. The
// helper builds a `sourceCreatureType` fact from the source's
// `getCreatureType` and passes it to `hasConditionImmunity`; entries
// without a predicate ignore the facts and apply unconditionally as
// before. Callers without a source pass `sourceCharacterId: undefined`
// and source-gated entries silently drop.
export const isImmuneToCondition = (input: {
  readonly state: CampaignState;
  readonly content: ResolvedContent;
  readonly targetId: string;
  readonly conditionId: string;
  readonly sourceCharacterId?: string;
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
  let sourceFacts: ReadonlyMap<string, unknown> | undefined;
  if (input.sourceCharacterId !== undefined) {
    const source = input.state.characters[input.sourceCharacterId];
    if (source !== undefined) {
      sourceFacts = new Map<string, unknown>([
        ['sourceCreatureType', getCreatureType(source, input.content)],
      ]);
    }
  }
  return stack.hasConditionImmunity(input.conditionId, sourceFacts);
};
