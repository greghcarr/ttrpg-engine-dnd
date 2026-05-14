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
  | { kind: 'GrantResistance'; damageType: DamageType | 'all'; condition?: Predicate }
  | { kind: 'GrantImmunity'; damageType: DamageType | 'all' }
  | { kind: 'GrantVulnerability'; damageType: DamageType }
  | { kind: 'GrantConditionImmunity'; conditionId: string }
  | { kind: 'OverrideACFormula'; base: number | 'dex' | 'con' | 'wis'; abilityModifiers: AbilityScore[]; dexCap?: number; priority?: number }
  | { kind: 'GrantResource'; resourceId: string; max: number | Formula; recharge: Recharge; diceSize?: number }
  | { kind: 'GrantSpellSlots'; level: SpellLevel; count: number; source: 'full' | 'half' | 'third' | 'pact' }
  | { kind: 'GrantSpell'; spellId: string; preparation: 'always-prepared' | 'prepared' | 'known' | 'at-will' | 'oncePerLongRest' | 'oncePerShortRest'; spellcastingAbility?: AbilityScore }
  | { kind: 'OnEvent'; id?: string; trigger: { eventType: string; filter?: Predicate }; actions: TriggerAction[]; oncePer?: 'turn' | 'round' | 'shortRest' | 'longRest'; requiresReaction?: boolean }
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
  // Cross-character effect: while this is active on a character, attacks
  // against that character are made with advantage. Used by Faerie Fire,
  // Hex (kind of), Hunter's Mark variants. The attack planner consults
  // the *target's* effect stack to pick this up; the attacker doesn't
  // need to know.
  | { kind: 'GrantAdvantageToAttackers'; condition?: Predicate }
  | { kind: 'ImposeDisadvantageOnAttackers'; condition?: Predicate }
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
      kind: z.literal('GrantAdvantageToAttackers'),
      condition: PredicateSchema.optional(),
    }),
    z.object({
      kind: z.literal('ImposeDisadvantageOnAttackers'),
      condition: PredicateSchema.optional(),
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
  'GrantResistance',
  'GrantImmunity',
  'GrantVulnerability',
  'GrantConditionImmunity',
  'OverrideACFormula',
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
  'GrantAdvantageToAttackers',
  'ImposeDisadvantageOnAttackers',
  'Custom',
] as const satisfies ReadonlyArray<EffectKind>;
