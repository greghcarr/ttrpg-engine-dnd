import type { CampaignState } from '../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../content/pack.js';
import { buildEffectStack } from './effect-stack.js';

// True when the named target has any active effect that prevents them
// from regaining hit points. Heal planners consult this before
// emitting a Healed event; when blocked, they emit Healed with
// amount=0 (the reducer's amount<=0 early-return makes it a no-op)
// plus an annotation in the event's `source` field so the audit
// trail captures both intent and outcome. Used by Spirit Shroud's
// "target can't regain HP until start of caster's next turn" rider
// on `healing-blocked-active`.
export const isHealingBlocked = (input: {
  readonly state: CampaignState;
  readonly content: ResolvedContent;
  readonly targetId: string;
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
  return stack.hasHealingBlocked();
};
