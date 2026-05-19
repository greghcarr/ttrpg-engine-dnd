// Slice 279 — Cloak of the Bat dim-light Stealth gate.
//
// RAW: "You have Advantage on Dexterity (Stealth) checks while
// wearing this cloak in an area of dim light or darkness." Pre-279
// the SetAdvantage applied unconditionally (broader than RAW).
// This slice adds a new `lightLevel?: 'bright' | 'dim' | 'darkness'`
// field on ComputeAbilityCheckInput, populates the
// `bearer.lightLevel` fact, and gates the existing SetAdvantage on
// `any(eq value:'dim', eq value:'darkness')`. Same opt-in semantic
// as slice 263 (sense) and slice 274 (athleticsSubAction): undefined
// means "consumer didn't specify" -> no advantage.
//
// Cloak of the Bat's fly speed + Polymorph-to-Bat arms stay deferred
// (they need the slice-242 Toggle UseAction wire + the cross-spell
// Polymorph reference).
import { describe, expect, it } from 'vitest';
import { computeAbilityCheck } from '../../../src/derive/ability-check.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../../src/schemas/runtime/item-instance.js';
import { newItemInstanceId } from '../../../src/ids.js';
import { buildFighter } from '../../fixtures/index.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const makeCloak = (): ItemInstance =>
  ItemInstanceSchema.parse({
    id: newItemInstanceId(),
    definitionId: 'cloak-of-the-bat',
  });

describe('Cloak of the Bat dim-light Stealth gate (slice 279)', () => {
  it('advantage on Stealth in dim light', () => {
    const cloak = makeCloak();
    const wearer = buildFighter({
      DEX: 16,
      inventory: [cloak.id],
      attunedInstanceIds: [cloak.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [cloak.id]: cloak },
      content: CONTENT,
      ability: 'DEX',
      skill: 'stealth',
      lightLevel: 'dim',
    });
    expect(r.hasAdvantage).toBe(true);
  });

  it('advantage on Stealth in darkness', () => {
    const cloak = makeCloak();
    const wearer = buildFighter({
      DEX: 16,
      inventory: [cloak.id],
      attunedInstanceIds: [cloak.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [cloak.id]: cloak },
      content: CONTENT,
      ability: 'DEX',
      skill: 'stealth',
      lightLevel: 'darkness',
    });
    expect(r.hasAdvantage).toBe(true);
  });

  it('no advantage on Stealth in bright light (RAW: dim or darkness only)', () => {
    const cloak = makeCloak();
    const wearer = buildFighter({
      DEX: 16,
      inventory: [cloak.id],
      attunedInstanceIds: [cloak.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [cloak.id]: cloak },
      content: CONTENT,
      ability: 'DEX',
      skill: 'stealth',
      lightLevel: 'bright',
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('no advantage on Stealth when light level is not specified (opt-in semantic)', () => {
    const cloak = makeCloak();
    const wearer = buildFighter({
      DEX: 16,
      inventory: [cloak.id],
      attunedInstanceIds: [cloak.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [cloak.id]: cloak },
      content: CONTENT,
      ability: 'DEX',
      skill: 'stealth',
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('no advantage on non-Stealth skills even in dim light (gate is per-skill)', () => {
    const cloak = makeCloak();
    const wearer = buildFighter({
      DEX: 16,
      inventory: [cloak.id],
      attunedInstanceIds: [cloak.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [cloak.id]: cloak },
      content: CONTENT,
      ability: 'DEX',
      skill: 'acrobatics',
      lightLevel: 'dim',
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('without Cloak attuned: no advantage even in dim light', () => {
    const cloak = makeCloak();
    const wearer = buildFighter({ DEX: 16, inventory: [cloak.id] });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [cloak.id]: cloak },
      content: CONTENT,
      ability: 'DEX',
      skill: 'stealth',
      lightLevel: 'dim',
    });
    expect(r.hasAdvantage).toBe(false);
  });
});
