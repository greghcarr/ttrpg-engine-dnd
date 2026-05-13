import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ConcentrationBrokenEvent } from '../../schemas/events/concentration.js';
import type { SaveRolledEvent } from '../../schemas/events/checks.js';
import type { DamageComponent } from '../../schemas/events/combat.js';
import type { Character } from '../../schemas/runtime/character.js';
import type { RNG } from '../../rng/index.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { computeSavingThrow } from '../../derive/save.js';
import { D20_SIDES } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

const CONCENTRATION_MIN_DC = 10;
const CONCENTRATION_DC_DIVISOR = 2;

const totalOfComponents = (components: ReadonlyArray<DamageComponent>): number =>
  components.reduce((sum, c) => sum + c.amount, 0);

/**
 * Predicts whether the given mitigated damage will reduce the target's
 * current HP to zero or below, after temp HP absorbs first. Mirrors the
 * arithmetic in applyDamageApplied so the planner can decide what
 * follow-on events to emit before the reducer runs.
 */
const damageWouldDropTo0 = (
  target: Character,
  mitigated: ReadonlyArray<DamageComponent>,
): boolean => {
  if (target.hp.current <= 0) return false;
  const total = totalOfComponents(mitigated);
  if (total <= 0) return false;
  const afterTemp = Math.max(0, total - target.hp.temp);
  return target.hp.current - afterTemp <= 0;
};

/**
 * RAW 2024 PHB ch.7: falling unconscious ends concentration immediately.
 * If `target` is concentrating and the `mitigated` damage would drop it
 * to 0 HP, emit `ConcentrationBroken` so its effects clear in the same
 * event chain as the damage that downed it.
 *
 * Returns at most one event. Callers append it after `DamageApplied`.
 */
export const planConcentrationBreakOnDrop = (
  target: Character,
  mitigated: ReadonlyArray<DamageComponent>,
  causedByEventId: ULID,
  at: string,
): ReadonlyArray<Event> => {
  if (target.concentrationEffectId === undefined) return [];
  if (!damageWouldDropTo0(target, mitigated)) return [];
  const broken: ConcentrationBrokenEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ConcentrationBroken',
    effectInstanceId: target.concentrationEffectId,
    casterId: target.id as ULID,
    reason: 'unconscious',
    causedByEventId,
  };
  return [broken];
};

export interface CheckConcentrationIntent {
  readonly type: 'CheckConcentration';
  readonly characterId: string;
  readonly damageTaken: number;
  readonly at?: string;
}

const concentrationDC = (damageTaken: number): number =>
  Math.max(CONCENTRATION_MIN_DC, Math.floor(damageTaken / CONCENTRATION_DC_DIVISOR));

export const planCheckConcentration = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: CheckConcentrationIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  if (character.concentrationEffectId === undefined) {
    return [];
  }
  if (intent.damageTaken <= 0) {
    return [];
  }

  const at = intent.at ?? nowIso();
  const dc = concentrationDC(intent.damageTaken);
  const saveDerivation = computeSavingThrow({
    character,
    itemInstances: state.itemInstances,
    content,
    ability: 'CON',
  });
  const d20 = rollDie(D20_SIDES, rng);
  const total = d20 + saveDerivation.total;
  const success = total >= dc;

  const save: SaveRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SaveRolled',
    targetId: intent.characterId as ULID,
    ability: 'CON',
    dc,
    d20: [d20],
    used: 'none',
    bonus: saveDerivation.total,
    total,
    success,
    breakdown: [...saveDerivation.breakdown],
  };
  const events: Event[] = [save];

  if (!success) {
    const broken: ConcentrationBrokenEvent = {
      id: newEventId() as ULID,
      at,
      type: 'ConcentrationBroken',
      effectInstanceId: character.concentrationEffectId,
      casterId: intent.characterId as ULID,
      reason: 'failedSave',
      causedByEventId: save.id,
    };
    events.push(broken);
  }
  return events;
};

export interface ExpireSpellDurationsIntent {
  readonly type: 'ExpireSpellDurations';
  readonly at?: string;
}

/**
 * Returns ConcentrationBroken (reason='durationEnded') events for every
 * active effect whose listed duration has elapsed by the current
 * in-game time. Consumers call this after committing an
 * InGameTimeAdvanced event so listed-duration spells (Bless 1 min,
 * Heroes' Feast 24h) clear at the right time without manual bookkeeping.
 *
 * Only effects with `durationMinutes` and `startedAtMinutes` populated
 * are considered. Instantaneous, Until dispelled, and Special spells
 * have no listed duration and never auto-expire.
 */
export const planExpireSpellDurations = (
  state: CampaignState,
  _content: ResolvedContent,
  intent: ExpireSpellDurationsIntent,
): ReadonlyArray<Event> => {
  const at = intent.at ?? nowIso();
  const now = state.inGameTime.totalMinutes;
  const events: Event[] = [];
  for (const effect of Object.values(state.effectInstances)) {
    if (effect.durationMinutes === undefined) continue;
    if (effect.startedAtMinutes === undefined) continue;
    if (now < effect.startedAtMinutes + effect.durationMinutes) continue;
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'ConcentrationBroken',
      effectInstanceId: effect.id,
      casterId: effect.casterId,
      reason: 'durationEnded',
    } satisfies ConcentrationBrokenEvent);
  }
  return events;
};
