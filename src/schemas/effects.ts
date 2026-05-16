import { z } from 'zod';
import {
  AbilityScoreSchema,
  type AbilityScore,
  DamageTypeSchema,
  type DamageType,
  DiceExpressionSchema,
  type DiceExpression,
  MovementModeSchema,
  type MovementMode,
  ProficiencyLevelSchema,
  type ProficiencyLevel,
  RechargeSchema,
  type Recharge,
  SenseSchema,
  type Sense,
  SkillSchema,
  type Skill,
  SpellLevelSchema,
  type SpellLevel,
  WeaponMasterySchema,
  type WeaponMastery,
} from './primitives.js';
import { FormulaSchema, type Formula } from './formula.js';
import { PredicateSchema, type Predicate } from './predicate.js';

export type ModifierTarget =
  | 'ac'
  | 'attack'
  | 'damage'
  | 'initiative'
  | 'spellAttack'
  | 'spellSaveDC'
  | 'hpMax'
  | 'speed'
  | 'passivePerception'
  | { kind: 'save'; ability: AbilityScore }
  | { kind: 'check'; ability: AbilityScore }
  | { kind: 'skill'; skill: Skill };

export const ModifierTargetSchema: z.ZodType<ModifierTarget> = z.union([
  z.literal('ac'),
  z.literal('attack'),
  z.literal('damage'),
  z.literal('initiative'),
  z.literal('spellAttack'),
  z.literal('spellSaveDC'),
  z.literal('hpMax'),
  z.literal('speed'),
  z.literal('passivePerception'),
  z.object({ kind: z.literal('save'), ability: AbilityScoreSchema }),
  z.object({ kind: z.literal('check'), ability: AbilityScoreSchema }),
  z.object({ kind: z.literal('skill'), skill: SkillSchema }),
]);

export type RollTarget =
  | 'attack'
  | 'damage'
  | 'initiative'
  | { kind: 'save'; ability: AbilityScore }
  | { kind: 'check'; ability: AbilityScore }
  | { kind: 'skill'; skill: Skill };

export const RollTargetSchema: z.ZodType<RollTarget> = z.union([
  z.literal('attack'),
  z.literal('damage'),
  z.literal('initiative'),
  z.object({ kind: z.literal('save'), ability: AbilityScoreSchema }),
  z.object({ kind: z.literal('check'), ability: AbilityScoreSchema }),
  z.object({ kind: z.literal('skill'), skill: SkillSchema }),
]);

export type TriggerAction =
  | { kind: 'AddDamage'; dice: DiceExpression; damageType: DamageType }
  | { kind: 'Heal'; amount: number | Formula }
  | { kind: 'ApplyCondition'; conditionId: string; durationRounds?: number }
  | { kind: 'SpendResource'; resourceId: string; amount: number }
  | { kind: 'ModifyDamageTaken'; amount: number | Formula; cap?: number }
  | { kind: 'EmitEvent'; eventType: string; payload?: unknown };

export const TriggerActionSchema: z.ZodType<TriggerAction> = z.union([
  z.object({
    kind: z.literal('AddDamage'),
    dice: DiceExpressionSchema,
    damageType: DamageTypeSchema,
  }),
  z.object({
    kind: z.literal('Heal'),
    amount: z.union([z.number(), FormulaSchema]),
  }),
  z.object({
    kind: z.literal('ApplyCondition'),
    conditionId: z.string(),
    durationRounds: z.number().int().optional(),
  }),
  z.object({
    kind: z.literal('SpendResource'),
    resourceId: z.string(),
    amount: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('ModifyDamageTaken'),
    amount: z.union([z.number(), FormulaSchema]),
    cap: z.number().optional(),
  }),
  z.object({
    kind: z.literal('EmitEvent'),
    eventType: z.string(),
    payload: z.unknown().optional(),
  }),
]);

export interface ChoiceOptionShape {
  id: string;
  label: string;
  effects: Effect[];
}

