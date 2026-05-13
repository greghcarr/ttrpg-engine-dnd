import type { Effect, ModifierTarget, RollTarget } from '../schemas/effects.js';
import type { AbilityScore, DamageType, Skill } from '../schemas/primitives.js';

const modifierKey = (target: ModifierTarget): string => {
  if (typeof target === 'string') return target;
  switch (target.kind) {
    case 'save':
      return `save:${target.ability}`;
    case 'check':
      return `check:${target.ability}`;
    case 'skill':
      return `skill:${target.skill}`;
  }
};

const rollKey = (target: RollTarget): string => {
  if (typeof target === 'string') return target;
  switch (target.kind) {
    case 'save':
      return `save:${target.ability}`;
    case 'check':
      return `check:${target.ability}`;
    case 'skill':
      return `skill:${target.skill}`;
  }
};

export interface ModifierContribution {
  readonly source: string;
  readonly value: number;
}

export interface AdvantageState {
  advantage: boolean;
  disadvantage: boolean;
  autoCrit: boolean;
  autoFail: boolean;
}

const emptyAdvantage = (): AdvantageState => ({
  advantage: false,
  disadvantage: false,
  autoCrit: false,
  autoFail: false,
});

export interface ACOverride {
  readonly base: number | 'dex' | 'con' | 'wis';
  readonly abilityModifiers: ReadonlyArray<AbilityScore>;
  readonly dexCap: number | undefined;
  readonly priority: number;
  readonly source: string;
}

export interface ResourceGrant {
  readonly resourceId: string;
  readonly max: number;
  readonly recharge: string;
  readonly source: string;
}

export class EffectAccumulator {
  private readonly modifiers = new Map<string, ModifierContribution[]>();
  private readonly advantages = new Map<string, AdvantageState>();
  private readonly resistances = new Set<DamageType | 'all'>();
  private readonly immunities = new Set<DamageType | 'all'>();
  private readonly vulnerabilities = new Set<DamageType>();
  private readonly conditionImmunities = new Set<string>();
  private readonly acOverrides: ACOverride[] = [];
  private readonly resourceGrants: ResourceGrant[] = [];
  private readonly proficiencies = new Map<string, 'half' | 'proficient' | 'expertise'>();
  private readonly actionEconomyMods = new Map<'extraAttack' | 'extraAction' | 'extraBonusAction', number>();
  private readonly flatDamageReductions = new Map<DamageType, number>();

  addModifier(target: ModifierTarget, value: number, source: string): void {
    const key = modifierKey(target);
    let list = this.modifiers.get(key);
    if (list === undefined) {
      list = [];
      this.modifiers.set(key, list);
    }
    list.push({ source, value });
  }

  setAdvantage(target: RollTarget, mode: 'advantage' | 'disadvantage' | 'auto-crit' | 'auto-fail'): void {
    const key = rollKey(target);
    let state = this.advantages.get(key);
    if (state === undefined) {
      state = emptyAdvantage();
      this.advantages.set(key, state);
    }
    if (mode === 'advantage') state.advantage = true;
    else if (mode === 'disadvantage') state.disadvantage = true;
    else if (mode === 'auto-crit') state.autoCrit = true;
    else state.autoFail = true;
  }

  addResistance(type: DamageType | 'all'): void {
    this.resistances.add(type);
  }
  addImmunity(type: DamageType | 'all'): void {
    this.immunities.add(type);
  }
  addVulnerability(type: DamageType): void {
    this.vulnerabilities.add(type);
  }
  addConditionImmunity(id: string): void {
    this.conditionImmunities.add(id);
  }
  addACOverride(override: ACOverride): void {
    this.acOverrides.push(override);
  }
  addResourceGrant(grant: ResourceGrant): void {
    this.resourceGrants.push(grant);
  }
  addProficiency(
    target: 'skill' | 'tool' | 'weapon' | 'armor' | 'save' | 'language',
    id: string,
    level: 'half' | 'proficient' | 'expertise',
  ): void {
    const key = `${target}:${id}`;
    const existing = this.proficiencies.get(key);
    const rank = { half: 1, proficient: 2, expertise: 3 } as const;
    if (existing === undefined || rank[level] > rank[existing]) {
      this.proficiencies.set(key, level);
    }
  }

  modifierSum(target: ModifierTarget): number {
    const list = this.modifiers.get(modifierKey(target));
    if (list === undefined) return 0;
    return list.reduce((acc, c) => acc + c.value, 0);
  }

  modifierBreakdown(target: ModifierTarget): ReadonlyArray<ModifierContribution> {
    return this.modifiers.get(modifierKey(target)) ?? [];
  }

