import { describe, expect, it } from 'vitest';
import { applyEffectToBuilder, EffectAccumulator } from '../../../src/effects/builder.js';
import type { Effect } from '../../../src/schemas/effects.js';

describe('EffectAccumulator', () => {
  it('AddModifier accumulates contributions from multiple sources', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'AddModifier', target: 'ac', value: 1 },
      acc,
      { source: 'magic-cloak' },
    );
    applyEffectToBuilder(
      { kind: 'AddModifier', target: 'ac', value: 2 },
      acc,
      { source: 'ring-of-protection' },
    );
    expect(acc.modifierSum('ac')).toBe(3);
    expect(acc.modifierBreakdown('ac')).toHaveLength(2);
  });

  it('AddModifier with a formula drops silently when no formulaContext is provided', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'AddModifier',
        target: 'ac',
        value: { kind: 'const', value: 5 },
      } satisfies Effect,
      acc,
      { source: 'formula-source' },
    );
    expect(acc.modifierSum('ac')).toBe(0);
  });

  it('AddModifier with a formula evaluates when formulaContext is supplied', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'AddModifier',
        target: 'ac',
        value: { kind: 'const', value: 5 },
      } satisfies Effect,
      acc,
      {
        source: 'formula-source',
        formulaContext: {
          abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
          proficiencyBonus: 2,
          classLevels: new Map(),
          totalLevel: 1,
        },
      },
    );
    expect(acc.modifierSum('ac')).toBe(5);
  });

  it('sourceAbilityMod resolves against the formulaContext source character', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'AddModifier',
        target: { kind: 'save', ability: 'WIS' },
        value: { kind: 'sourceAbilityMod', ability: 'CHA' },
      } satisfies Effect,
      acc,
      {
        source: 'aura-source',
        formulaContext: {
          abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
          proficiencyBonus: 2,
          classLevels: new Map(),
          totalLevel: 1,
          source: {
            abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 18 },
          },
        },
      },
    );
    expect(acc.modifierSum({ kind: 'save', ability: 'WIS' })).toBe(4);
  });

  it('SetAdvantage records advantage state', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'SetAdvantage', on: { kind: 'save', ability: 'STR' }, mode: 'advantage' },
      acc,
      { source: 'x' },
    );
    expect(acc.advantageFor({ kind: 'save', ability: 'STR' }).advantage).toBe(true);
    expect(acc.advantageFor({ kind: 'save', ability: 'DEX' }).advantage).toBe(false);
  });

  it('Resistance/immunity/vulnerability are tracked correctly', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder({ kind: 'GrantResistance', damageType: 'fire' }, acc, { source: 'x' });
    expect(acc.hasResistance('fire')).toBe(true);
    expect(acc.hasResistance('cold')).toBe(false);
    applyEffectToBuilder({ kind: 'GrantResistance', damageType: 'all' }, acc, { source: 'y' });
    expect(acc.hasResistance('cold')).toBe(true);
    applyEffectToBuilder({ kind: 'GrantImmunity', damageType: 'poison' }, acc, { source: 'z' });
    expect(acc.hasImmunity('poison')).toBe(true);
    applyEffectToBuilder({ kind: 'GrantVulnerability', damageType: 'fire' }, acc, { source: 'q' });
    expect(acc.hasVulnerability('fire')).toBe(true);
  });

  it('Condition immunity tracked', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'GrantConditionImmunity', conditionId: 'frightened' },
      acc,
      { source: 'paladin-aura' },
    );
    expect(acc.hasConditionImmunity('frightened')).toBe(true);
    expect(acc.hasConditionImmunity('blinded')).toBe(false);
  });

  it('AC override is keyed by priority', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'OverrideACFormula',
        base: 10,
        abilityModifiers: ['DEX', 'CON'],
        priority: 1,
      },
      acc,
      { source: 'barbarian-unarmored' },
    );
    applyEffectToBuilder(
      {
        kind: 'OverrideACFormula',
        base: 13,
        abilityModifiers: ['DEX'],
        priority: 5,
      },
      acc,
      { source: 'mage-armor' },
    );
    expect(acc.effectiveACOverride()?.source).toBe('mage-armor');
  });

  it('Resource grants are collected', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'GrantResource',
        resourceId: 'rage',
        max: 3,
        recharge: 'longRest',
      },
      acc,
      { source: 'barbarian-1' },
    );
    expect(acc.resources()).toHaveLength(1);
    expect(acc.resources()[0]?.resourceId).toBe('rage');
  });

  it('proficiency ranking takes the highest', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'GrantProficiency',
        target: 'skill',
        id: 'arcana',
        level: 'half',
      },
      acc,
      { source: 'a' },
    );
    applyEffectToBuilder(
      {
        kind: 'GrantProficiency',
        target: 'skill',
        id: 'arcana',
        level: 'expertise',
      },
      acc,
      { source: 'b' },
    );
    expect(acc.proficiencyLevel('skill', 'arcana')).toBe('expertise');
  });

  it('unsupported effect kinds are silently ignored by the builder (other layers handle them)', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'OnEvent',
        trigger: { eventType: 'AttackResolved' },
        actions: [{ kind: 'AddDamage', dice: '1d6', damageType: 'piercing' }],
      },
      acc,
      { source: 'sneak-attack' },
    );
    expect(acc.modifierSum('ac')).toBe(0);
  });

  // Slice 127: GrantSense flows through to senseRange / hasSense.
  it('GrantSense records the sense and its range', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'GrantSense', sense: 'darkvision', range: 60 },
      acc,
      { source: 'dwarf-species' },
    );
    expect(acc.hasSense('darkvision')).toBe(true);
    expect(acc.senseRange('darkvision')).toBe(60);
    expect(acc.hasSense('blindsight')).toBe(false);
    expect(acc.senseRange('blindsight')).toBe(0);
  });

  // Slice 131: GrantMagicResistance is a marker; the accumulator
  // tracks the flag and consumers (computeSavingThrow) decide what to
  // do with it based on the save's source-is-magical fact.
  it('GrantMagicResistance flips the marker', () => {
    const acc = new EffectAccumulator();
    expect(acc.hasMagicResistance()).toBe(false);
    applyEffectToBuilder(
      { kind: 'GrantMagicResistance' },
      acc,
      { source: 'imp' },
    );
    expect(acc.hasMagicResistance()).toBe(true);
  });

  it('GrantSense keeps the larger range when the same sense is granted twice', () => {
    // RAW: a creature with overlapping sense grants keeps the longer
    // range (Dwarf's 60 ft darkvision + Devil's Sight 120 ft = 120 ft,
    // not 180 ft). The accumulator takes the max, not the sum.
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'GrantSense', sense: 'darkvision', range: 60 },
      acc,
      { source: 'dwarf' },
    );
    applyEffectToBuilder(
      { kind: 'GrantSense', sense: 'darkvision', range: 120 },
      acc,
      { source: 'devils-sight' },
    );
    expect(acc.senseRange('darkvision')).toBe(120);
  });
});