export type Effect =
  | { kind: 'GrantProficiency'; target: 'skill' | 'tool' | 'weapon' | 'armor' | 'save' | 'language'; id: string; level: ProficiencyLevel }
  | { kind: 'GrantSense'; sense: Sense; range: number }
  | { kind: 'ModifySpeed'; mode: MovementMode; op: 'set' | 'add' | 'multiply'; value: number }
  | { kind: 'AddModifier'; target: ModifierTarget; value: number | Formula; condition?: Predicate }
  | { kind: 'SetAdvantage'; on: RollTarget; mode: 'advantage' | 'disadvantage' | 'auto-crit' | 'auto-fail'; condition?: Predicate }
  // Direction-filtered advantage: only applies when the roll's target
  // (e.g. the attack's target creature) equals the bearing applied
  // condition's `sourceCharacterId`. Used by Bestow Curse's "Disadvantage
  // on attack rolls against the caster" variant. Has no effect when the
  // bearing condition has no `sourceCharacterId` (the planner stamps
  // this on spell-applied conditions since slice 88).
  | { kind: 'SetAdvantageVsSource'; on: RollTarget; mode: 'advantage' | 'disadvantage' | 'auto-crit' | 'auto-fail' }
  | { kind: 'GrantResistance'; damageType: DamageType | 'all'; condition?: Predicate }
  | { kind: 'GrantImmunity'; damageType: DamageType | 'all' }
  | { kind: 'GrantVulnerability'; damageType: DamageType }
  | { kind: 'GrantConditionImmunity'; conditionId: string }
  | { kind: 'OverrideACFormula'; base: number | 'dex' | 'con' | 'wis'; abilityModifiers: AbilityScore[]; dexCap?: number; priority?: number }
  // Sets a floor on the target's AC: after the natural AC is computed
  // from armor + DEX + modifiers, the result is bumped up to `value`
  // if it would otherwise be lower. Used by Barkskin (AC can't be
  // lower than 17 regardless of armor) and similar "minimum AC"
  // effects. Multiple floors fold to the highest. Distinct from
  // OverrideACFormula (which replaces the formula entirely and only
  // applies when unarmored).
  | { kind: 'SetACFloor'; value: number }
  | { kind: 'GrantResource'; resourceId: string; max: number | Formula; recharge: Recharge; diceSize?: number }
  | { kind: 'GrantSpellSlots'; level: SpellLevel; count: number; source: 'full' | 'half' | 'third' | 'pact' }
  | { kind: 'GrantSpell'; spellId: string; preparation: 'always-prepared' | 'prepared' | 'known' | 'at-will' | 'oncePerLongRest' | 'oncePerShortRest'; spellcastingAbility?: AbilityScore }
  | { kind: 'OnEvent'; id?: string; trigger: { eventType: string; filter?: Predicate }; actions: TriggerAction[]; oncePer?: 'turn' | 'round' | 'shortRest' | 'longRest'; requiresReaction?: boolean; consumeOnTrigger?: boolean }
  | { kind: 'RecoverResource'; resourceId: string; amount: number | 'all' | Formula; when: 'shortRest' | 'longRest' | 'turnStart' | 'turnEnd' | 'dawn' }
  | { kind: 'GrantAction'; actionId: string; name: string; cost: 'action' | 'bonusAction' | 'reaction' | 'free'; resourceCost?: { resourceId: string; amount: number } }
  | { kind: 'ModifyActionEconomy'; op: 'extraAttack' | 'extraAction' | 'extraBonusAction'; count: number; condition?: Predicate }
  | { kind: 'GrantWeaponMastery'; masteries: WeaponMastery[]; slots: number }
  | { kind: 'ExpandSpellList'; classId: string; spellIds: string[] }
  | { kind: 'SetHPMaxFormula'; formula: Formula }
  | { kind: 'OfferChoice'; choiceId: string; prompt: string; options: ChoiceOptionShape[]; oneOf: number; when: 'onAcquire' | 'onLevelUp' | 'onLongRest' }
  | { kind: 'FlatDamageReduction'; damageTypes: DamageType[]; amount: number }
  // Lowers the natural-d20 threshold at which the attacker's weapon
  // attacks crit. Default threshold is 20; Improved Critical sets 19,
  // Superior Critical sets 18. Multiple sources stack to the lowest.
  // Does not change auto-hit semantics: only a natural 20 auto-hits.
  | { kind: 'ExpandCritRange'; threshold: number }
  // Bard's Jack of All Trades and similar: any ability check the actor
  // is NOT already proficient in (skill prof level === 'none', or a raw
  // ability check with no skill) gains `floor(profBonus / 2)`. Existing
  // prof / expertise / half-prof are not stacked with.
  | { kind: 'GrantHalfProficiencyBonusFloor' }
  // Cleric's Disciple of Life and similar: boost the HP restored by
  // any healing spell of 1st level or higher cast by this character.
  // Total bonus per heal target is `flat + perSpellLevel * slotLevel`.
  // Cantrips (slotLevel 0) are excluded by the planner that reads this.
  | { kind: 'BoostHealing'; flat: number; perSpellLevel: number }
  // Rogue / Monk Evasion: when this character is forced to make a DEX
  // save against an area-effect spell that ordinarily halves on
  // success, they instead take no damage on success and half damage on
  // failure. Read by `planCastSpell` from the target's effect stack.
  | { kind: 'GrantEvasion' }
  // Cross-character effect: while this is active on a character, attacks
  // against that character are made with advantage. Used by Faerie Fire,
  // Hex (kind of), Hunter's Mark variants. The attack planner consults
  // the *target's* effect stack to pick this up; the attacker doesn't
  // need to know.
  | { kind: 'GrantAdvantageToAttackers'; condition?: Predicate }
  | { kind: 'ImposeDisadvantageOnAttackers'; condition?: Predicate }
  // A "this character projects an aura" marker. Auras are inherently
  // position-dependent (RAW typically "creatures within X feet"), and
  // the engine doesn't model continuous position. So this effect is
  // metadata-only: the consumer (dndbnb / DM tool / VTT) reads the
  // bearer's `GrantAura` effects, decides which characters are
  // currently in range using whatever position model it tracks, and
  // applies / removes the `allyConditionId` on those characters via
  // `ConditionApplied` / `ConditionRemoved` events. The bearer's own
  // self-effect (e.g. Aura of Courage also making the bearer Frightened-
  // immune) ships as a separate sibling effect on the same feature.
  | { kind: 'GrantAura'; auraId: string; rangeFeet: number; allyConditionId: string; description?: string }
  // Negates fall damage entirely (Feather Fall, Monk Slow Fall at
  // high tiers, similar). Distinct from damage-type immunity because
  // falling isn't a damage type — it's a damage source. planFalling
  // consults this when computing fall damage; presence zeroes the
  // outgoing DamageApplied.
  | { kind: 'GrantFallingProtection' }
  | { kind: 'Custom'; handlerId: string; params?: unknown };

