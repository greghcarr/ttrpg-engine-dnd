import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { RNG } from '../../rng/index.js';
import type {
  PolymorphAppliedEvent,
  PolymorphForm,
  PolymorphKind,
} from '../../schemas/events/transformations.js';
import type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../schemas/events/spellcasting.js';
import type {
  ConcentrationBrokenEvent,
  ConcentrationStartedEvent,
} from '../../schemas/events/concentration.js';
import type { SaveRolledEvent } from '../../schemas/events/checks.js';
import type { ResourceSpentEvent } from '../../schemas/events/resources.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId, newEffectInstanceId } from '../../ids.js';
import { invariant } from '../../internal/invariants.js';
import { nowIso } from '../../internal/clock.js';
import { computeTotalLevel } from '../../schemas/runtime/character.js';
import { computeSpellSaveDC } from '../../derive/spell-dc.js';
import { computeSavingThrow } from '../../derive/save.js';
import { D20_SIDES } from '../../internal/constants.js';
import type { ULID } from '../ids-utils.js';

const POLYMORPH_MIN_SLOT = 4;
const POLYMORPH_DURATION_MINUTES = 60;

export interface PolymorphIntent {
  readonly type: 'Polymorph';
  readonly casterId: string;
  readonly targetId: string;
  readonly form: PolymorphForm;
  // The CR of the chosen Beast form. Validated against the target's
  // character level — RAW 2024: "the new form must be a Beast whose
  // Challenge Rating is no higher than the target's level (if a
  // character) or the target's Challenge Rating (if a creature)."
  // Form CR is data the consumer supplies because the engine doesn't
  // pre-load every PHB-2024 Beast statblock.
  readonly formCR: number;
  readonly slotLevel?: number;
  // Set true when the target resists. The planner rolls a WIS save and,
  // on success, stops short of PolymorphApplied (the slot is still
  // spent per RAW — the spell was cast, the save just defeated it).
  readonly unwilling?: boolean;
  readonly at?: string;
}

export interface PolymorphOutcome {
  readonly events: ReadonlyArray<Event>;
  // True when the unwilling target made the save and the polymorph did
  // not take effect. The slot was still spent.
  readonly resisted: boolean;
}

/**
 * RAW 2024 Polymorph: 4th level transmutation, action, V/S/M, range
 * 60 feet, concentration up to 1 hour. Transforms a creature you can
 * see into a Beast whose CR is at most the target's level. The new
 * form replaces physical stats (STR, DEX, CON, AC, HP, speed) while
 * mental stats stay. The target's original HP/wounds are preserved
 * for the revert. Polymorph ends on 0 HP in form (-> revert), on the
 * caster's concentration breaking, or voluntarily.
 *
 * Validates: caster knows Polymorph, has a 4th-level or higher slot,
 * isn't already concentrating on another spell (or breaks it), and the
 * chosen form's CR doesn't exceed the target's character level.
 */
