// Character-creator wizard state + reducer.
//
// One state shape covers every step of the wizard. The reducer is the
// only place state mutates; step components dispatch typed actions.
// Validation per step lives next to the reducer so the orchestrator
// can ask "can I move on from this step?" without each step knowing
// the rules in two places.

import { ABILITY_SCORES, type AbilityScore } from 'ttrpg-engine-dnd';
import { getSpellCounts, isCaster } from './spell-rules';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

// Point-buy (PHB 2024): 27 points, each score 8-15, cost per score
// listed in POINT_BUY_COST. All eight values are present so the UI
// can look up any value the score might reach.
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
export const POINT_BUY_COST: Readonly<Record<number, number>> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export type AbilityMode = 'standard-array' | 'point-buy' | 'manual-roll';

export type Step = 'class' | 'origin' | 'abilities' | 'spells' | 'identity' | 'review';

export const STEP_ORDER: ReadonlyArray<Step> = [
  'class',
  'origin',
  'abilities',
  'spells',
  'identity',
  'review',
];

export const STEP_LABELS: Readonly<Record<Step, string>> = {
  class: 'Class',
  origin: 'Origin',
  abilities: 'Ability scores',
  spells: 'Spells',
  identity: 'Identity',
  review: 'Review',
};

export interface CreatorState {
  readonly step: Step;
  readonly classId: string | null;
  readonly speciesId: string | null;
  readonly backgroundId: string | null;
  readonly bgPrimaryAbility: AbilityScore | null;
  readonly bgSecondaryAbility: AbilityScore | null;
  readonly abilityMode: AbilityMode;
  // Standard array + manual roll share the same "assign-from-pool"
  // shape: each ability gets one value drawn from the active pool.
  // Standard array's pool is STANDARD_ARRAY; manual roll's pool is
  // `rolledValues` (which stays null until the user rolls).
  readonly arrayAssignment: Readonly<Record<AbilityScore, number | null>>;
  readonly rolledValues: ReadonlyArray<number> | null;
  // Point-buy: direct integer score per ability in [POINT_BUY_MIN,
  // POINT_BUY_MAX]. Reducer keeps total cost within budget.
  readonly pointBuyScores: Readonly<Record<AbilityScore, number>>;
  readonly cantrips: ReadonlyArray<string>;
  readonly preparedSpells: ReadonlyArray<string>;
  readonly name: string;
}

const emptyAssignment = (): Record<AbilityScore, number | null> => ({
  STR: null,
  DEX: null,
  CON: null,
  INT: null,
  WIS: null,
  CHA: null,
});

const startingPointBuy = (): Record<AbilityScore, number> => ({
  STR: POINT_BUY_MIN,
  DEX: POINT_BUY_MIN,
  CON: POINT_BUY_MIN,
  INT: POINT_BUY_MIN,
  WIS: POINT_BUY_MIN,
  CHA: POINT_BUY_MIN,
});

export const initialState: CreatorState = {
  step: 'class',
  classId: null,
  speciesId: null,
  backgroundId: null,
  bgPrimaryAbility: null,
  bgSecondaryAbility: null,
  abilityMode: 'standard-array',
  arrayAssignment: emptyAssignment(),
  rolledValues: null,
  pointBuyScores: startingPointBuy(),
  cantrips: [],
  preparedSpells: [],
  name: '',
};

export type CreatorAction =
  | { type: 'set-step'; step: Step }
  | { type: 'set-class'; classId: string }
  | { type: 'set-species'; speciesId: string }
  | { type: 'set-background'; backgroundId: string }
  | { type: 'set-bg-ability'; slot: 'primary' | 'secondary'; ability: AbilityScore | null }
  | { type: 'set-ability-mode'; mode: AbilityMode }
  | { type: 'assign-array'; ability: AbilityScore; value: number | null }
  | { type: 'adjust-point-buy'; ability: AbilityScore; delta: -1 | 1 }
  | { type: 'roll-abilities' }
  | { type: 'toggle-cantrip'; spellId: string; max: number }
  | { type: 'toggle-prepared'; spellId: string; max: number }
  | { type: 'set-name'; name: string };

