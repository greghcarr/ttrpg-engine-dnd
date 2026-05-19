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

  // Slice 258: predicated SetAdvantage. Prior to this slice the schema
  // accepted a `condition: Predicate` field but the builder dropped it.
  // Canonical user: Mantle of Spell Resistance (advantage on saves
  // when `event.isSpellSave === true`).
  it('SetAdvantage with a predicate is gated on caller-supplied facts', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'SetAdvantage',
        on: { kind: 'save', ability: 'WIS' },
        mode: 'advantage',
        condition: { kind: 'eq', path: 'event.isSpellSave', value: true },
      },
      acc,
      { source: 'mantle-of-spell-resistance' },
    );
    // No facts: predicate evaluates false, no advantage.
    expect(acc.advantageFor({ kind: 'save', ability: 'WIS' }).advantage).toBe(false);
    // Facts say not-a-spell-save: still no advantage.
    expect(
      acc.advantageFor(
        { kind: 'save', ability: 'WIS' },
        new Map<string, unknown>([['event.isSpellSave', false]]),
      ).advantage,
    ).toBe(false);
    // Facts say spell save: advantage applies.
    expect(
      acc.advantageFor(
        { kind: 'save', ability: 'WIS' },
        new Map<string, unknown>([['event.isSpellSave', true]]),
      ).advantage,
    ).toBe(true);
  });

  it('Unpredicated SetAdvantage entries still apply regardless of facts (fast path preserved)', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'SetAdvantage', on: { kind: 'save', ability: 'CON' }, mode: 'advantage' },
      acc,
      { source: 'paladin-aura' },
    );
    // No facts: advantage applies.
    expect(acc.advantageFor({ kind: 'save', ability: 'CON' }).advantage).toBe(true);
    // Random facts: advantage still applies (unpredicated path doesn't consult facts).
    expect(
      acc.advantageFor(
        { kind: 'save', ability: 'CON' },
        new Map<string, unknown>([['event.isSpellSave', false]]),
      ).advantage,
    ).toBe(true);
  });

  it('Predicated + unpredicated SetAdvantage merge correctly', () => {
    const acc = new EffectAccumulator();
    // One unpredicated advantage on WIS save.
    applyEffectToBuilder(
      { kind: 'SetAdvantage', on: { kind: 'save', ability: 'WIS' }, mode: 'advantage' },
      acc,
      { source: 'unconditional' },
    );
    // One predicated disadvantage on WIS save (gated on event.cursed).
    applyEffectToBuilder(
      {
        kind: 'SetAdvantage',
        on: { kind: 'save', ability: 'WIS' },
        mode: 'disadvantage',
        condition: { kind: 'eq', path: 'event.cursed', value: true },
      },
      acc,
      { source: 'curse' },
    );
    // No facts: only the unpredicated advantage applies.
    const noFacts = acc.advantageFor({ kind: 'save', ability: 'WIS' });
    expect(noFacts.advantage).toBe(true);
    expect(noFacts.disadvantage).toBe(false);
    // Facts trigger the predicated disadvantage: both apply (RAW
    // advantage / disadvantage cancellation is the caller's job, not
    // the accumulator's).
    const cursed = acc.advantageFor(
      { kind: 'save', ability: 'WIS' },
      new Map<string, unknown>([['event.cursed', true]]),
    );
    expect(cursed.advantage).toBe(true);
    expect(cursed.disadvantage).toBe(true);
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

  // Slice 262: predicated GrantResistance. Schema accepted `condition`
  // but the builder dropped it pre-slice. Pattern-check companion to
  // slice 258's SetAdvantage fix.
  it('GrantResistance with a predicate is gated on caller-supplied facts', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'GrantResistance',
        damageType: 'fire',
        condition: { kind: 'eq', path: 'bearer.transformed', value: true },
      },
      acc,
      { source: 'fire-form' },
    );
    // No facts: predicate false → no resistance.
    expect(acc.hasResistance('fire')).toBe(false);
    // Facts say not-transformed: still no resistance.
    expect(
      acc.hasResistance('fire', false, new Map<string, unknown>([['bearer.transformed', false]])),
    ).toBe(false);
    // Facts say transformed: resistance applies.
    expect(
      acc.hasResistance('fire', false, new Map<string, unknown>([['bearer.transformed', true]])),
    ).toBe(true);
  });

  it('Unpredicated GrantResistance entries still apply regardless of facts (fast path preserved)', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder({ kind: 'GrantResistance', damageType: 'cold' }, acc, { source: 'frost-cloak' });
    expect(acc.hasResistance('cold')).toBe(true);
    // Random facts: still applies.
    expect(
      acc.hasResistance('cold', false, new Map<string, unknown>([['random.fact', true]])),
    ).toBe(true);
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

  it('CancelAdvantageOnAttackers reports false when no entries are present', () => {
    const acc = new EffectAccumulator();
    expect(acc.cancelsAdvantageOnAttackers()).toBe(false);
  });

  it('CancelAdvantageOnAttackers reports true after an unpredicated entry is added', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'CancelAdvantageOnAttackers' },
      acc,
      { source: 'elusive' },
    );
    expect(acc.cancelsAdvantageOnAttackers()).toBe(true);
  });

  it('CancelAdvantageOnAttackers respects a bearer-facts predicate', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'CancelAdvantageOnAttackers',
        condition: { kind: 'eq', path: 'bearerHasIncapacitated', value: false },
      },
      acc,
      { source: 'elusive' },
    );
    expect(
      acc.cancelsAdvantageOnAttackers(
        new Map<string, unknown>([['bearerHasIncapacitated', false]]),
      ),
    ).toBe(true);
    expect(
      acc.cancelsAdvantageOnAttackers(
        new Map<string, unknown>([['bearerHasIncapacitated', true]]),
      ),
    ).toBe(false);
  });

  it('GrantUncannyDodge marker propagates via hasUncannyDodge()', () => {
    const acc = new EffectAccumulator();
    expect(acc.hasUncannyDodge()).toBe(false);
    applyEffectToBuilder(
      { kind: 'GrantUncannyDodge' },
      acc,
      { source: 'rogue-l5' },
    );
    expect(acc.hasUncannyDodge()).toBe(true);
  });

  it('GrantInnateSorcerySpendAlternative marker propagates via hasInnateSorcerySpendAlternative()', () => {
    const acc = new EffectAccumulator();
    expect(acc.hasInnateSorcerySpendAlternative()).toBe(false);
    applyEffectToBuilder(
      { kind: 'GrantInnateSorcerySpendAlternative' },
      acc,
      { source: 'sorcerer-l7' },
    );
    expect(acc.hasInnateSorcerySpendAlternative()).toBe(true);
  });

  it('GrantSelfRestoration marker propagates via hasSelfRestoration()', () => {
    const acc = new EffectAccumulator();
    expect(acc.hasSelfRestoration()).toBe(false);
    applyEffectToBuilder(
      { kind: 'GrantSelfRestoration' },
      acc,
      { source: 'monk-l10' },
    );
    expect(acc.hasSelfRestoration()).toBe(true);
  });

  it('GrantMaxHealingDice marker propagates via hasMaxHealingDice()', () => {
    const acc = new EffectAccumulator();
    expect(acc.hasMaxHealingDice()).toBe(false);
    applyEffectToBuilder(
      { kind: 'GrantMaxHealingDice' },
      acc,
      { source: 'life-domain-l17' },
    );
    expect(acc.hasMaxHealingDice()).toBe(true);
  });

  it('GrantUnarmedAsMagical marker propagates via hasUnarmedAsMagical()', () => {
    const acc = new EffectAccumulator();
    expect(acc.hasUnarmedAsMagical()).toBe(false);
    applyEffectToBuilder(
      { kind: 'GrantUnarmedAsMagical' },
      acc,
      { source: 'monk-l6' },
    );
    expect(acc.hasUnarmedAsMagical()).toBe(true);
  });

  it('ExpandAuraRange accumulates additively via auraRangeBonus()', () => {
    const acc = new EffectAccumulator();
    expect(acc.auraRangeBonus()).toBe(0);
    applyEffectToBuilder(
      { kind: 'ExpandAuraRange', addFeet: 20 },
      acc,
      { source: 'paladin-l18' },
    );
    expect(acc.auraRangeBonus()).toBe(20);
    applyEffectToBuilder(
      { kind: 'ExpandAuraRange', addFeet: 10 },
      acc,
      { source: 'hypothetical-bonus' },
    );
    expect(acc.auraRangeBonus()).toBe(30);
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

  // Slice 262: predicated ModifyActionEconomy + GrantAdvantageToAttackers,
  // closing the audit-gap pattern from slice 258 categorically (the
  // SetAdvantage / GrantResistance / ModifyActionEconomy /
  // GrantAdvantageToAttackers four-way inert-condition cohort).

  it('ModifyActionEconomy unpredicated sums normally (fast path preserved)', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'ModifyActionEconomy', op: 'extraAttack', count: 1 },
      acc,
      { source: 'fighter-extra-attack' },
    );
    expect(acc.actionEconomyTotal('extraAttack')).toBe(1);
    // Facts irrelevant for unpredicated entries.
    expect(
      acc.actionEconomyTotal('extraAttack', new Map<string, unknown>([['noisy.fact', true]])),
    ).toBe(1);
  });

  it('ModifyActionEconomy with a predicate adds only when facts evaluate true', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'ModifyActionEconomy',
        op: 'extraBonusAction',
        count: 1,
        condition: { kind: 'eq', path: 'bearer.raging', value: true },
      },
      acc,
      { source: 'frenzy' },
    );
    // No facts: predicate false → no extra bonus action.
    expect(acc.actionEconomyTotal('extraBonusAction')).toBe(0);
    // Facts say not-raging: still 0.
    expect(
      acc.actionEconomyTotal(
        'extraBonusAction',
        new Map<string, unknown>([['bearer.raging', false]]),
      ),
    ).toBe(0);
    // Facts say raging: extra bonus action applies.
    expect(
      acc.actionEconomyTotal(
        'extraBonusAction',
        new Map<string, unknown>([['bearer.raging', true]]),
      ),
    ).toBe(1);
  });

  it('ModifyActionEconomy predicated + unpredicated sum correctly', () => {
    const acc = new EffectAccumulator();
    // Always-on extra attack from a class feature.
    applyEffectToBuilder(
      { kind: 'ModifyActionEconomy', op: 'extraAttack', count: 1 },
      acc,
      { source: 'class' },
    );
    // Conditional extra attack from a rider.
    applyEffectToBuilder(
      {
        kind: 'ModifyActionEconomy',
        op: 'extraAttack',
        count: 1,
        condition: { kind: 'eq', path: 'bearer.raging', value: true },
      },
      acc,
      { source: 'rage' },
    );
    expect(acc.actionEconomyTotal('extraAttack')).toBe(1);
    expect(
      acc.actionEconomyTotal('extraAttack', new Map<string, unknown>([['bearer.raging', true]])),
    ).toBe(2);
  });

  it('GrantAdvantageToAttackers unpredicated returns true unconditionally (fast path preserved)', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      { kind: 'GrantAdvantageToAttackers' },
      acc,
      { source: 'faerie-fire' },
    );
    expect(acc.grantsAdvantageToAttackers()).toBe(true);
    // Facts irrelevant.
    expect(
      acc.grantsAdvantageToAttackers(new Map<string, unknown>([['random', false]])),
    ).toBe(true);
  });

  it('GrantAdvantageToAttackers with a predicate is gated on facts', () => {
    const acc = new EffectAccumulator();
    applyEffectToBuilder(
      {
        kind: 'GrantAdvantageToAttackers',
        condition: { kind: 'eq', path: 'event.attackerCreatureType', value: 'undead' },
      },
      acc,
      { source: 'undead-bane' },
    );
    // No facts: predicate false.
    expect(acc.grantsAdvantageToAttackers()).toBe(false);
    // Facts say attacker is a fiend: still false.
    expect(
      acc.grantsAdvantageToAttackers(
        new Map<string, unknown>([['event.attackerCreatureType', 'fiend']]),
      ),
    ).toBe(false);
    // Facts say attacker is undead: true.
    expect(
      acc.grantsAdvantageToAttackers(
        new Map<string, unknown>([['event.attackerCreatureType', 'undead']]),
      ),
    ).toBe(true);
  });
});