export const planPolymorph = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: PolymorphIntent,
): PolymorphOutcome => {
  const caster = state.characters[intent.casterId];
  invariant(caster !== undefined, `Caster ${intent.casterId} not found`);
  const target = state.characters[intent.targetId];
  invariant(target !== undefined, `Target ${intent.targetId} not found`);

  const knowsSpell =
    caster.knownSpells.includes('polymorph') || caster.preparedSpells.includes('polymorph');
  invariant(knowsSpell, `Caster ${intent.casterId} does not know Polymorph`);

  const slotLevel = intent.slotLevel ?? POLYMORPH_MIN_SLOT;
  invariant(slotLevel >= POLYMORPH_MIN_SLOT, 'Polymorph is a 4th-level spell');

  // RAW: target's level caps the form's CR. For creatures we use total
  // level as a proxy — the engine doesn't track a separate CR field on
  // creature characters; consumers stat creatures with class levels that
  // approximate their CR.
  const targetCap = computeTotalLevel(target);
  if (intent.formCR > targetCap) {
    throw new Error(
      `Polymorph form CR ${intent.formCR} exceeds target's cap (${targetCap})`,
    );
  }

  invariant(target.polymorphedSnapshot === undefined, `${intent.targetId} is already polymorphed`);

  const at = intent.at ?? nowIso();
  const events: Event[] = [];

  const declared: SpellCastDeclaredEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SpellCastDeclared',
    characterId: intent.casterId,
    spellId: 'polymorph',
    slotLevel,
    slotSource: 'standard',
    targetIds: [intent.targetId],
    castAsRitual: false,
  };
  events.push(declared);
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'SpellSlotConsumed',
    characterId: intent.casterId,
    slotLevel,
  } satisfies SpellSlotConsumedEvent);

  // Unwilling targets: WIS save. The spell still spent the slot above.
  if (intent.unwilling === true) {
    const dcResult = computeSpellSaveDC({
      character: caster,
      itemInstances: state.itemInstances,
      content,
      classId: caster.classes[0]?.classId ?? 'wizard',
    });
    const saveDerivation = computeSavingThrow({
      character: target,
      itemInstances: state.itemInstances,
      content,
      ability: 'WIS',
    });
    const d20 = rollDie(D20_SIDES, rng);
    const total = d20 + saveDerivation.total;
    const success = total >= dcResult.total;
    const save: SaveRolledEvent = {
      id: newEventId() as ULID,
      at,
      type: 'SaveRolled',
      targetId: intent.targetId as ULID,
      ability: 'WIS',
      dc: dcResult.total,
      d20: [d20],
      used: 'none',
      bonus: saveDerivation.total,
      total,
      success,
      causedByEventId: declared.id,
      breakdown: [...saveDerivation.breakdown],
    };
    events.push(save);
    if (success) {
      return { events, resisted: true };
    }
  }

  // Break the caster's prior concentration (if any) before starting the
  // new one. RAW: starting a new concentration spell ends the old.
  if (caster.concentrationEffectId !== undefined) {
    events.push({
      id: newEventId() as ULID,
      at,
      type: 'ConcentrationBroken',
      effectInstanceId: caster.concentrationEffectId,
      casterId: intent.casterId as ULID,
      reason: 'newConcentrationSpell',
    } satisfies ConcentrationBrokenEvent);
  }

  const effectInstanceId = newEffectInstanceId();
  events.push({
    id: newEventId() as ULID,
    at,
    type: 'ConcentrationStarted',
    effectInstanceId,
    casterId: intent.casterId,
    spellId: 'polymorph',
    targetIds: [intent.targetId],
    conditionsApplied: [],
    durationMinutes: POLYMORPH_DURATION_MINUTES,
    slotLevel,
    causedByEventId: declared.id,
  } satisfies ConcentrationStartedEvent);

  events.push({
    id: newEventId() as ULID,
    at,
    type: 'PolymorphApplied',
    targetId: intent.targetId,
    casterId: intent.casterId,
    kind: 'polymorph' as PolymorphKind,
    form: intent.form,
    causedByEventId: declared.id,
  } satisfies PolymorphAppliedEvent);

  return { events, resisted: false };
};

const WILD_SHAPE_RESOURCE_ID = 'wild-shape';
const WILD_SHAPE_DRUID_MIN_LEVEL = 2;
const WILD_SHAPE_DURATION_MINUTES = 60;
const WILD_SHAPE_CR_BY_LEVEL: ReadonlyArray<{ minLevel: number; maxCR: number }> = [
  { minLevel: 8, maxCR: 1 },
  { minLevel: 4, maxCR: 0.5 },
  { minLevel: 2, maxCR: 0.25 },
];

const wildShapeMaxCR = (druidLevel: number): number => {
  for (const tier of WILD_SHAPE_CR_BY_LEVEL) {
    if (druidLevel >= tier.minLevel) return tier.maxCR;
  }
  return 0;
};

