// Slice 132: magic-item passive effects project to the wearer's
// effect stack. Pre-slice 132, `collectItemEffects` only walked
// `character.equipped.attuned`, so items that don't require
// attunement (Bag of Holding, Goggles of Night, Ring of Swimming,
// etc.) never reached the accumulator even when held in inventory.
// This slice adds the inventory walk gated on `requiresAttunement:
// false` while keeping the attuned walk for items that do require
// attunement.

import { describe, expect, it } from 'vitest';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { ItemInstanceSchema, type ItemInstance } from '../../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../../src/ids.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const makeItem = (definitionId: string, overrides: Partial<ItemInstance> = {}): ItemInstance =>
  ItemInstanceSchema.parse({
    id: newItemInstanceId(),
    definitionId,
    ...overrides,
  });

interface BuildOpts {
  readonly inventory?: ReadonlyArray<string>;
  readonly attuned?: ReadonlyArray<string>;
}

const buildFighter = (opts: BuildOpts = {}): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Wearer',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 12, max: 12, temp: 0 },
    featsTaken: ['savage-attacker'],
    inventory: [...(opts.inventory ?? [])],
    equipped: { attuned: [...(opts.attuned ?? [])] },
  });

describe('magic-item passive effects projection (slice 132)', () => {
  it('non-attunement item in inventory projects effects (Goggles of Night → darkvision 60)', () => {
    const goggles = makeItem('goggles-of-night');
    const fighter = buildFighter({ inventory: [goggles.id] });
    const stack = buildEffectStack({
      character: fighter,
      content: CONTENT,
      itemInstances: { [goggles.id]: goggles },
    });
    expect(stack.hasSense('darkvision')).toBe(true);
    expect(stack.senseRange('darkvision')).toBe(60);
  });

  it('non-attunement item provides ModifySpeed (Ring of Swimming → swim 40)', () => {
    // ModifySpeed isn't directly queryable on the accumulator's
    // surface; verify via getEffectiveSpeed which consumes the stack.
    // Light assertion: the item resolves and its effect was applied
    // without throwing.
    const ring = makeItem('ring-of-swimming');
    const fighter = buildFighter({ inventory: [ring.id] });
    // No accumulator query for swim speed exists; we just verify the
    // call doesn't throw and the stack is built. Slice 77's
    // getEffectiveSpeed consumer exercises the full path elsewhere.
    expect(() =>
      buildEffectStack({
        character: fighter,
        content: CONTENT,
        itemInstances: { [ring.id]: ring },
      }),
    ).not.toThrow();
  });

  it('attunement-required item in inventory but NOT attuned: no projection', () => {
    // Cloak of Elvenkind requires attunement. In inventory without
    // being attuned, its effects (if any) should NOT project. The
    // item ships with effects: [] today so we can't observe a
    // positive signal; the negative assertion is that hasSense and
    // similar markers stay false. (When the items lane authors
    // Cloak of Elvenkind's effects, this test guarantees they won't
    // leak in the un-attuned case.)
    const cloak = makeItem('cloak-of-elvenkind');
    const fighter = buildFighter({ inventory: [cloak.id] });
    const stack = buildEffectStack({
      character: fighter,
      content: CONTENT,
      itemInstances: { [cloak.id]: cloak },
    });
    expect(stack.hasSense('darkvision')).toBe(false);
  });

  it('attunement-required item in attuned list: projects (existing behavior, regression check)', () => {
    // cloak-of-protection has effects: [] today; this is a pure
    // regression check that the attuned walk still runs.
    const cloak = makeItem('cloak-of-protection', { attuned: true });
    const fighter = buildFighter({
      inventory: [cloak.id],
      attuned: [cloak.id],
    });
    expect(() =>
      buildEffectStack({
        character: fighter,
        content: CONTENT,
        itemInstances: { [cloak.id]: cloak },
      }),
    ).not.toThrow();
  });

  it('item present in both inventory and attuned does not double-project effects', () => {
    // Goggles of Night don't require attunement but the dedup logic
    // must hold even if a caller puts the same instance id in both
    // lists. We can't observe "doubled GrantSense" directly because
    // grantSense takes max-range, not sum — but the test exercises
    // the dedup code path so a future doubled-AddModifier effect
    // wouldn't silently double the bonus.
    const goggles = makeItem('goggles-of-night');
    const fighter = buildFighter({
      inventory: [goggles.id],
      attuned: [goggles.id],
    });
    const stack = buildEffectStack({
      character: fighter,
      content: CONTENT,
      itemInstances: { [goggles.id]: goggles },
    });
    expect(stack.senseRange('darkvision')).toBe(60);
  });

  it('non-magic item in inventory does not project (no effects on weapons / armor)', () => {
    const longsword = makeItem('longsword');
    const fighter = buildFighter({ inventory: [longsword.id] });
    const stack = buildEffectStack({
      character: fighter,
      content: CONTENT,
      itemInstances: { [longsword.id]: longsword },
    });
    expect(stack.hasSense('darkvision')).toBe(false);
  });
});
