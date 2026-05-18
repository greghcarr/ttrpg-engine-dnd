import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ResourceSpentEvent } from '../../schemas/events/resources.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { RNG } from '../../rng/index.js';
import type { ULID } from '../ids-utils.js';
import type { CasterChoice } from './cast-spell.js';
import { planCastSpell } from './cast-spell.js';
import { buildEffectStack } from '../../derive/effect-stack.js';

const DIVINE_INTERVENTION_RESOURCE_ID = 'divine-intervention';
const CLERIC_CLASS_ID = 'cleric';
const MAX_DIVINE_INTERVENTION_SPELL_LEVEL = 5;
const WISH_SPELL_ID = 'wish';

export interface DivineInterventionIntent {
  readonly type: 'DivineIntervention';
  readonly clericId: string;
  readonly spellId: string;
  readonly slotLevel: number;
  readonly targetIds: ReadonlyArray<string>;
  readonly casterChoice?: CasterChoice;
  readonly at?: string;
}

/**
 * RAW 2024 PHB Cleric L10 Divine Intervention: "As a Magic action,
 * choose any Cleric spell of level 5 or lower that doesn't require a
 * Reaction to cast. As part of the same action, you cast that spell
 * without expending a spell slot or needing Material components. You
 * can't use this feature again until you finish a Long Rest."
 *
 * The planner consumes one `divine-intervention` resource use, then
 * delegates to `planCastSpell` with `noSlotCost: true` (slice 219)
 * and `ignorePreparation: true` (slice 220) so the cleric can cast
 * any spell on the Cleric list regardless of preparation. The
 * delegated cast emits its own action-economy event matching the
 * underlying spell's casting time, which models the "as part of the
 * same action" wording: Divine Intervention IS the Magic action;
 * the cast inherits it.
 *
 * Validation:
 * - Spell exists in the content pack
 * - Spell is on the Cleric list (`spell.classes` includes 'cleric')
 * - Spell level is 5 or lower
 * - Spell's castingTime is not "Reaction"
 * - Bearer has at least 1 use of the `divine-intervention` resource
 *
 * Slice 221 wires the L20 Greater Divine Intervention Wish branch:
 * the `GrantDivineInterventionWish` marker primitive makes Wish
 * specifically eligible (overriding both the Cleric-list and
 * L5-or-lower gates). The 2d4-long-rest cooldown when Wish is the
 * chosen spell still defers; it needs a `ResourceCooldownExtended`
 * primitive that the rest reducer can honor.
 */
export const planDivineIntervention = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: DivineInterventionIntent,
): ReadonlyArray<Event> => {
  const cleric = state.characters[intent.clericId];
  if (!cleric) throw new Error(`Unknown cleric ${intent.clericId}`);

  const spell = content.spells.get(intent.spellId);
  if (!spell) throw new Error(`Unknown spell ${intent.spellId}`);

  // Slice 221: when the bearer has the GrantDivineInterventionWish
  // marker (Cleric L20 Greater Divine Intervention), Wish becomes
  // specifically eligible even though it's level 9 and not on the
  // Cleric list. Without the marker, Wish is rejected by both gates
  // below.
  const isWishCast = intent.spellId === WISH_SPELL_ID;
  const hasWishMarker = isWishCast
    ? buildEffectStack({
        character: cleric,
        content,
        itemInstances: state.itemInstances,
        pendingChoices: state.pendingChoices,
      }).hasDivineInterventionWish()
    : false;

  if (isWishCast && !hasWishMarker) {
    throw new Error(
      `${cleric.name} cannot cast Wish via Divine Intervention without Greater Divine Intervention`,
    );
  }
  if (!isWishCast && !spell.classes.includes(CLERIC_CLASS_ID)) {
    throw new Error(
      `Divine Intervention requires a Cleric spell; ${spell.name} is not on the Cleric list`,
    );
  }
  if (!isWishCast && spell.level > MAX_DIVINE_INTERVENTION_SPELL_LEVEL) {
    throw new Error(
      `Divine Intervention requires a spell of level ${MAX_DIVINE_INTERVENTION_SPELL_LEVEL} or lower; ${spell.name} is level ${spell.level}`,
    );
  }
  if (spell.castingTime.trim().toLowerCase() === 'reaction') {
    throw new Error(
      `Divine Intervention cannot cast a Reaction spell (${spell.name})`,
    );
  }

  const resource = cleric.resources.find((r) => r.resourceId === DIVINE_INTERVENTION_RESOURCE_ID);
  if (!resource || resource.current <= 0) {
    throw new Error(`${cleric.name} has no Divine Intervention uses remaining`);
  }

  const at = intent.at ?? nowIso();
  const spend: ResourceSpentEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ResourceSpent',
    characterId: intent.clericId,
    resourceId: DIVINE_INTERVENTION_RESOURCE_ID,
    amount: 1,
  };

  const castEvents = planCastSpell(state, content, rng, {
    type: 'CastSpell',
    characterId: intent.clericId,
    spellId: intent.spellId,
    slotLevel: intent.slotLevel,
    targetIds: intent.targetIds,
    castingClassId: CLERIC_CLASS_ID,
    casterChoice: intent.casterChoice,
    noSlotCost: true,
    ignorePreparation: true,
    at,
  });

  return [spend, ...castEvents];
};