export interface WildShapeIntent {
  readonly type: 'WildShape';
  readonly druidId: string;
  readonly form: PolymorphForm;
  readonly formCR: number;
  // The form's natural movement modes. Used to enforce the level-gated
  // restrictions: <L4 can't take forms with a flying speed; <L8 can't
  // either (per the level-gated tiers in PHB 2024). The consumer
  // declares these explicitly so the engine doesn't have to peek
  // inside the form's stat block for speeds.
  readonly formHasFlyingSpeed?: boolean;
  readonly at?: string;
}

/**
 * RAW 2024 Wild Shape: druid feature, bonus action, transforms the
 * druid into a Beast form. Uses one Wild Shape charge per use; PHB
 * 2024 grants 2 charges that recover on a short rest. CR cap scales
 * with druid level: 1/4 at L2, 1/2 at L4, 1 at L8. Flying-speed forms
 * are gated until L8.
 *
 * Validates: druid level ≥ 2, has a Wild Shape resource pool with at
 * least 1 remaining, the form's CR is within the level cap, and the
 * druid isn't already polymorphed.
 *
 * Emits: ActionEconomyConsumed(bonusAction) if in an active encounter,
 * ResourceSpent('wild-shape', 1), PolymorphApplied(kind='wild-shape').
 * Wild Shape doesn't consume concentration in 2024 RAW.
 */
export const planWildShape = (
  state: CampaignState,
  _content: ResolvedContent,
  _rng: RNG,
  intent: WildShapeIntent,
): ReadonlyArray<Event> => {
  const druid = state.characters[intent.druidId];
  invariant(druid !== undefined, `Druid ${intent.druidId} not found`);
  const druidClass = druid.classes.find((c) => c.classId === 'druid');
  invariant(druidClass !== undefined, `${intent.druidId} is not a druid`);
  invariant(
    druidClass.level >= WILD_SHAPE_DRUID_MIN_LEVEL,
    `Wild Shape requires druid level ${WILD_SHAPE_DRUID_MIN_LEVEL}+`,
  );

  const maxCR = wildShapeMaxCR(druidClass.level);
  if (intent.formCR > maxCR) {
    throw new Error(`Form CR ${intent.formCR} exceeds Wild Shape cap at druid ${druidClass.level} (max ${maxCR})`);
  }
  if (intent.formHasFlyingSpeed === true && druidClass.level < 8) {
    throw new Error('Flying-speed forms require druid level 8+');
  }

  invariant(druid.polymorphedSnapshot === undefined, `${intent.druidId} is already polymorphed`);

  const pool = druid.resources.find((r) => r.resourceId === WILD_SHAPE_RESOURCE_ID);
  invariant(pool !== undefined, `${intent.druidId} has no Wild Shape resource pool`);
  invariant(pool.current >= 1, 'No Wild Shape uses remaining');

  const at = intent.at ?? nowIso();
  const events: Event[] = [];

  if (state.activeEncounterId !== undefined) {
    const encounter = state.encounters[state.activeEncounterId];
    if (encounter !== undefined && encounter.combatants.some((c) => c.combatantId === intent.druidId)) {
      events.push({
        id: newEventId() as ULID,
        at,
        type: 'ActionEconomyConsumed',
        encounterId: encounter.id,
        combatantId: intent.druidId,
        kind: 'bonusAction',
      } satisfies ActionEconomyConsumedEvent);
    }
  }

  events.push({
    id: newEventId() as ULID,
    at,
    type: 'ResourceSpent',
    characterId: intent.druidId,
    resourceId: WILD_SHAPE_RESOURCE_ID,
    amount: 1,
  } satisfies ResourceSpentEvent);

  const polymorphed: PolymorphAppliedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'PolymorphApplied',
    targetId: intent.druidId,
    casterId: intent.druidId,
    kind: 'wild-shape' as PolymorphKind,
    form: intent.form,
  };
  events.push(polymorphed);

  return events;
};

// Re-export the duration constants so test code can reference them
// without re-deriving the values.
export { WILD_SHAPE_DURATION_MINUTES };