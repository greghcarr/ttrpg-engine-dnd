// Slice 105 — thread `characters` through every derive surface so
// source-relative formulas (`sourceAbilityMod`, etc.) resolve on
// ability checks, AC, attack bonus, spell DC, action economy,
// damage mitigation. Slice 64 covered saves; this slice closes the
// rest. No PHB content in the starter pack uses source-relative
// formulas outside saves today, so verification rides on a hand-
// built test condition.

import { describe, expect, it } from 'vitest';
import {
  loadContentPack,
  resolveContent,
  type ContentPack,
} from '../../../src/content/pack.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { computeAbilityCheck } from '../../../src/derive/ability-check.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newAppliedConditionId, newCharacterId } from '../../../src/ids.js';

// A minimal pack carrying one synthetic condition whose effect adds
// `sourceAbilityMod CHA` to the target's INT ability check. Layered
// over the starter pack so the rest of the engine has the species /
// classes / spells it expects.
const TEST_OVERLAY: ContentPack = loadContentPack({
  id: 'slice-105-test',
  name: 'Slice 105 source-relative test overlay',
  version: '0.0.1',
  species: [],
  backgrounds: [],
  classes: [],
  subclasses: [],
  feats: [],
  spells: [],
  items: [],
  monsters: [],
  conditions: [
    {
      id: 'test-check-buff',
      name: 'Test Check Buff',
      description: 'Synthetic slice-105 fixture: adds source CHA mod to the target INT check.',
      stackable: false,
      endsOn: [],
      effects: [
        {
          kind: 'AddModifier',
          target: { kind: 'check', ability: 'INT' },
          value: { kind: 'sourceAbilityMod', ability: 'CHA' },
        },
      ],
    },
  ],
});

const CONTENT = resolveContent([loadStarterPack(), TEST_OVERLAY]);

const buildSource = (charisma: number): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Source',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 12, CON: 14, INT: 16, WIS: 12, CHA: charisma },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
  });

const buildTargetWithBuff = (sourceId: string): Character => {
  const target = CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Target',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
  });
  return {
    ...target,
    appliedConditions: [
      {
        id: newAppliedConditionId(),
        conditionId: 'test-check-buff',
        sourceEventId: 'seed-event-id' as ReturnType<typeof newAppliedConditionId>,
        sourceCharacterId: sourceId as ReturnType<typeof newCharacterId>,
      },
    ],
  };
};

describe('source-relative formulas on ability checks (slice 105)', () => {
  it('resolves sourceAbilityMod when characters is threaded through computeAbilityCheck', () => {
    const source = buildSource(18); // CHA mod +4
    const target = buildTargetWithBuff(source.id);
    const characters = { [source.id]: source, [target.id]: target };
    const result = computeAbilityCheck({
      character: target,
      itemInstances: {},
      content: CONTENT,
      ability: 'INT',
      characters,
    });
    const checkMod = result.breakdown.find((e) => e.source === 'check-modifier');
    expect(checkMod).toBeDefined();
    expect(checkMod!.value).toBe(4); // +CHA mod of source (18 → +4)
  });

  it('falls back to 0 when characters is omitted (source unresolved)', () => {
    const source = buildSource(18);
    const target = buildTargetWithBuff(source.id);
    const result = computeAbilityCheck({
      character: target,
      itemInstances: {},
      content: CONTENT,
      ability: 'INT',
      // characters omitted intentionally — source-relative formulas drop to 0
    });
    const checkMod = result.breakdown.find((e) => e.source === 'check-modifier');
    expect(checkMod).toBeUndefined(); // 0-value entries don't enter the breakdown
  });

  it('does not resolve when characters is supplied but the source id is missing from the map', () => {
    // Same shape as the positive case but the characters map doesn't
    // contain the source id (e.g., consumer forgot to include them).
    const source = buildSource(18);
    const target = buildTargetWithBuff(source.id);
    const result = computeAbilityCheck({
      character: target,
      itemInstances: {},
      content: CONTENT,
      ability: 'INT',
      characters: { [target.id]: target },
    });
    const checkMod = result.breakdown.find((e) => e.source === 'check-modifier');
    expect(checkMod).toBeUndefined();
  });
});
