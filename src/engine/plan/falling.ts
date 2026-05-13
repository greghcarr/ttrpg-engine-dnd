import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { DamageAppliedEvent } from '../../schemas/events/combat.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import { mitigateDamage } from '../../derive/damage-mitigation.js';
import { planConcentrationBreakOnDrop } from './concentration.js';
import type { ULID } from '../ids-utils.js';

const FALLING_FEET_PER_DIE = 10;
const FALLING_DIE_AVERAGE = 3.5;
const FALLING_MAX_DICE = 20;

export interface FallingIntent {
  readonly type: 'Falling';
  readonly characterId: string;
  readonly distanceFeet: number;
  readonly at?: string;
}

const fallingDieCount = (distanceFeet: number): number =>
  Math.min(FALLING_MAX_DICE, Math.floor(distanceFeet / FALLING_FEET_PER_DIE));

const expectedFallingDamage = (distanceFeet: number): number => {
  const dice = fallingDieCount(distanceFeet);
  return Math.round(dice * FALLING_DIE_AVERAGE);
};

export const planFalling = (
  state: CampaignState,
  content: ResolvedContent,
  intent: FallingIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  if (intent.distanceFeet < 0) {
    throw new Error('Falling distance must be non-negative');
  }
  const rawDamage = expectedFallingDamage(intent.distanceFeet);
  if (rawDamage <= 0) return [];

  const mitigated = mitigateDamage({
    character,
    itemInstances: state.itemInstances,
    content,
    rawComponents: [{ amount: rawDamage, type: 'bludgeoning' }],
  });
  const at = intent.at ?? nowIso();
  const damageApplied: DamageAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'DamageApplied',
    targetId: intent.characterId,
    components: mitigated,
    source: `falling ${intent.distanceFeet} ft`,
  };
  const concentrationBreak = planConcentrationBreakOnDrop(
    character,
    mitigated,
    damageApplied.id,
    at,
  );
  return [damageApplied, ...concentrationBreak];
};
