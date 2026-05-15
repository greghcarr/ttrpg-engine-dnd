// Per-class spell selection counts at level 1 (2024 PHB).
//
// The starter pack's class schema models *spellcasting type* (full /
// half / pact) and *ability*, but not the cantrips-known and prepared-
// spells totals per level. Those are codified here in dndbnb until
// the engine grows the analogous table. Non-casters and classes that
// gain spells at L2+ (paladin, ranger) have zero counts at L1.

import type { AbilityScore } from 'ttrpg-engine-dnd';

export interface SpellCountsL1 {
  readonly cantrips: number;
  readonly prepared: number;
}

export const SPELL_COUNTS_L1: Readonly<Record<string, SpellCountsL1>> = {
  bard: { cantrips: 2, prepared: 4 },
  cleric: { cantrips: 3, prepared: 4 },
  druid: { cantrips: 2, prepared: 4 },
  paladin: { cantrips: 0, prepared: 0 },
  ranger: { cantrips: 2, prepared: 0 },
  sorcerer: { cantrips: 4, prepared: 2 },
  warlock: { cantrips: 2, prepared: 2 },
  wizard: { cantrips: 3, prepared: 4 },
};

export const getSpellCounts = (classId: string): SpellCountsL1 =>
  SPELL_COUNTS_L1[classId] ?? { cantrips: 0, prepared: 0 };

export const isCaster = (classId: string): boolean => {
  const c = SPELL_COUNTS_L1[classId];
  return c !== undefined && (c.cantrips > 0 || c.prepared > 0);
};

// Spellcasting ability per class, mirroring the starter pack's class
// `spellcasting.ability` field but kept here for non-caster fallback.
export const SPELLCASTING_ABILITY: Readonly<Record<string, AbilityScore>> = {
  bard: 'CHA',
  cleric: 'WIS',
  druid: 'WIS',
  paladin: 'CHA',
  ranger: 'WIS',
  sorcerer: 'CHA',
  warlock: 'CHA',
  wizard: 'INT',
};
