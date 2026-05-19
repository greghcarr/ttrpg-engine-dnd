// Slice 274 — Gloves of Swimming and Climbing sub-action gate.
//
// RAW: "While wearing these gloves, you have a Climb Speed and a Swim
// Speed equal to your walking speed, and you have Advantage on any
// Strength (Athletics) check you make to climb or swim."
//
// Pre-274 the SetAdvantage on Athletics applied unconditionally.
// This slice adds `athleticsSubAction?: 'climb' | 'swim' | 'jump' |
// 'grapple' | 'shove'` to ComputeAbilityCheckInput (mirror of slice
// 263's `sense?` field), populates the `event.athleticsSubAction`
// fact, and wires the existing SetAdvantage with a predicate gating
// on `any(eq path:event.athleticsSubAction value:climb, ...swim)`.
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

const STARTER_PACK = loadStarterPack();
const STARTER_CONTENT = resolveContent([STARTER_PACK]);

const makeGloves = (): ItemInstance =>
  ItemInstanceSchema.parse({
    id: newItemInstanceId(),
    definitionId: 'gloves-of-swimming-and-climbing',
  });

describe('Gloves of Swimming and Climbing (slice 274)', () => {
  it('advantage on Athletics when sub-action is climb', () => {
    const gloves = makeGloves();
    const wearer = buildFighter({
      STR: 16,
      inventory: [gloves.id],
      attunedInstanceIds: [gloves.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [gloves.id]: gloves },
      content: STARTER_CONTENT,
      ability: 'STR',
      skill: 'athletics',
      athleticsSubAction: 'climb',
    });
    expect(r.hasAdvantage).toBe(true);
  });

  it('advantage on Athletics when sub-action is swim', () => {
    const gloves = makeGloves();
    const wearer = buildFighter({
      STR: 16,
      inventory: [gloves.id],
      attunedInstanceIds: [gloves.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [gloves.id]: gloves },
      content: STARTER_CONTENT,
      ability: 'STR',
      skill: 'athletics',
      athleticsSubAction: 'swim',
    });
    expect(r.hasAdvantage).toBe(true);
  });

  it('no advantage on Athletics when sub-action is jump (RAW: climb / swim only)', () => {
    const gloves = makeGloves();
    const wearer = buildFighter({
      STR: 16,
      inventory: [gloves.id],
      attunedInstanceIds: [gloves.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [gloves.id]: gloves },
      content: STARTER_CONTENT,
      ability: 'STR',
      skill: 'athletics',
      athleticsSubAction: 'jump',
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('no advantage on Athletics when sub-action is grapple or shove', () => {
    const gloves = makeGloves();
    const wearer = buildFighter({
      STR: 16,
      inventory: [gloves.id],
      attunedInstanceIds: [gloves.id],
    });
    for (const sub of ['grapple', 'shove'] as const) {
      const r = computeAbilityCheck({
        character: wearer,
        itemInstances: { [gloves.id]: gloves },
        content: STARTER_CONTENT,
        ability: 'STR',
        skill: 'athletics',
        athleticsSubAction: sub,
      });
      expect(r.hasAdvantage).toBe(false);
    }
  });

  it('no advantage on Athletics when sub-action is not specified (consumer didn\'t indicate)', () => {
    const gloves = makeGloves();
    const wearer = buildFighter({
      STR: 16,
      inventory: [gloves.id],
      attunedInstanceIds: [gloves.id],
    });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [gloves.id]: gloves },
      content: STARTER_CONTENT,
      ability: 'STR',
      skill: 'athletics',
    });
    expect(r.hasAdvantage).toBe(false);
  });

  it('without Gloves attuned: no advantage even with sub-action=climb', () => {
    const gloves = makeGloves();
    const wearer = buildFighter({ STR: 16, inventory: [gloves.id] });
    const r = computeAbilityCheck({
      character: wearer,
      itemInstances: { [gloves.id]: gloves },
      content: STARTER_CONTENT,
      ability: 'STR',
      skill: 'athletics',
      athleticsSubAction: 'climb',
    });
    expect(r.hasAdvantage).toBe(false);
  });
});
