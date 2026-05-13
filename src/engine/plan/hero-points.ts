import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { RNG } from '../../rng/index.js';
import type {
  HeroPointGrantedEvent,
  HeroPointSpentEvent,
} from '../../schemas/events/settings.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { invariant } from '../../internal/invariants.js';
import { nowIso } from '../../internal/clock.js';
import { computeTotalLevel } from '../../schemas/runtime/character.js';
import type { ULID } from '../ids-utils.js';

const HERO_POINTS_BASE = 5;
const HERO_POINT_DIE_SIDES = 6;

export interface GrantInitialHeroPointsIntent {
  readonly type: 'GrantInitialHeroPoints';
  readonly characterIds: ReadonlyArray<string>;
  readonly at?: string;
}

/**
 * DMG 2024 Hero Points variant: each PC starts with `5 + 1 per level
 * above 1` Hero Points, refreshed on each long rest. Use this planner
 * after enabling the `heroPoints` setting (or after a long rest) to
 * top everyone up. Existing point pools are *overwritten* by the
 * computed grant — the rule resets the pool rather than adding to it.
 *
 * Refuses to run if `state.settings.heroPoints` is false.
 */
export const planGrantInitialHeroPoints = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: GrantInitialHeroPointsIntent,
): ReadonlyArray<Event> => {
  invariant(
    state.settings.heroPoints === true,
    'Hero Points variant is not enabled in CampaignSettings',
  );
  const at = intent.at ?? nowIso();
  const events: Event[] = [];
  for (const id of intent.characterIds) {
    const character = state.characters[id];
    if (!character) continue;
    const target = HERO_POINTS_BASE + Math.max(0, computeTotalLevel(character) - 1);
    const delta = target - character.heroPoints;
    if (delta === 0) continue;
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'HeroPointGranted',
      characterId: id,
      amount: delta,
    } satisfies HeroPointGrantedEvent);
  }
  return events;
};

export interface SpendHeroPointIntent {
  readonly type: 'SpendHeroPoint';
  readonly characterId: string;
  readonly appliedTo?: 'attack' | 'save' | 'check' | 'stabilize';
  readonly appliedToEventId?: string;
  readonly at?: string;
}

export interface SpendHeroPointOutcome {
  readonly events: ReadonlyArray<Event>;
  readonly d6: number;
}

/**
 * Spends one Hero Point on behalf of the character. Rolls a d6 and
 * returns it in the outcome so the consumer can add it to whichever
 * d20 roll the point is augmenting. Refuses when the Hero Points
 * variant is off or the character has none remaining.
 *
 * `appliedTo`/`appliedToEventId` are surfaced on the `HeroPointSpent`
 * event for transcript clarity — the engine doesn't otherwise
 * modify the linked roll.
 */
export const planSpendHeroPoint = (
  state: CampaignState,
  _content: ResolvedContent,
  rng: RNG,
  intent: SpendHeroPointIntent,
): SpendHeroPointOutcome => {
  invariant(
    state.settings.heroPoints === true,
    'Hero Points variant is not enabled in CampaignSettings',
  );
  const character = state.characters[intent.characterId];
  invariant(character !== undefined, `Character ${intent.characterId} not found`);
  invariant(character.heroPoints >= 1, `${character.name} has no Hero Points to spend`);

  const at = intent.at ?? nowIso();
  const d6 = rollDie(HERO_POINT_DIE_SIDES, rng);
  const event: HeroPointSpentEvent = {
    id: newEventId() as ULID,
    at,
    type: 'HeroPointSpent',
    characterId: intent.characterId as ULID,
    d6,
    ...(intent.appliedTo !== undefined ? { appliedTo: intent.appliedTo } : {}),
    ...(intent.appliedToEventId !== undefined
      ? { appliedToEventId: intent.appliedToEventId as ULID }
      : {}),
  };
  return { events: [event], d6 };
};