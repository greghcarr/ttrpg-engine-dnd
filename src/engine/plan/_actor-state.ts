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

const ACTION_BLOCKING_CONDITIONS: ReadonlySet<string> = new Set([
  'incapacitated',
  'stunned',
  'paralyzed',
  'petrified',
  'unconscious',
]);

const SPEED_ZERO_CONDITIONS: ReadonlySet<string> = new Set([
  'restrained',
  'grappled',
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

/**
 * Effective walking speed in feet. Returns 0 if the character is
 * Restrained or Grappled (RAW Appendix Conditions: "speed becomes 0").
 * Other conditions (Prone, Exhaustion) modify speed elsewhere and are
 * not handled here.
 */
export const getEffectiveSpeed = (character: Character): number => {
  const hasZeroSpeed = character.appliedConditions.some((c) => SPEED_ZERO_CONDITIONS.has(c.conditionId));
  if (hasZeroSpeed) return 0;
  return character.speedFeet;
};

export { ACTION_BLOCKING_CONDITIONS, SPEED_ZERO_CONDITIONS };
