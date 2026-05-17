import type { Character } from '../schemas/runtime/character.js';
import type { ULID } from '../engine/ids-utils.js';
import { abilityModifier } from './ability.js';

// Slice 124. Helpers for the Mirror Image deflection pool.

const MIRROR_IMAGE_CONDITION_ID = 'mirror-image-active';

// 10 + bearer DEX modifier. No other modifiers per RAW PHB 2024 —
// the duplicate is an illusion, not a real combatant with armor or
// shields.
export const DUPLICATE_AC_BASE = 10;

// RAW thresholds: with 3 duplicates roll 6+; 2 → 8+; 1 → 11+.
const THRESHOLD_AT_3 = 6;
const THRESHOLD_AT_2 = 8;
const THRESHOLD_AT_1 = 11;
const STARTING_DUPLICATES = 3;

export interface MirrorImageState {
  readonly appliedConditionId: ULID;
  readonly duplicates: number;
  readonly bearerDexMod: number;
}

export const findMirrorImage = (
  character: Character,
): MirrorImageState | undefined => {
  const cond = character.appliedConditions.find(
    (c) => c.conditionId === MIRROR_IMAGE_CONDITION_ID,
  );
  if (cond === undefined) return undefined;
  return {
    appliedConditionId: cond.id,
    duplicates: cond.level ?? STARTING_DUPLICATES,
    bearerDexMod: abilityModifier(character.abilityScores.DEX),
  };
};

export const mirrorImageThreshold = (duplicates: number): number => {
  if (duplicates >= 3) return THRESHOLD_AT_3;
  if (duplicates === 2) return THRESHOLD_AT_2;
  return THRESHOLD_AT_1;
};

export const duplicateAC = (bearerDexMod: number): number =>
  DUPLICATE_AC_BASE + bearerDexMod;
