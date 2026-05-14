import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ResourceSpentEvent } from '../../schemas/events/resources.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

const SORCERY_POINTS_RESOURCE_ID = 'sorcery-points';

export const METAMAGIC_OPTIONS = [
  'careful',
  'distant',
  'empowered',
  'extended',
  'heightened',
  'quickened',
  'subtle',
  'twinned',
  'seeking',
] as const;
export type MetamagicOption = (typeof METAMAGIC_OPTIONS)[number];

// RAW 2024 sorcery-point costs per option.
const METAMAGIC_COST: Readonly<Record<MetamagicOption, number>> = {
  careful: 1,
  distant: 1,
  empowered: 1,
  extended: 1,
  heightened: 3,
  quickened: 2,
  subtle: 1,
  twinned: 1,
  seeking: 1,
};

export interface MetamagicIntent {
  readonly type: 'Metamagic';
  readonly sorcererId: string;
  readonly option: MetamagicOption;
  readonly at?: string;
}

// Sorcerer L2/L3 Metamagic. Spends the appropriate number of sorcery
// points and emits a `ResourceSpent` event. The actual modification of
// the spell being cast (doubled range, twinned target, etc.) is
// consumer-driven for now: this planner records the intent and the
// resource expenditure; consumers thread the option's effect into
// their cast-spell sequence (e.g. doubling the targetIds list for
// Twinned, swapping the cast time to bonus action for Quickened).
//
// Future slice can wire each option's mechanical effect into
// `planCastSpell` directly.
export const planMetamagic = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: MetamagicIntent,
): ReadonlyArray<Event> => {
  const sorcerer = state.characters[intent.sorcererId];
  if (!sorcerer) throw new Error(`Unknown sorcerer ${intent.sorcererId}`);
  const cost = METAMAGIC_COST[intent.option];
  const sp = sorcerer.resources.find((r) => r.resourceId === SORCERY_POINTS_RESOURCE_ID);
  if (!sp || sp.current < cost) {
    throw new Error(
      `${sorcerer.name} needs ${cost} Sorcery Point(s) for ${intent.option} Spell (has ${sp?.current ?? 0})`,
    );
  }
  const at = intent.at ?? nowIso();
  const spend: ResourceSpentEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ResourceSpent',
    characterId: intent.sorcererId,
    resourceId: SORCERY_POINTS_RESOURCE_ID,
    amount: cost,
  };
  return [spend];
};
