import { z } from 'zod';
import {
  AbilityScoreSchema,
  DamageTypeSchema,
  DiceExpressionSchema,
  SpellLevelSchema,
  SpellSchoolSchema,
} from '../primitives.js';

const CANTRIP_SCALING_THRESHOLDS = [5, 11, 17] as const;

const SpellAttackMechanicSchema = z.object({
  kind: z.literal('attack'),
  damageDice: DiceExpressionSchema,
  damageType: DamageTypeSchema,
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
  cantripScalingDice: DiceExpressionSchema.optional(),
});

const SpellSaveMechanicSchema = z.object({
  kind: z.literal('save'),
  ability: AbilityScoreSchema,
  damageDice: DiceExpressionSchema.optional(),
  damageType: DamageTypeSchema.optional(),
  halfOnSuccess: z.boolean().optional(),
  conditionOnFail: z.string().optional(),
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
  cantripScalingDice: DiceExpressionSchema.optional(),
});

const SpellHealMechanicSchema = z.object({
  kind: z.literal('heal'),
  amountDice: DiceExpressionSchema.optional(),
  // Flat amount applied in addition to (or in place of) the rolled
  // amount. Useful for spells with fixed-value heals like Aid (+5 per
  // target). At least one of amountDice or flatAmount must be present.
  flatAmount: z.number().int().min(0).optional(),
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
});

// No save, no attack roll — fires N independent darts at the targets, with
// each target taking one dart's damage rolled separately. Used by Magic
// Missile and similar auto-hit spells. The targetIds list is expected to
// have one entry per dart (Magic Missile targets the same creature
// multiple times by repeating it).
const SpellAutoHitMechanicSchema = z.object({
  kind: z.literal('auto-hit'),
  damageDicePerDart: DiceExpressionSchema,
  damageType: DamageTypeSchema,
  dartsAtBaseSlot: z.number().int().min(1),
  extraDartsPerSlotLevel: z.number().int().min(0).default(0),
});

// Applies a beneficial condition to each willing target with no save
// (Bless, Aid, etc.). The condition's effects supply the actual bonuses;
// concentration spells track the applied conditions so they're cleared
// when concentration ends.
const SpellBuffMechanicSchema = z.object({
  kind: z.literal('buff'),
  conditionId: z.string(),
});

// Strips one of a fixed list of conditions from each target (Lesser
// Restoration removes one of: blinded / deafened / paralyzed /
// poisoned). The planner emits a ConditionRemoved event for the first
// matching condition the target currently has from the eligible list;
// if the target has none of them, nothing happens. The spell still
// resolves as a cast (declared + slot consumed); the lack of effect is
// a feature, not an error.
const SpellRemoveConditionMechanicSchema = z.object({
  kind: z.literal('remove-condition'),
  eligibleConditionIds: z.array(z.string()).min(1),
});

// Rolls a pool of dice; the total is "how many hit points of creatures"
// the spell can knock out. Targets within range are walked in ascending
// order of current HP — each target's full HP is subtracted from the
// pool and `conditionId` (typically `unconscious`) is applied, until
// the pool can no longer cover the next target. Used by Sleep. The
// planner skips targets that already have `conditionId` (per the 2024
// Sleep rewrite, an already-unconscious creature isn't affected).
const SpellHPPoolKnockoutMechanicSchema = z.object({
  kind: z.literal('hp-pool-knockout'),
  poolDice: DiceExpressionSchema,
  extraPoolDicePerSlotLevel: DiceExpressionSchema.optional(),
  conditionId: z.string(),
});

// Concentration aura that ticks per-trigger against creatures in
// range. Cast-time emits ConcentrationStarted only — no save or
// damage fires. The consumer calls `engine.plan.tickAura({ casterId,
// targetIds })` at the appropriate moments (entering the area /
// starting a turn in it, per RAW) and the engine rolls a save (if
// configured) and applies damage and/or a condition per target.
//
// Used by Spirit Guardians (damage-only with save), Stinking Cloud
// (condition-only with save), the Wall-of-X family (damage + half
// on save), Entangle / Grease (condition-only with save), Cloud
// of Daggers (auto-damage no save), and similar persistent area
// effects.
//
// Optionality matrix:
// - `saveAbility` omitted → no save roll; damage / condition apply
//   unconditionally (Cloud of Daggers: 4d4 slashing every turn).
// - `damageDice` / `damageType` omitted → condition-only zone
//   (Stinking Cloud, Entangle).
// - `conditionOnFail` set → applies the condition when the save
//   fails (or unconditionally when no save). Gated by the target's
//   existing condition immunities via `isImmuneToCondition`.
// The optional `trigger` field tags a mechanic with a specific
// activation moment so multi-component zones (Hunger of Hadar:
// 2d6 cold on enter + 2d6 acid on turn end) can express both
// components as sibling mechanics. The tickAura intent carries a
// matching trigger; the planner fires only matching mechanics.
// Mechanics without a trigger are "legacy" / unconstrained — they
// fire on every tickAura call (preserving backward compat with
// Spirit Guardians and the other single-component zones).
export const AURA_TRIGGERS = ['on-enter', 'on-turn-start', 'on-turn-end'] as const;
const AuraTriggerSchema = z.enum(AURA_TRIGGERS);
export type AuraTrigger = z.infer<typeof AuraTriggerSchema>;

