import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ResourceSpentEvent } from '../../schemas/events/resources.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

const WILD_SHAPE_RESOURCE_ID = 'wild-shape';

export interface WildCompanionIntent {
  readonly type: 'WildCompanion';
  readonly druidId: string;
  readonly at?: string;
}

// Druid L2 Wild Companion. Expends one Wild Shape charge in place of
// summoning a Familiar (Find Familiar at the lowest level, no slot
// consumed). The Familiar itself isn't a first-class entity in the
// engine yet, so this slice only handles the resource expenditure
// side: a consumer that wants to track the familiar as a separate
// creature emits the appropriate CharacterCreated event themselves.
export const planWildCompanion = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: WildCompanionIntent,
): ReadonlyArray<Event> => {
  const druid = state.characters[intent.druidId];
  if (!druid) throw new Error(`Unknown druid ${intent.druidId}`);
  const druidClass = druid.classes.find((c) => c.classId === 'druid');
  if (!druidClass || druidClass.level < 2) {
    throw new Error(`Wild Companion requires druid level 2+`);
  }
  const pool = druid.resources.find((r) => r.resourceId === WILD_SHAPE_RESOURCE_ID);
  if (!pool || pool.current < 1) {
    throw new Error(`${druid.name} has no Wild Shape uses to expend`);
  }
  const at = intent.at ?? nowIso();
  const spend: ResourceSpentEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ResourceSpent',
    characterId: intent.druidId,
    resourceId: WILD_SHAPE_RESOURCE_ID,
    amount: 1,
  };
  return [spend];
};