const stripDuplicate = (
  asn: Readonly<Record<AbilityScore, number | null>>,
  value: number | null,
): Record<AbilityScore, number | null> => {
  if (value === null) return { ...asn };
  const next: Record<AbilityScore, number | null> = { ...asn };
  for (const ab of ABILITY_SCORES) {
    if (next[ab] === value) next[ab] = null;
  }
  return next;
};

const toggleInList = (
  list: ReadonlyArray<string>,
  id: string,
  max: number,
): ReadonlyArray<string> => {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (list.length >= max) return list;
  return [...list, id];
};

// Roll 4d6, drop lowest, sum top three. Standard 5e ability roll.
const rollAbility = (): number => {
  const die = (): number => 1 + Math.floor(Math.random() * 6);
  const rolls = [die(), die(), die(), die()].sort((a, b) => b - a);
  return rolls[0]! + rolls[1]! + rolls[2]!;
};

export const reduce = (state: CreatorState, action: CreatorAction): CreatorState => {
  switch (action.type) {
    case 'set-step':
      return { ...state, step: action.step };
    case 'set-class': {
      // Changing class resets spell choices; previously-picked spells
      // may not be in the new class's list, and the counts shift.
      if (state.classId === action.classId) return state;
      return { ...state, classId: action.classId, cantrips: [], preparedSpells: [] };
    }
    case 'set-species':
      return { ...state, speciesId: action.speciesId };
    case 'set-background': {
      // Changing background resets the +2/+1 ability picks since the
      // valid options come from the new background's `options` list.
      if (state.backgroundId === action.backgroundId) return state;
      return {
        ...state,
        backgroundId: action.backgroundId,
        bgPrimaryAbility: null,
        bgSecondaryAbility: null,
      };
    }
    case 'set-bg-ability': {
      const next = { ...state };
      if (action.slot === 'primary') {
        next.bgPrimaryAbility = action.ability;
        if (action.ability !== null && state.bgSecondaryAbility === action.ability) {
          next.bgSecondaryAbility = null;
        }
      } else {
        next.bgSecondaryAbility = action.ability;
        if (action.ability !== null && state.bgPrimaryAbility === action.ability) {
          next.bgPrimaryAbility = null;
        }
      }
      return next;
    }
    case 'set-ability-mode': {
      // Switching modes wipes that mode's assignments so the user
      // can't end up in a half-set hybrid state.
      if (state.abilityMode === action.mode) return state;
      return {
        ...state,
        abilityMode: action.mode,
        arrayAssignment: emptyAssignment(),
        rolledValues: action.mode === 'manual-roll' ? null : state.rolledValues,
        pointBuyScores: action.mode === 'point-buy' ? startingPointBuy() : state.pointBuyScores,
      };
    }
    case 'assign-array': {
      // Each value in the pool is used once. Clear any other slot
      // currently holding this value before assigning.
      const cleared = stripDuplicate(state.arrayAssignment, action.value);
      cleared[action.ability] = action.value;
      return { ...state, arrayAssignment: cleared };
    }
    case 'adjust-point-buy': {
      const current = state.pointBuyScores[action.ability];
      const proposed = current + action.delta;
      if (proposed < POINT_BUY_MIN || proposed > POINT_BUY_MAX) return state;
      const proposedScores = { ...state.pointBuyScores, [action.ability]: proposed };
      if (pointBuySpent(proposedScores) > POINT_BUY_BUDGET) return state;
      return { ...state, pointBuyScores: proposedScores };
    }
    case 'roll-abilities': {
      const values = Array.from({ length: 6 }, rollAbility);
      // Re-rolling invalidates any previous assignment.
      return { ...state, rolledValues: values, arrayAssignment: emptyAssignment() };
    }
    case 'toggle-cantrip':
      return { ...state, cantrips: toggleInList(state.cantrips, action.spellId, action.max) };
    case 'toggle-prepared':
      return {
        ...state,
        preparedSpells: toggleInList(state.preparedSpells, action.spellId, action.max),
      };
    case 'set-name':
      return { ...state, name: action.name };
  }
};

