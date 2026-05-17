// Slice 129: monster statblock data (damageResistances /
// damageImmunities / damageVulnerabilities / conditionImmunities
// arrays plus the EffectSchema[] `traits` array) folds into the
// effect accumulator the same way species / class / feat / item /
// condition effects do. Without this fold every creature in the
// pack carries inert data: Skeleton's bludgeoning vulnerability
// and Young Red Dragon's fire immunity were ignored since alpha.5.

import { describe, expect, it } from 'vitest';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { mitigateDamage } from '../../../src/derive/damage-mitigation.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildCreature = (statblockId: string, name: string): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    kind: 'creature',
    name,
    statblockId,
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const buildPc = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Player',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 10, max: 10, temp: 0 },
    featsTaken: ['savage-attacker'],
  });

const stackFor = (character: Character) =>
  buildEffectStack({
    character,
    content: CONTENT,
    itemInstances: {},
  });

describe('buildEffectStack folds monster statblock data', () => {
  it('Skeleton: damageVulnerabilities array drives hasVulnerability', () => {
    // RAW Skeleton: vulnerability to bludgeoning. Inert since alpha.5
    // until slice 129. The vulnerability fold is the canonical test
    // for the GrantVulnerability synthesis path.
    const skeleton = buildCreature('skeleton', 'Skeleton A');
    const stack = stackFor(skeleton);
    expect(stack.hasVulnerability('bludgeoning')).toBe(true);
    expect(stack.hasVulnerability('slashing')).toBe(false);
  });

  it('Skeleton: damageImmunities array drives hasImmunity', () => {
    // RAW Skeleton: poison damage immunity.
    const skeleton = buildCreature('skeleton', 'Skeleton B');
    const stack = stackFor(skeleton);
    expect(stack.hasImmunity('poison')).toBe(true);
    expect(stack.hasImmunity('fire')).toBe(false);
  });

  it('Skeleton: conditionImmunities array drives hasConditionImmunity', () => {
    // RAW Skeleton: immune to exhaustion + poisoned.
    const skeleton = buildCreature('skeleton', 'Skeleton C');
    const stack = stackFor(skeleton);
    expect(stack.hasConditionImmunity('exhaustion')).toBe(true);
    expect(stack.hasConditionImmunity('poisoned')).toBe(true);
    expect(stack.hasConditionImmunity('paralyzed')).toBe(false);
  });

  it('Young Red Dragon: fire immunity wires (regression: inert since alpha.5)', () => {
    const dragon = buildCreature('young-red-dragon', 'Big Bad');
    const stack = stackFor(dragon);
    expect(stack.hasImmunity('fire')).toBe(true);
  });

  it('Specter: SRD 5.2.1 unqualified B/P/S resistance + necrotic/poison immunity folds', () => {
    // SRD 5.2.1 simplified Specter's resistance: B/P/S are now unqualified
    // (resists both magical and nonmagical sources), where 2014 had them
    // as nonmagical-only. Slice 162 added the unqualified entries to
    // damageResistances per the 2024 SRD. The pack retains the slice-112
    // nonmagical traits as redundant (a cleanup follow-up); both layers
    // produce the same observed resistance against any B/P/S source.
    const specter = buildCreature('specter', 'Haunter');
    const stack = stackFor(specter);
    expect(stack.hasResistance('bludgeoning', false)).toBe(true);
    expect(stack.hasResistance('piercing', false)).toBe(true);
    expect(stack.hasResistance('slashing', false)).toBe(true);
    expect(stack.hasResistance('bludgeoning', true)).toBe(true);
    expect(stack.hasResistance('necrotic', false)).toBe(false);
  });

  it('Specter: damageImmunities + conditionImmunities arrays co-exist with traits[]', () => {
    // The fold should add both shapes to the same accumulator without
    // either crowding out the other.
    const specter = buildCreature('specter', 'Haunter');
    const stack = stackFor(specter);
    expect(stack.hasImmunity('necrotic')).toBe(true);
    expect(stack.hasImmunity('poison')).toBe(true);
    expect(stack.hasConditionImmunity('charmed')).toBe(true);
    expect(stack.hasConditionImmunity('paralyzed')).toBe(true);
  });

  it('Imp: traits[] from batch 1.7 fold (Fiend nonmagical B/P/S)', () => {
    // Confirms the fold catches content-batch-1.7's slice-112-shaped
    // GrantResistance entries on the new Fiend statblocks.
    const imp = buildCreature('imp', 'Naughty');
    const stack = stackFor(imp);
    expect(stack.hasResistance('bludgeoning', false)).toBe(true);
    expect(stack.hasResistance('piercing', false)).toBe(true);
    expect(stack.hasResistance('slashing', false)).toBe(true);
  });

  it('PC (no statblockId): monster fold short-circuits — no monster data accidentally folded', () => {
    // The fold only fires when statblockId is set. A vanilla PC must
    // not pick up any monster data even though its `kind` is 'pc'.
    const pc = buildPc();
    const stack = stackFor(pc);
    expect(stack.hasVulnerability('bludgeoning')).toBe(false);
    expect(stack.hasImmunity('fire')).toBe(false);
    expect(stack.hasConditionImmunity('charmed')).toBe(false);
  });
});

describe('monster fold flows through mitigateDamage (end-to-end signal)', () => {
  it('Skeleton takes doubled bludgeoning damage (RAW vulnerability)', () => {
    const skeleton = buildCreature('skeleton', 'Smashable');
    const [out] = mitigateDamage({
      character: skeleton,
      itemInstances: {},
      content: CONTENT,
      rawComponents: [{ amount: 10, type: 'bludgeoning' }],
    });
    expect(out!.amount).toBe(20);
    expect(out!.mitigation).toBe('vulnerable');
  });

  it('Young Red Dragon takes zero fire damage (RAW immunity)', () => {
    const dragon = buildCreature('young-red-dragon', 'Fireproof');
    const [out] = mitigateDamage({
      character: dragon,
      itemInstances: {},
      content: CONTENT,
      rawComponents: [{ amount: 30, type: 'fire' }],
    });
    expect(out!.amount).toBe(0);
    expect(out!.mitigation).toBe('immune');
  });

  it('Imp halves nonmagical slashing damage but takes full magical slashing (traits qualifier)', () => {
    const imp = buildCreature('imp', 'Naughty');
    const [nonMagical] = mitigateDamage({
      character: imp,
      itemInstances: {},
      content: CONTENT,
      rawComponents: [{ amount: 10, type: 'slashing' }],
      sourceIsMagical: false,
    });
    expect(nonMagical!.amount).toBe(5);
    expect(nonMagical!.mitigation).toBe('resisted');
    const [magical] = mitigateDamage({
      character: imp,
      itemInstances: {},
      content: CONTENT,
      rawComponents: [{ amount: 10, type: 'slashing' }],
      sourceIsMagical: true,
    });
    expect(magical!.amount).toBe(10);
  });
});
