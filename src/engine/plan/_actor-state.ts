// Shared actor-state guards.
//
// RAW 2024 PHB Appendix "Conditions" puts several conditions in a
// blocking posture: an Incapacitated creature can't take Actions,
// Bonus Actions, or Reactions. Stunned / Paralyzed / Petrified /
// Unconscious all RAW-include Incapacitated as part of their
// definitions, so they're action-blocking too.
//
// HP at 0 is also treated as Unconscious by the engine even when the
// 'unconscious' condition entry isn't explicitly applied (see
// src/engine/reducers/combat.ts which uses `hp.current <= 0` as the
// proxy for "downed"). This module mirrors that convention.
//
// The Restrained and Grappled conditions zero out a creature's speed.
// They don't block actions, only movement, so they're handled by
// `getEffectiveSpeed` rather than `assertActorCanAct`.

import type { Character } from '../../schemas/runtime/character.js';
import type { ItemInstance } from '../../schemas/runtime/item-instance.js';
import type { PendingChoice } from '../../schemas/runtime/pending-choice.js';
import type { ResolvedContent } from '../../content/pack.js';
import { collectEffectsFromCharacter } from '../../derive/effect-stack.js';

const ACTION_BLOCKING_CONDITIONS: ReadonlySet<string> = new Set([
  'incapacitated',
  'stunned',
  'paralyzed',
  'petrified',
  'unconscious',
]);

/**
 * Returns the id of the first action-blocking condition the character
 * carries, or `'unconscious'` (synthetic) if their HP has dropped to 0,
 * or `undefined` if they can act.
 */
export const findActorBlockingCondition = (character: Character): string | undefined => {
  if (character.hp.current <= 0) return 'unconscious';
  const blocker = character.appliedConditions.find((c) => ACTION_BLOCKING_CONDITIONS.has(c.conditionId));
  return blocker?.conditionId;
};

/**
 * Throws if the character is in any action-blocking condition. The
 * `actionLabel` is interpolated into the error message so the surface
 * reads naturally ("Alyx cannot Attack while Stunned"). Every planner
 * that lets a character do something on their turn must call this
 * before doing any work; missing the call is the bug class the audit
 * at tests/audit/raw-compliance.test.ts probes for.
 */
export const assertActorCanAct = (character: Character, actionLabel: string): void => {
  const blocker = findActorBlockingCondition(character);
  if (blocker !== undefined) {
    throw new Error(
      `${character.name} cannot ${actionLabel} while ${blocker.charAt(0).toUpperCase()}${blocker.slice(1)}`,
    );
  }
};

export interface GetEffectiveSpeedInput {
  readonly character: Character;
  readonly content: ResolvedContent;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly pendingChoices?: Readonly<Record<string, PendingChoice>>;
}

/**
 * Effective walking speed in feet. Walks the character's full effect
 * stack (class features, feats, items, conditions, resolved choices)
 * and applies every `ModifySpeed { mode: 'walk' }` entry per RAW:
 *
 *   1. Start from `character.speedFeet` (the species / archetype base).
 *   2. Sum all `op: 'add'` entries (Fast Movement +10, Unarmored
 *      Movement +10, Roving +5 etc. stack additively per RAW).
 *   3. If any `op: 'set'` to 0 is present (Grappled / Restrained /
 *      Paralyzed / Petrified / Unconscious all carry it), the speed
 *      is 0 regardless of other modifiers — zero-speed wins.
 *   4. Otherwise, if any `op: 'set'` to a non-zero value is present,
 *      use the highest set value (a positive "set" represents a
 *      replacement speed like Phantom Steed's 100 ft).
 *   5. Apply the largest `op: 'multiply'` (RAW: doubling effects
 *      don't stack — take the highest). Haste's ×2 lands here.
 *   6. Floor and clamp to >= 0.
 */
export const getEffectiveSpeed = (input: GetEffectiveSpeedInput): number => {
  const { character, content, itemInstances, pendingChoices } = input;
  const effects = collectEffectsFromCharacter({ character, content, itemInstances, pendingChoices });
  let addSum = 0;
  let highestSet: number | undefined;
  let zeroSet = false;
  let highestMultiplier = 1;
  for (const e of effects) {
    if (e.kind !== 'ModifySpeed') continue;
    if (e.mode !== 'walk') continue;
    if (e.op === 'add') {
      addSum += e.value;
    } else if (e.op === 'set') {
      if (e.value === 0) zeroSet = true;
      else if (highestSet === undefined || e.value > highestSet) highestSet = e.value;
    } else if (e.op === 'multiply') {
      if (e.value > highestMultiplier) highestMultiplier = e.value;
    }
  }
  if (zeroSet) return 0;
  const natural = highestSet ?? character.speedFeet + addSum;
  const scaled = Math.floor(natural * highestMultiplier);
  return Math.max(0, scaled);
};

export { ACTION_BLOCKING_CONDITIONS };