// Total points spent in the point-buy budget for a candidate score set.
export const pointBuySpent = (scores: Readonly<Record<AbilityScore, number>>): number =>
  ABILITY_SCORES.reduce((acc, ab) => acc + (POINT_BUY_COST[scores[ab]] ?? 0), 0);

export const pointBuyRemaining = (scores: Readonly<Record<AbilityScore, number>>): number =>
  POINT_BUY_BUDGET - pointBuySpent(scores);

// Returns null if the step is satisfied; otherwise a user-readable
// reason. Used by the orchestrator to gate the Next button.
export const stepIssue = (state: CreatorState, step: Step): string | null => {
  switch (step) {
    case 'class':
      return state.classId ? null : 'Pick a class.';
    case 'origin': {
      if (!state.speciesId) return 'Pick a species.';
      if (!state.backgroundId) return 'Pick a background.';
      if (!state.bgPrimaryAbility) return 'Pick the +2 ability for your background.';
      if (!state.bgSecondaryAbility) return 'Pick the +1 ability for your background.';
      return null;
    }
    case 'abilities': {
      switch (state.abilityMode) {
        case 'standard-array': {
          const assigned = ABILITY_SCORES.filter((a) => state.arrayAssignment[a] !== null);
          return assigned.length < ABILITY_SCORES.length
            ? 'Assign every value from the standard array.'
            : null;
        }
        case 'point-buy': {
          const remaining = pointBuyRemaining(state.pointBuyScores);
          if (remaining > 0) return `Spend the remaining ${remaining} point(s).`;
          return null;
        }
        case 'manual-roll': {
          if (!state.rolledValues) return 'Roll your ability scores, then assign them.';
          const assigned = ABILITY_SCORES.filter((a) => state.arrayAssignment[a] !== null);
          return assigned.length < ABILITY_SCORES.length
            ? 'Assign every rolled value to an ability.'
            : null;
        }
      }
      break;
    }
    case 'spells': {
      if (!state.classId) return 'Pick a class first.';
      if (!isCaster(state.classId)) return null;
      const { cantrips, prepared } = getSpellCounts(state.classId);
      if (state.cantrips.length < cantrips) {
        return `Pick ${cantrips - state.cantrips.length} more cantrip(s).`;
      }
      if (state.preparedSpells.length < prepared) {
        return `Pick ${prepared - state.preparedSpells.length} more level-1 spell(s).`;
      }
      return null;
    }
    case 'identity':
      if (state.name.trim().length < 2) return 'Pick a name (at least 2 characters).';
      return null;
    case 'review':
      return null;
  }
};

export const isStepComplete = (state: CreatorState, step: Step): boolean =>
  stepIssue(state, step) === null;

export const nextStep = (current: Step): Step | null => {
  const idx = STEP_ORDER.indexOf(current);
  return idx >= 0 && idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1]! : null;
};

export const prevStep = (current: Step): Step | null => {
  const idx = STEP_ORDER.indexOf(current);
  return idx > 0 ? STEP_ORDER[idx - 1]! : null;
};

// Base ability scores from whichever mode is active, before any
// background bonuses are applied.
const baseAbilityScores = (state: CreatorState): Record<AbilityScore, number> => {
  if (state.abilityMode === 'point-buy') {
    return { ...state.pointBuyScores };
  }
  const out: Record<AbilityScore, number> = {
    STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0,
  };
  for (const ab of ABILITY_SCORES) {
    out[ab] = state.arrayAssignment[ab] ?? 0;
  }
  return out;
};

// Final scores = base from active mode + background +2/+1.
export const computeFinalAbilities = (
  state: CreatorState,
): Record<AbilityScore, number> => {
  const base = baseAbilityScores(state);
  const out: Record<AbilityScore, number> = { ...base };
  for (const ab of ABILITY_SCORES) {
    const bonus =
      (ab === state.bgPrimaryAbility ? 2 : 0) +
      (ab === state.bgSecondaryAbility ? 1 : 0);
    out[ab] = base[ab] + bonus;
  }
  return out;
};

export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);
