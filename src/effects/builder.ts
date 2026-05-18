import type { Effect, ModifierTarget, RollTarget } from '../schemas/effects.js';
import type { AbilityScore, DamageType, Sense, Skill } from '../schemas/primitives.js';
import type { Predicate } from '../schemas/predicate.js';
import { evaluatePredicate } from './predicate.js';
import { evaluateFormula, type FormulaContext } from './formula.js';

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
  // Slice 115: optional gating predicate. When set, the modifier
  // only contributes if the predicate evaluates true against the
  // caller-supplied facts at query time (Archery's +2 attack only
  // applies on ranged attacks). Unset = always contributes.
  readonly predicate?: Predicate;
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
  // Per-source advantage overrides indexed by `${rollKey}::${sourceCharacterId}`.
  // Recorded by `SetAdvantageVsSource` effects (Bestow Curse's attack-
  // disadvantage variant); queried by consumers that know the relevant
  // counterparty id (the attack planner with the target's id).
  private readonly advantagesVsSource = new Map<string, AdvantageState>();
  // Slice 112: per-type resistance entries with optional qualifier.
  // No qualifier means the resistance always applies. A 'nonmagical'
  // qualifier means the resistance applies only when the incoming
  // damage source is non-magical (Stoneskin in SRD form, the common
  // monster "resistance to B/P/S from nonmagical attacks" trait).
  // A 'magical' qualifier means the resistance applies only when the
  // source IS magical. Resistance from multiple entries stacks via
  // any-match semantics: if any matching entry fires, the damage is
  // halved (resistance doesn't compound).
  private readonly resistances = new Map<DamageType | 'all', Array<{ qualifier?: 'nonmagical' | 'magical' }>>();
  private readonly immunities = new Set<DamageType | 'all'>();
  private readonly vulnerabilities = new Set<DamageType>();
  // Per-condition lists of immunity entries. Entries with no predicate
  // grant immunity unconditionally (Aura of Courage's Frightened
  // immunity, Freedom of Movement's paralyzed immunity). Entries with
  // a predicate grant immunity only when the predicate evaluates true
  // against the caller-supplied source facts (Protection from Evil and
  // Good's charmed / frightened arm gated on the source being one of
  // the six warded creature types).
  private readonly conditionImmunities = new Map<string, Array<{ predicate?: Predicate }>>();
  private readonly acOverrides: ACOverride[] = [];
  private readonly acFloors: { value: number; source: string }[] = [];
  private readonly abilityScoreFloors = new Map<AbilityScore, { value: number; source: string }[]>();
  private readonly resourceGrants: ResourceGrant[] = [];
  // Slice 127: granted senses (darkvision / blindsight / tremorsense /
  // truesight). Stored as sense -> max-range (feet) where multiple
  // grants of the same sense take the larger range (RAW: a dwarf
  // with 60 ft darkvision who multiclasses into Warlock and gains
  // Devil's Sight 120 ft keeps the 120 ft figure, not the sum).
  // Mirror Image and similar vision-gated effects query this.
  private readonly senseGrants = new Map<Sense, number>();
  private readonly proficiencies = new Map<string, 'half' | 'proficient' | 'expertise'>();
  private readonly actionEconomyMods = new Map<'extraAttack' | 'extraAction' | 'extraBonusAction', number>();
  private readonly flatDamageReductions = new Map<DamageType, number>();
  private critThresholdValue: number = 20;
  private halfProficiencyBonusFloorFlag: boolean = false;
  private healingBoostFlat: number = 0;
  private healingBoostPerSpellLevel: number = 0;
  private evasionFlag: boolean = false;
  private uncannyDodgeFlag: boolean = false;
  private innateSorcerySpendAlternativeFlag: boolean = false;
  private selfRestorationFlag: boolean = false;
  private maxHealingDiceFlag: boolean = false;
  private unarmedAsMagicalFlag: boolean = false;
  private divineInterventionWishFlag: boolean = false;
  private auraRangeBonusTotal: number = 0;
  private grantedSpellEntries: Array<{
    spellId: string;
    preparation: 'always-prepared' | 'prepared' | 'known' | 'at-will' | 'oncePerLongRest' | 'oncePerShortRest';
    spellcastingAbility?: AbilityScore;
  }> = [];
  // Slice 119: marker for the Two-Weapon Fighting Fighting Style.
  // When set, planOffHandAttack adds the wielder's ability mod to
  // off-hand damage even when positive (RAW: only negative mods
  // apply by default).
  private twoWeaponFightingFlag: boolean = false;
  // Slice 120: marker for the Protection Fighting Style. When set,
  // planProtection lets the bearer spend their reaction to impose
  // disadvantage on an attack against a nearby ally (shield required;
  // engine doesn't enforce position).
  private protectionFightingStyleFlag: boolean = false;
  // Slice 121: marker for the Great Weapon Fighting Fighting Style.
  // When set, planAttack replaces any 1 or 2 on the weapon damage
  // dice with 3, gated on a two-handed melee wield.
  private greatWeaponFightingFlag: boolean = false;

  addModifier(target: ModifierTarget, value: number, source: string, predicate?: Predicate): void {
    const key = modifierKey(target);
    let list = this.modifiers.get(key);
    if (list === undefined) {
      list = [];
      this.modifiers.set(key, list);
    }
    list.push(predicate !== undefined ? { source, value, predicate } : { source, value });
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

  setAdvantageVsSource(
    target: RollTarget,
    sourceCharacterId: string,
    mode: 'advantage' | 'disadvantage' | 'auto-crit' | 'auto-fail',
  ): void {
    const key = `${rollKey(target)}::${sourceCharacterId}`;
    let state = this.advantagesVsSource.get(key);
    if (state === undefined) {
      state = emptyAdvantage();
      this.advantagesVsSource.set(key, state);
    }
    if (mode === 'advantage') state.advantage = true;
    else if (mode === 'disadvantage') state.disadvantage = true;
    else if (mode === 'auto-crit') state.autoCrit = true;
    else state.autoFail = true;
  }

  addResistance(type: DamageType | 'all', qualifier?: 'nonmagical' | 'magical'): void {
    let list = this.resistances.get(type);
    if (list === undefined) {
      list = [];
      this.resistances.set(type, list);
    }
    list.push({ qualifier });
  }
  addImmunity(type: DamageType | 'all'): void {
    this.immunities.add(type);
  }
  addVulnerability(type: DamageType): void {
    this.vulnerabilities.add(type);
  }
  addConditionImmunity(id: string, predicate?: Predicate): void {
    let list = this.conditionImmunities.get(id);
    if (list === undefined) {
      list = [];
      this.conditionImmunities.set(id, list);
    }
    list.push({ predicate });
  }
  addACOverride(override: ACOverride): void {
    this.acOverrides.push(override);
  }
  addACFloor(value: number, source: string): void {
    this.acFloors.push({ value, source });
  }
  // Slice 229. Records a floor on an ability score; the highest floor
  // across all sources wins. `effectiveAbilityScoreFloor` returns the
  // highest floor recorded for the given ability, or `undefined` if
  // none. Mirrors the AC-floor shape.
  addAbilityScoreFloor(ability: AbilityScore, value: number, source: string): void {
    const existing = this.abilityScoreFloors.get(ability) ?? [];
    existing.push({ value, source });
    this.abilityScoreFloors.set(ability, existing);
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

  modifierSum(target: ModifierTarget, facts?: ReadonlyMap<string, unknown>): number {
    const list = this.modifiers.get(modifierKey(target));
    if (list === undefined) return 0;
    return list.reduce((acc, c) => {
      if (c.predicate !== undefined && !evaluatePredicate(c.predicate, { facts })) {
        return acc;
      }
      return acc + c.value;
    }, 0);
  }

  modifierBreakdown(target: ModifierTarget, facts?: ReadonlyMap<string, unknown>): ReadonlyArray<ModifierContribution> {
    const list = this.modifiers.get(modifierKey(target));
    if (list === undefined) return [];
    return list.filter((c) =>
      c.predicate === undefined || evaluatePredicate(c.predicate, { facts }),
    );
  }

  advantageFor(target: RollTarget): AdvantageState {
    return this.advantages.get(rollKey(target)) ?? emptyAdvantage();
  }

  // Per-counterparty advantage state. The bearer's effect stack records
  // `SetAdvantageVsSource` entries keyed on the bearing applied
  // condition's source; the consumer (typically the attack planner)
  // queries this with the relevant counterparty id (the attack's
  // target) and folds the result into the regular advantage resolution.
  advantageVsSource(target: RollTarget, sourceCharacterId: string): AdvantageState {
    const key = `${rollKey(target)}::${sourceCharacterId}`;
    return this.advantagesVsSource.get(key) ?? emptyAdvantage();
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

  // Mirror of `grantsAdvantageToAttackers`: true when this character
  // has any effect that imposes disadvantage on incoming attacks
  // (Dodge action's RAW effect, Blur, etc.). Entries optionally carry
  // a predicate (Protection from Evil and Good gates the disadvantage
  // on the attacker's creature type — fiend / undead / etc.) which is
  // evaluated against `attackerFacts` (`attackerCreatureType`, etc.)
  // supplied by the caller. Entries with no predicate always apply.
  imposesDisadvantageOnAttackers(
    attackerFacts?: ReadonlyMap<string, unknown>,
  ): boolean {
    return this.disadvantageOnAttackersEntries.some((entry) => {
      if (entry.predicate === undefined) return true;
      return evaluatePredicate(entry.predicate, { facts: attackerFacts });
    });
  }

  markImposesDisadvantageOnAttackers(predicate?: Predicate): void {
    this.disadvantageOnAttackersEntries.push({ predicate });
  }

  private disadvantageOnAttackersEntries: Array<{ predicate?: Predicate }> = [];

  // Slice 199. While set, any source that would grant an incoming
  // attacker advantage against this character is cancelled (the
  // attacker still rolls; they just don't get the advantage die).
  // Distinct from `imposesDisadvantageOnAttackers`, which contributes
  // disadvantage outright and cancels with attacker-side advantage
  // sources per the 2024 PHB "Advantage and Disadvantage" rule.
  // Entries optionally carry a predicate evaluated against the
  // *bearer's* facts (notably `bearerHasIncapacitated` for Elusive,
  // populated by the attack planner from `findActorBlockingCondition`).
  cancelsAdvantageOnAttackers(
    bearerFacts?: ReadonlyMap<string, unknown>,
  ): boolean {
    return this.cancelAdvantageOnAttackersEntries.some((entry) => {
      if (entry.predicate === undefined) return true;
      return evaluatePredicate(entry.predicate, { facts: bearerFacts });
    });
  }

  markCancelsAdvantageOnAttackers(predicate?: Predicate): void {
    this.cancelAdvantageOnAttackersEntries.push({ predicate });
  }

  private cancelAdvantageOnAttackersEntries: Array<{ predicate?: Predicate }> = [];

  // True when any active effect on this character blocks them from
  // regaining hit points. Heal planners consult this and, when set,
  // emit a Healed event with amount=0 (the reducer's amount<=0
  // early-return makes it a no-op) plus an annotation in `source`.
  // Set by `BlockHealing` effects on applied conditions like Spirit
  // Shroud's `healing-blocked-active`.
  private healingBlockedFlag = false;

  markHealingBlocked(): void {
    this.healingBlockedFlag = true;
  }

  hasHealingBlocked(): boolean {
    return this.healingBlockedFlag;
  }

  // Slice 131: RAW Magic Resistance ("advantage on saves vs spells
  // and other magical effects"). Marker-only; consumers consult
  // hasMagicResistance() and contribute advantage on the save roll
  // when the save's source-is-magical fact is true.
  private magicResistanceFlag = false;

  markMagicResistance(): void {
    this.magicResistanceFlag = true;
  }

  hasMagicResistance(): boolean {
    return this.magicResistanceFlag;
  }

  grantSense(sense: Sense, range: number): void {
    const existing = this.senseGrants.get(sense) ?? 0;
    if (range > existing) this.senseGrants.set(sense, range);
  }

  hasSense(sense: Sense): boolean {
    return (this.senseGrants.get(sense) ?? 0) > 0;
  }

  senseRange(sense: Sense): number {
    return this.senseGrants.get(sense) ?? 0;
  }

  hasResistance(type: DamageType, sourceIsMagical?: boolean): boolean {
    const matches = (entries: Array<{ qualifier?: 'nonmagical' | 'magical' }>): boolean =>
      entries.some((entry) => {
        if (entry.qualifier === undefined) return true;
        if (entry.qualifier === 'nonmagical') return sourceIsMagical !== true;
        return sourceIsMagical === true;
      });
    const typeEntries = this.resistances.get(type);
    if (typeEntries !== undefined && matches(typeEntries)) return true;
    const allEntries = this.resistances.get('all');
    if (allEntries !== undefined && matches(allEntries)) return true;
    return false;
  }
  hasImmunity(type: DamageType): boolean {
    return this.immunities.has(type) || this.immunities.has('all');
  }
  hasVulnerability(type: DamageType): boolean {
    return this.vulnerabilities.has(type);
  }
  hasConditionImmunity(
    id: string,
    sourceFacts?: ReadonlyMap<string, unknown>,
  ): boolean {
    const list = this.conditionImmunities.get(id);
    if (list === undefined) return false;
    return list.some((entry) => {
      if (entry.predicate === undefined) return true;
      return evaluatePredicate(entry.predicate, { facts: sourceFacts });
    });
  }
  effectiveACOverride(): ACOverride | undefined {
    if (this.acOverrides.length === 0) return undefined;
    return this.acOverrides.reduce((best, current) =>
      current.priority > best.priority ? current : best,
    );
  }
  effectiveACFloor(): { value: number; source: string } | undefined {
    if (this.acFloors.length === 0) return undefined;
    return this.acFloors.reduce((best, current) =>
      current.value > best.value ? current : best,
    );
  }
  effectiveAbilityScoreFloor(ability: AbilityScore): { value: number; source: string } | undefined {
    const entries = this.abilityScoreFloors.get(ability);
    if (entries === undefined || entries.length === 0) return undefined;
    return entries.reduce((best, current) => (current.value > best.value ? current : best));
  }
  resources(): ReadonlyArray<ResourceGrant> {
    return this.resourceGrants;
  }
  proficiencyLevel(target: string, id: string): 'none' | 'half' | 'proficient' | 'expertise' {
    return this.proficiencies.get(`${target}:${id}`) ?? 'none';
  }
  proficienciesByTarget(target: string): ReadonlyArray<{ readonly id: string; readonly level: 'half' | 'proficient' | 'expertise' }> {
    const prefix = `${target}:`;
    const rows: { id: string; level: 'half' | 'proficient' | 'expertise' }[] = [];
    for (const [key, level] of this.proficiencies) {
      if (key.startsWith(prefix)) {
        rows.push({ id: key.slice(prefix.length), level });
      }
    }
    return rows;
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
  expandCritRange(threshold: number): void {
    if (threshold < this.critThresholdValue) this.critThresholdValue = threshold;
  }
  critThreshold(): number {
    return this.critThresholdValue;
  }
  markHalfProficiencyBonusFloor(): void {
    this.halfProficiencyBonusFloorFlag = true;
  }
  hasHalfProficiencyBonusFloor(): boolean {
    return this.halfProficiencyBonusFloorFlag;
  }
  addHealingBoost(flat: number, perSpellLevel: number): void {
    this.healingBoostFlat += flat;
    this.healingBoostPerSpellLevel += perSpellLevel;
  }
  healingBoostFor(slotLevel: number): number {
    if (slotLevel <= 0) return 0;
    return this.healingBoostFlat + this.healingBoostPerSpellLevel * slotLevel;
  }
  markEvasion(): void {
    this.evasionFlag = true;
  }
  hasEvasion(): boolean {
    return this.evasionFlag;
  }
  // Slice 200: marker that gates `planUncannyDodge`. Set by Rogue L5+
  // via the `GrantUncannyDodge` effect on the Uncanny Dodge feature.
  markUncannyDodge(): void {
    this.uncannyDodgeFlag = true;
  }
  hasUncannyDodge(): boolean {
    return this.uncannyDodgeFlag;
  }
  // Slice 201: marker that unlocks the Sorcery-Points alternative
  // cost on `planInnateSorcery`. Set by Sorcerer L7 Sorcery Incarnate
  // via the `GrantInnateSorcerySpendAlternative` effect.
  markInnateSorcerySpendAlternative(): void {
    this.innateSorcerySpendAlternativeFlag = true;
  }
  hasInnateSorcerySpendAlternative(): boolean {
    return this.innateSorcerySpendAlternativeFlag;
  }
  // Slice 202: marker that gates `planSelfRestoration`. Set by Monk
  // L10 Self-Restoration via the `GrantSelfRestoration` effect.
  markSelfRestoration(): void {
    this.selfRestorationFlag = true;
  }
  hasSelfRestoration(): boolean {
    return this.selfRestorationFlag;
  }
  // Slice 205: marker that swaps every healing-dice roll to its max
  // value in cast-spell's heal-mechanic path. Set by Life Domain L17
  // Supreme Healing via the `GrantMaxHealingDice` effect.
  markMaxHealingDice(): void {
    this.maxHealingDiceFlag = true;
  }
  hasMaxHealingDice(): boolean {
    return this.maxHealingDiceFlag;
  }
  // Slice 207: marker that flags the bearer's unarmed strikes as
  // magical for resistance/immunity-piercing purposes. Set by Monk
  // L6 Empowered Strikes via `GrantUnarmedAsMagical`.
  markUnarmedAsMagical(): void {
    this.unarmedAsMagicalFlag = true;
  }
  hasUnarmedAsMagical(): boolean {
    return this.unarmedAsMagicalFlag;
  }
  // Slice 221: marker that unlocks the Wish branch of
  // planDivineIntervention. Set by Cleric L20 Greater Divine
  // Intervention via the `GrantDivineInterventionWish` effect.
  markDivineInterventionWish(): void {
    this.divineInterventionWishFlag = true;
  }
  hasDivineInterventionWish(): boolean {
    return this.divineInterventionWishFlag;
  }
  // Slice 211: additive bonus to every aura the bearer projects.
  // Canonical user: Paladin L18 Aura Expansion (+20 ft). Multiple
  // sources stack additively. The engine doesn't auto-project auras
  // (positions are consumer-side), so this primitive is purely a
  // surfaced accumulator value that consumers (dndbnb / VTTs) read
  // alongside the bearer's `GrantAura` effects.
  addAuraRangeBonus(feet: number): void {
    this.auraRangeBonusTotal += feet;
  }
  auraRangeBonus(): number {
    return this.auraRangeBonusTotal;
  }
  // Slice 212: collected GrantSpell entries from the bearer's effect
  // stack. Canonical users: subclass domain spell lists (Life Domain
  // L3, Circle of the Land L3, Draconic Sorcery L3, Fiend Patron L3,
  // Oath of Devotion L3) and other "extra spell" features (Bard L20
  // Words of Creation, Cleric Divine Order Thaumaturge cantrip).
  // Consumers query `grantedSpells()` to get the full list with
  // preparation/spellcastingAbility metadata; the derive helper
  // `effectiveSpellList` returns a flat string array union'd with
  // `character.preparedSpells` + `character.knownSpells`.
  addGrantedSpell(entry: {
    spellId: string;
    preparation: 'always-prepared' | 'prepared' | 'known' | 'at-will' | 'oncePerLongRest' | 'oncePerShortRest';
    spellcastingAbility?: AbilityScore;
  }): void {
    this.grantedSpellEntries.push(entry);
  }
  grantedSpells(): ReadonlyArray<{
    readonly spellId: string;
    readonly preparation: 'always-prepared' | 'prepared' | 'known' | 'at-will' | 'oncePerLongRest' | 'oncePerShortRest';
    readonly spellcastingAbility?: AbilityScore;
  }> {
    return this.grantedSpellEntries;
  }
  markTwoWeaponFighting(): void {
    this.twoWeaponFightingFlag = true;
  }
  hasTwoWeaponFighting(): boolean {
    return this.twoWeaponFightingFlag;
  }
  markProtectionFightingStyle(): void {
    this.protectionFightingStyleFlag = true;
  }
  hasProtectionFightingStyle(): boolean {
    return this.protectionFightingStyleFlag;
  }
  markGreatWeaponFighting(): void {
    this.greatWeaponFightingFlag = true;
  }
  hasGreatWeaponFighting(): boolean {
    return this.greatWeaponFightingFlag;
  }
}

export interface BuilderContext {
  readonly source: string;
  // When provided, Formula values inside an AddModifier (and similar
  // effects that accept Formula) are evaluated to numbers as the
  // effect is folded into the accumulator. Auras and source-relative
  // modifiers (e.g., +CHA-mod-of-source to ally saves) need this
  // threaded through. Callers that only deal with numeric values can
  // omit it; Formula values then drop silently.
  readonly formulaContext?: FormulaContext;
  // When this effect comes from an AppliedCondition with a stamped
  // `sourceCharacterId`, threading it here lets per-source effect
  // kinds (e.g. SetAdvantageVsSource) attribute their override to the
  // right counterparty. Effects emitted without a bearing condition
  // (class, species, item, feat) leave this undefined; per-source
  // effects in those contexts drop silently.
  readonly sourceCharacterId?: string;
}

export const applyEffectToBuilder = (
  effect: Effect,
  acc: EffectAccumulator,
  ctx: BuilderContext,
): void => {
  switch (effect.kind) {
    case 'AddModifier': {
      if (typeof effect.value === 'number') {
        acc.addModifier(effect.target, effect.value, ctx.source, effect.condition);
      } else if (ctx.formulaContext !== undefined) {
        const value = evaluateFormula(effect.value, ctx.formulaContext);
        acc.addModifier(effect.target, value, ctx.source, effect.condition);
      }
      return;
    }
    case 'SetAdvantage':
      acc.setAdvantage(effect.on, effect.mode);
      return;
    case 'SetAdvantageVsSource':
      if (ctx.sourceCharacterId !== undefined) {
        acc.setAdvantageVsSource(effect.on, ctx.sourceCharacterId, effect.mode);
      }
      return;
    case 'BlockHealing':
      acc.markHealingBlocked();
      return;
    case 'GrantResistance':
      acc.addResistance(effect.damageType, effect.qualifier);
      return;
    case 'GrantImmunity':
      acc.addImmunity(effect.damageType);
      return;
    case 'GrantVulnerability':
      acc.addVulnerability(effect.damageType);
      return;
    case 'GrantConditionImmunity':
      acc.addConditionImmunity(effect.conditionId, effect.condition);
      return;
    case 'GrantMagicResistance':
      acc.markMagicResistance();
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
    case 'SetACFloor':
      acc.addACFloor(effect.value, ctx.source);
      return;
    case 'OverrideAbilityScore':
      acc.addAbilityScoreFloor(effect.ability, effect.value, ctx.source);
      return;
    case 'GrantResource':
      if (typeof effect.max === 'number') {
        acc.addResourceGrant({
          resourceId: effect.resourceId,
          max: effect.max,
          recharge: effect.recharge,
          source: ctx.source,
        });
      } else if (ctx.formulaContext !== undefined) {
        acc.addResourceGrant({
          resourceId: effect.resourceId,
          max: evaluateFormula(effect.max, ctx.formulaContext),
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
    case 'ExpandCritRange':
      acc.expandCritRange(effect.threshold);
      return;
    case 'GrantHalfProficiencyBonusFloor':
      acc.markHalfProficiencyBonusFloor();
      return;
    case 'BoostHealing':
      acc.addHealingBoost(effect.flat, effect.perSpellLevel);
      return;
    case 'GrantEvasion':
      acc.markEvasion();
      return;
    case 'GrantUncannyDodge':
      acc.markUncannyDodge();
      return;
    case 'GrantInnateSorcerySpendAlternative':
      acc.markInnateSorcerySpendAlternative();
      return;
    case 'GrantSelfRestoration':
      acc.markSelfRestoration();
      return;
    case 'GrantMaxHealingDice':
      acc.markMaxHealingDice();
      return;
    case 'GrantUnarmedAsMagical':
      acc.markUnarmedAsMagical();
      return;
    case 'GrantDivineInterventionWish':
      acc.markDivineInterventionWish();
      return;
    case 'ExpandAuraRange':
      acc.addAuraRangeBonus(effect.addFeet);
      return;
    case 'GrantTwoWeaponFighting':
      acc.markTwoWeaponFighting();
      return;
    case 'GrantProtectionFightingStyle':
      acc.markProtectionFightingStyle();
      return;
    case 'GrantGreatWeaponFighting':
      acc.markGreatWeaponFighting();
      return;
    case 'GrantAdvantageToAttackers':
      acc.markGrantsAdvantageToAttackers();
      return;
    case 'ImposeDisadvantageOnAttackers':
      acc.markImposesDisadvantageOnAttackers(effect.condition);
      return;
    case 'CancelAdvantageOnAttackers':
      acc.markCancelsAdvantageOnAttackers(effect.condition);
      return;
    case 'GrantSense':
      acc.grantSense(effect.sense, effect.range);
      return;
    case 'GrantSpell':
      acc.addGrantedSpell({
        spellId: effect.spellId,
        preparation: effect.preparation,
        ...(effect.spellcastingAbility !== undefined
          ? { spellcastingAbility: effect.spellcastingAbility }
          : {}),
      });
      return;
    case 'ModifySpeed':
    case 'GrantSpellSlots':
    case 'OnEvent':
    case 'RecoverResource':
    case 'GrantAction':
    case 'GrantWeaponMastery':
    case 'ExpandSpellList':
    case 'SetHPMaxFormula':
    case 'OfferChoice':
    case 'GrantAura':
    case 'GrantFallingProtection':
    case 'PreventFatalDamage':
    case 'Custom':
      return;
    default: {
      const _exhaustive: never = effect;
      void _exhaustive;
      return;
    }
  }
};
