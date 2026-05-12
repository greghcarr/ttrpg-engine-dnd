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

  it('AddModifier with formula is not yet supported numerically (no contribution)', () => {
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
});