  advantageFor(target: RollTarget): AdvantageState {
    return this.advantages.get(rollKey(target)) ?? emptyAdvantage();
  }

  // True when this character has any effect that grants attackers
  // advantage against them (Faerie Fire, Restrained, paralyzed-while-
  // attacker-within-5-feet, etc.). Called on the *target's* effect
  // stack by the attack planner.
  grantsAdvantageToAttackers(): boolean {
    return this.advantageToAttackersFlag;
  }

  markGrantsAdvantageToAttackers(): void {
    this.advantageToAttackersFlag = true;
  }

  private advantageToAttackersFlag = false;

  hasResistance(type: DamageType): boolean {
    return this.resistances.has(type) || this.resistances.has('all');
  }
  hasImmunity(type: DamageType): boolean {
    return this.immunities.has(type) || this.immunities.has('all');
  }
  hasVulnerability(type: DamageType): boolean {
    return this.vulnerabilities.has(type);
  }
  hasConditionImmunity(id: string): boolean {
    return this.conditionImmunities.has(id);
  }
  effectiveACOverride(): ACOverride | undefined {
    if (this.acOverrides.length === 0) return undefined;
    return this.acOverrides.reduce((best, current) =>
      current.priority > best.priority ? current : best,
    );
  }
  resources(): ReadonlyArray<ResourceGrant> {
    return this.resourceGrants;
  }
  proficiencyLevel(target: string, id: string): 'none' | 'half' | 'proficient' | 'expertise' {
    return this.proficiencies.get(`${target}:${id}`) ?? 'none';
  }

  addActionEconomy(op: 'extraAttack' | 'extraAction' | 'extraBonusAction', count: number): void {
    const prior = this.actionEconomyMods.get(op) ?? 0;
    this.actionEconomyMods.set(op, prior + count);
  }
  actionEconomyTotal(op: 'extraAttack' | 'extraAction' | 'extraBonusAction'): number {
    return this.actionEconomyMods.get(op) ?? 0;
  }
  addFlatDamageReduction(damageType: DamageType, amount: number): void {
    const prior = this.flatDamageReductions.get(damageType) ?? 0;
    this.flatDamageReductions.set(damageType, Math.max(prior, amount));
  }
  flatDamageReductionFor(damageType: DamageType): number {
    return this.flatDamageReductions.get(damageType) ?? 0;
  }
}

export interface BuilderContext {
  readonly source: string;
}

export const applyEffectToBuilder = (
  effect: Effect,
  acc: EffectAccumulator,
  ctx: BuilderContext,
): void => {
  switch (effect.kind) {
    case 'AddModifier': {
      if (typeof effect.value === 'number') {
        acc.addModifier(effect.target, effect.value, ctx.source);
      }
      return;
    }
    case 'SetAdvantage':
      acc.setAdvantage(effect.on, effect.mode);
      return;
    case 'GrantResistance':
      acc.addResistance(effect.damageType);
      return;
    case 'GrantImmunity':
      acc.addImmunity(effect.damageType);
      return;
    case 'GrantVulnerability':
      acc.addVulnerability(effect.damageType);
      return;
    case 'GrantConditionImmunity':
      acc.addConditionImmunity(effect.conditionId);
      return;
    case 'OverrideACFormula':
      acc.addACOverride({
        base: effect.base,
        abilityModifiers: effect.abilityModifiers,
        dexCap: effect.dexCap,
        priority: effect.priority ?? 0,
        source: ctx.source,
      });
      return;
    case 'GrantResource':
      if (typeof effect.max === 'number') {
        acc.addResourceGrant({
          resourceId: effect.resourceId,
          max: effect.max,
          recharge: effect.recharge,
          source: ctx.source,
        });
      }
      return;
    case 'GrantProficiency':
      acc.addProficiency(effect.target, effect.id, effect.level === 'none' ? 'proficient' : effect.level);
      return;
    case 'ModifyActionEconomy':
      acc.addActionEconomy(effect.op, effect.count);
      return;
    case 'FlatDamageReduction':
      for (const damageType of effect.damageTypes) {
        acc.addFlatDamageReduction(damageType, effect.amount);
      }
      return;
    case 'GrantAdvantageToAttackers':
      acc.markGrantsAdvantageToAttackers();
      return;
    case 'GrantSense':
    case 'ModifySpeed':
    case 'GrantSpellSlots':
    case 'GrantSpell':
    case 'OnEvent':
    case 'RecoverResource':
    case 'GrantAction':
    case 'GrantWeaponMastery':
    case 'ExpandSpellList':
    case 'SetHPMaxFormula':
    case 'OfferChoice':
    case 'Custom':
      return;
    default: {
      const _exhaustive: never = effect;
      void _exhaustive;
      return;
    }
  }
};