// Per-foot-moved damage zone. The classic Spike Growth shape:
// "creature that moves into or within the area takes 2d4 piercing
// for every 5 ft it travels." No save, no concentration tick — the
// consumer detects movement through the zone and calls
// `engine.plan.tickMovementDamage({ casterId, targetId, feetMoved })`,
// which rolls `damageDicePerFiveFeet` * floor(feetMoved / 5) dice
// and emits a single DamageApplied. Distinct from aura-damage's
// per-tick semantics so the two stay legible.
const SpellMovementDamageMechanicSchema = z.object({
  kind: z.literal('movement-damage'),
  rangeFeet: z.number().int().min(0),
  damageDicePerFiveFeet: DiceExpressionSchema,
  damageType: DamageTypeSchema,
});

const SpellAuraDamageMechanicSchema = z.object({
  kind: z.literal('aura-damage'),
  rangeFeet: z.number().int().min(0),
  saveAbility: AbilityScoreSchema.optional(),
  damageDice: DiceExpressionSchema.optional(),
  damageType: DamageTypeSchema.optional(),
  halfOnSuccess: z.boolean().default(true),
  extraDicePerSlotLevel: z.number().int().min(0).optional(),
  conditionOnFail: z.string().optional(),
  trigger: AuraTriggerSchema.optional(),
});

// Creates a controllable companion ("summon") under the caster's
// control. Each summon spell carries its statblock inline so a pack
// can wire a spell without referencing an external creature
// catalogue. HP scales with slot level as
// `hpBase + hpPerSlotAbove * (slotLevel - baseSlotLevel)`. When the
// spell is concentration, the companion is dismissed automatically
// when concentration ends (clearConcentrationEffect walks the
// characters map and removes any whose `summonSource.effectInstanceId`
// matches the ending effect).
const SpellSummonMechanicSchema = z.object({
  kind: z.literal('summon'),
  name: z.string(),
  ac: z.number().int().min(0),
  hpBase: z.number().int().min(1),
  hpPerSlotAbove: z.number().int().min(0).default(0),
  baseSlotLevel: z.number().int().min(1).max(9),
  speedFeet: z.number().int().min(0).default(30),
});

export const SPELL_AREA_SHAPES = ['cone', 'cube', 'line', 'sphere', 'cylinder'] as const;
export const SpellAreaShapeSchema = z.enum(SPELL_AREA_SHAPES);
export type SpellAreaShape = z.infer<typeof SpellAreaShapeSchema>;

export const SpellTargetingSchema = z.object({
  shape: SpellAreaShapeSchema,
  size: z.number().int().min(1),
});
export type SpellTargeting = z.infer<typeof SpellTargetingSchema>;

export const cantripExtraDice = (characterLevel: number): number => {
  let extra = 0;
  for (const threshold of CANTRIP_SCALING_THRESHOLDS) {
    if (characterLevel >= threshold) extra += 1;
  }
  return extra;
};

export const SpellMechanicSchema = z.discriminatedUnion('kind', [
  SpellAttackMechanicSchema,
  SpellSaveMechanicSchema,
  SpellHealMechanicSchema,
  SpellAutoHitMechanicSchema,
  SpellBuffMechanicSchema,
  SpellRemoveConditionMechanicSchema,
  SpellHPPoolKnockoutMechanicSchema,
  SpellAuraDamageMechanicSchema,
  SpellMovementDamageMechanicSchema,
  SpellSummonMechanicSchema,
]);
export type SpellMechanic = z.infer<typeof SpellMechanicSchema>;

export const SpellSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: SpellLevelSchema,
  school: SpellSchoolSchema,
  castingTime: z.string(),
  range: z.string(),
  components: z.object({
    verbal: z.boolean().default(false),
    somatic: z.boolean().default(false),
    material: z.string().optional(),
  }),
  duration: z.string(),
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  classes: z.array(z.string()).default([]),
  description: z.string().optional(),
  mechanicalEffects: z.array(SpellMechanicSchema).default([]),
  targeting: SpellTargetingSchema.optional(),
});
export type Spell = z.infer<typeof SpellSchema>;