export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal('GrantProficiency'),
      target: z.enum(['skill', 'tool', 'weapon', 'armor', 'save', 'language']),
      id: z.string(),
      level: ProficiencyLevelSchema,
    }),
    z.object({
      kind: z.literal('GrantSense'),
      sense: SenseSchema,
      range: z.number().int().min(0),
    }),
    z.object({
      kind: z.literal('ModifySpeed'),
      mode: MovementModeSchema,
      op: z.enum(['set', 'add', 'multiply']),
      value: z.number(),
    }),
    z.object({
      kind: z.literal('AddModifier'),
      target: ModifierTargetSchema,
      value: z.union([z.number(), FormulaSchema]),
      condition: PredicateSchema.optional(),
    }),
    z.object({
      kind: z.literal('SetAdvantage'),
      on: RollTargetSchema,
      mode: z.enum(['advantage', 'disadvantage', 'auto-crit', 'auto-fail']),
      condition: PredicateSchema.optional(),
    }),
    z.object({
      kind: z.literal('SetAdvantageVsSource'),
      on: RollTargetSchema,
      mode: z.enum(['advantage', 'disadvantage', 'auto-crit', 'auto-fail']),
    }),
    z.object({
      kind: z.literal('GrantResistance'),
      damageType: z.union([DamageTypeSchema, z.literal('all')]),
      condition: PredicateSchema.optional(),
    }),
    z.object({
      kind: z.literal('GrantImmunity'),
      damageType: z.union([DamageTypeSchema, z.literal('all')]),
    }),
    z.object({
      kind: z.literal('GrantVulnerability'),
      damageType: DamageTypeSchema,
    }),
    z.object({
      kind: z.literal('GrantConditionImmunity'),
      conditionId: z.string(),
    }),
    z.object({
      kind: z.literal('OverrideACFormula'),
      base: z.union([z.number(), z.literal('dex'), z.literal('con'), z.literal('wis')]),
      abilityModifiers: z.array(AbilityScoreSchema),
      dexCap: z.number().optional(),
      priority: z.number().int().optional(),
    }),
    z.object({
      kind: z.literal('SetACFloor'),
      value: z.number().int().min(1),
    }),
    z.object({
      kind: z.literal('GrantResource'),
      resourceId: z.string(),
      max: z.union([z.number().int().min(0), FormulaSchema]),
      recharge: RechargeSchema,
      diceSize: z.number().int().optional(),
    }),
    z.object({
      kind: z.literal('GrantSpellSlots'),
      level: SpellLevelSchema,
      count: z.number().int().min(0),
      source: z.enum(['full', 'half', 'third', 'pact']),
    }),
    z.object({
      kind: z.literal('GrantSpell'),
      spellId: z.string(),
      preparation: z.enum([
        'always-prepared',
        'prepared',
        'known',
        'at-will',
        'oncePerLongRest',
        'oncePerShortRest',
      ]),
      spellcastingAbility: AbilityScoreSchema.optional(),
    }),
    z.object({
      kind: z.literal('OnEvent'),
      id: z.string().optional(),
      trigger: z.object({
        eventType: z.string(),
        filter: PredicateSchema.optional(),
      }),
      actions: z.array(TriggerActionSchema),
      oncePer: z.enum(['turn', 'round', 'shortRest', 'longRest']).optional(),
      requiresReaction: z.boolean().optional(),
      consumeOnTrigger: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal('RecoverResource'),
      resourceId: z.string(),
      amount: z.union([z.number(), z.literal('all'), FormulaSchema]),
      when: z.enum(['shortRest', 'longRest', 'turnStart', 'turnEnd', 'dawn']),
    }),
    z.object({
      kind: z.literal('GrantAction'),
      actionId: z.string(),
      name: z.string(),
      cost: z.enum(['action', 'bonusAction', 'reaction', 'free']),
      resourceCost: z
        .object({ resourceId: z.string(), amount: z.number().int().min(1) })
        .optional(),
    }),
    z.object({
      kind: z.literal('ModifyActionEconomy'),
      op: z.enum(['extraAttack', 'extraAction', 'extraBonusAction']),
      count: z.number().int().min(1),
      condition: PredicateSchema.optional(),
    }),
    z.object({
      kind: z.literal('GrantWeaponMastery'),
      masteries: z.array(WeaponMasterySchema),
      slots: z.number().int().min(1),
    }),
    z.object({
      kind: z.literal('ExpandSpellList'),
      classId: z.string(),
      spellIds: z.array(z.string()),
    }),
    z.object({
      kind: z.literal('SetHPMaxFormula'),
      formula: FormulaSchema,
    }),
    z.object({
      kind: z.literal('OfferChoice'),
      choiceId: z.string(),
      prompt: z.string(),
      options: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            effects: z.array(EffectSchema),
          }),
        )
        .min(1),
      oneOf: z.number().int().min(1),
      when: z.enum(['onAcquire', 'onLevelUp', 'onLongRest']),
    }),
    z.object({
      kind: z.literal('FlatDamageReduction'),
      damageTypes: z.array(DamageTypeSchema).min(1),
      amount: z.number().int().min(1),
    }),
    z.object({
      kind: z.literal('ExpandCritRange'),
      threshold: z.number().int().min(2).max(20),
    }),
    z.object({
      kind: z.literal('GrantHalfProficiencyBonusFloor'),
    }),
    z.object({
      kind: z.literal('BoostHealing'),
      flat: z.number().int(),
      perSpellLevel: z.number().int(),
    }),
    z.object({
      kind: z.literal('GrantEvasion'),
    }),
    z.object({
      kind: z.literal('GrantAdvantageToAttackers'),
      condition: PredicateSchema.optional(),
    }),
    z.object({
      kind: z.literal('ImposeDisadvantageOnAttackers'),
      condition: PredicateSchema.optional(),
    }),
    z.object({
      kind: z.literal('GrantAura'),
      auraId: z.string(),
      rangeFeet: z.number().int().min(0),
      allyConditionId: z.string(),
      description: z.string().optional(),
    }),
    z.object({
      kind: z.literal('GrantFallingProtection'),
    }),
    z.object({
      kind: z.literal('Custom'),
      handlerId: z.string(),
      params: z.unknown().optional(),
    }),
  ]),
);

export type EffectKind = Effect['kind'];

export const EFFECT_KINDS = [
  'GrantProficiency',
  'GrantSense',
  'ModifySpeed',
  'AddModifier',
  'SetAdvantage',
  'SetAdvantageVsSource',
  'GrantResistance',
  'GrantImmunity',
  'GrantVulnerability',
  'GrantConditionImmunity',
  'OverrideACFormula',
  'SetACFloor',
  'GrantResource',
  'GrantSpellSlots',
  'GrantSpell',
  'OnEvent',
  'RecoverResource',
  'GrantAction',
  'ModifyActionEconomy',
  'GrantWeaponMastery',
  'ExpandSpellList',
  'SetHPMaxFormula',
  'OfferChoice',
  'FlatDamageReduction',
  'ExpandCritRange',
  'GrantHalfProficiencyBonusFloor',
  'BoostHealing',
  'GrantEvasion',
  'GrantAdvantageToAttackers',
  'ImposeDisadvantageOnAttackers',
  'GrantAura',
  'GrantFallingProtection',
  'Custom',
] as const satisfies ReadonlyArray<EffectKind>;
