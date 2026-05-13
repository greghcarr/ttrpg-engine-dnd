import type { CampaignState } from '../schemas/runtime/campaign.js';
import { emptyCampaignState } from '../schemas/runtime/campaign.js';
import type { Event } from '../schemas/events/index.js';
import type { ContentPack, ResolvedContent } from '../content/pack.js';
import { resolveContent } from '../content/pack.js';
import { validateCrossReferences } from '../content/validate.js';
import type { RNG } from '../rng/index.js';
import { defaultRNG } from '../rng/default.js';
import type { HandlerRegistry } from '../handlers/index.js';
import { apply, applyAll } from './apply.js';
import { replay } from './replay.js';
import { commit, type Campaign } from './commit.js';
import { undo, redo } from './undo-redo.js';

export { apply, applyAll } from './apply.js';
export { replay } from './replay.js';
export { commit } from './commit.js';
export { undo, redo } from './undo-redo.js';
export { performIntent, serializeCampaign, loadCampaign, createPC } from './conveniences.js';
export type { CreatePCOptions, SerializedCampaign } from './conveniences.js';
import { performIntent } from './conveniences.js';
import {
  planShortRest,
  planLongRest,
  planAttack,
  planCreateEncounter,
  planRollInitiative,
  planStartEncounter,
  planBeginFirstTurn,
  planAdvanceTurn,
  planEndEncounter,
  planLevelUp,
  planResolveChoice,
  planSave,
  planAbilityCheck,
  planCastSpell,
  planCheckConcentration,
  planOpportunityAttack,
  planMove,
  planDash,
  planDisengage,
  planActionSurge,
  planOffHandAttack,
  planMultiattack,
  planFalling,
  planGrapple,
  planShove,
  planHide,
  planCounterspell,
  planDispelMagic,
  planIdentify,
  planWeaponMastery,
  planForage,
  planNavigationCheck,
  planMoraleCheck,
  planReactionRoll,
  planResurrect,
  type GrappleIntent,
  type ShoveIntent,
  type HideIntent,
  type CounterspellIntent,
  type DispelMagicIntent,
  type IdentifyIntent,
  type WeaponMasteryIntent,
  type ForageIntent,
  type NavigationCheckIntent,
  type MoraleCheckIntent,
  type ReactionRollIntent,
  type ResurrectIntent,
  type RestIntent,
  type AttackIntent,
  type OpportunityAttackIntent,
  type MoveIntent,
  type DashIntent,
  type DisengageIntent,
  type ActionSurgeIntent,
  type OffHandAttackIntent,
  type MultiattackIntent,
  type FallingIntent,
  type CreateEncounterIntent,
  type RollInitiativeIntent,
  type StartEncounterIntent,
  type AdvanceTurnIntent,
  type BeginFirstTurnIntent,
  type EndEncounterIntent,
  type LevelUpIntent,
  type ResolveChoiceIntent,
  type SaveIntent,
  type AbilityCheckIntent,
  type CastSpellIntent,
  type CheckConcentrationIntent,
} from './plan/index.js';
import { newCampaignId } from '../ids.js';
import { SCHEMA_VERSION } from '../version.js';
import { computeAC } from '../derive/ac.js';
import { computeSavingThrow } from '../derive/save.js';
import { computeAttackBonus } from '../derive/attack.js';
import { computeSpellSaveDC, computeSpellAttackBonus } from '../derive/spell-dc.js';
import { computeDerivedCharacter } from '../derive/character-view.js';
import { computeSpellSlots } from '../derive/spell-slots.js';
import { abilityModifier, proficiencyBonus } from '../derive/ability.js';
import type { AbilityScore } from '../schemas/primitives.js';

export interface CreateEngineOptions {
  readonly rng?: RNG;
  readonly contentPacks: ReadonlyArray<ContentPack>;
  readonly handlers?: HandlerRegistry;
}

export interface CampaignInit {
  readonly id?: string;
  readonly name: string;
}

export interface PlanResult {
  readonly events: ReadonlyArray<Event>;
}

export interface Engine {
  readonly content: ResolvedContent;
  readonly schemaVersion: number;
  readonly rng: RNG;

  createCampaign(init: CampaignInit): Campaign;

  apply(state: CampaignState, event: Event): CampaignState;
  applyAll(state: CampaignState, events: ReadonlyArray<Event>): CampaignState;
  replay(events: ReadonlyArray<Event>): CampaignState;
  commit(campaign: Campaign, events: ReadonlyArray<Event>): Campaign;
  undo(campaign: Campaign): Campaign;
  redo(campaign: Campaign): Campaign;
  do(campaign: Campaign, intent: { readonly type: string } & Record<string, unknown>): Campaign;

  plan: {
    shortRest(state: CampaignState, intent: { participantIds: ReadonlyArray<string>; at?: string }): PlanResult;
    longRest(state: CampaignState, intent: { participantIds: ReadonlyArray<string>; at?: string }): PlanResult;
    rest(state: CampaignState, intent: RestIntent): PlanResult;
    attack(state: CampaignState, intent: Omit<AttackIntent, 'type'>): PlanResult;
    opportunityAttack(state: CampaignState, intent: Omit<OpportunityAttackIntent, 'type'>): PlanResult;
    createEncounter(
      state: CampaignState,
      intent: Omit<CreateEncounterIntent, 'type'>,
    ): { events: ReadonlyArray<Event>; encounterId: string };
    rollInitiative(state: CampaignState, intent: Omit<RollInitiativeIntent, 'type'>): PlanResult;
    startEncounter(state: CampaignState, intent: Omit<StartEncounterIntent, 'type'>): PlanResult;
    beginFirstTurn(state: CampaignState, intent: Omit<BeginFirstTurnIntent, 'type'>): PlanResult;
    advanceTurn(state: CampaignState, intent: Omit<AdvanceTurnIntent, 'type'>): PlanResult;
    endEncounter(state: CampaignState, intent: Omit<EndEncounterIntent, 'type'>): PlanResult;
    levelUp(state: CampaignState, intent: Omit<LevelUpIntent, 'type'>): PlanResult;
    resolveChoice(state: CampaignState, intent: Omit<ResolveChoiceIntent, 'type'>): PlanResult;
    save(state: CampaignState, intent: Omit<SaveIntent, 'type'>): PlanResult;
    abilityCheck(state: CampaignState, intent: Omit<AbilityCheckIntent, 'type'>): PlanResult;
    castSpell(state: CampaignState, intent: Omit<CastSpellIntent, 'type'>): PlanResult;
    checkConcentration(
      state: CampaignState,
      intent: Omit<CheckConcentrationIntent, 'type'>,
    ): PlanResult;
    move(state: CampaignState, intent: Omit<MoveIntent, 'type'>): PlanResult;
    dash(state: CampaignState, intent: Omit<DashIntent, 'type'>): PlanResult;
    disengage(state: CampaignState, intent: Omit<DisengageIntent, 'type'>): PlanResult;
    actionSurge(state: CampaignState, intent: Omit<ActionSurgeIntent, 'type'>): PlanResult;
    offHandAttack(state: CampaignState, intent: Omit<OffHandAttackIntent, 'type'>): PlanResult;
    multiattack(state: CampaignState, intent: Omit<MultiattackIntent, 'type'>): PlanResult;
    falling(state: CampaignState, intent: Omit<FallingIntent, 'type'>): PlanResult;
    grapple(state: CampaignState, intent: Omit<GrappleIntent, 'type'>): PlanResult;
    shove(state: CampaignState, intent: Omit<ShoveIntent, 'type'>): PlanResult;
    hide(state: CampaignState, intent: Omit<HideIntent, 'type'>): PlanResult;
    counterspell(state: CampaignState, intent: Omit<CounterspellIntent, 'type'>): PlanResult;
    dispelMagic(state: CampaignState, intent: Omit<DispelMagicIntent, 'type'>): PlanResult;
    identify(state: CampaignState, intent: Omit<IdentifyIntent, 'type'>): PlanResult;
    weaponMastery(state: CampaignState, intent: Omit<WeaponMasteryIntent, 'type'>): PlanResult;
    forage(state: CampaignState, intent: Omit<ForageIntent, 'type'>): PlanResult;
    navigationCheck(state: CampaignState, intent: Omit<NavigationCheckIntent, 'type'>): PlanResult;
    moraleCheck(state: CampaignState, intent: Omit<MoraleCheckIntent, 'type'>): PlanResult;
    reactionRoll(state: CampaignState, intent: Omit<ReactionRollIntent, 'type'>): PlanResult;
    resurrect(state: CampaignState, intent: Omit<ResurrectIntent, 'type'>): PlanResult;
  };

  derive: {
    character(state: CampaignState, id: string): ReturnType<typeof computeDerivedCharacter>;
    ac(state: CampaignState, characterId: string): ReturnType<typeof computeAC>;
    savingThrow(state: CampaignState, characterId: string, ability: AbilityScore): ReturnType<typeof computeSavingThrow>;
    attackBonus(state: CampaignState, characterId: string, weaponInstanceId: string): ReturnType<typeof computeAttackBonus>;
    spellSaveDC(state: CampaignState, characterId: string, classId: string): ReturnType<typeof computeSpellSaveDC>;
    spellAttackBonus(state: CampaignState, characterId: string, classId: string): ReturnType<typeof computeSpellAttackBonus>;
    spellSlots(state: CampaignState, characterId: string): ReturnType<typeof computeSpellSlots>;
    abilityModifier(score: number): number;
    proficiencyBonus(level: number): number;
  };
}

const requireCharacter = (state: CampaignState, id: string) => {
  const c = state.characters[id];
  if (!c) throw new Error(`Unknown character ${id}`);
  return c;
};

export const createEngine = (opts: CreateEngineOptions): Engine => {
  const content = resolveContent(opts.contentPacks);
  const validationIssues = validateCrossReferences(content);
  if (validationIssues.length > 0) {
    const formatted = validationIssues.map((i) => `${i.path}: ${i.message}`).join('\n');
    throw new Error(`Content pack cross-reference validation failed:\n${formatted}`);
  }
  const rng = opts.rng ?? defaultRNG();

  const planNs: Engine['plan'] = {
    shortRest(state, intent) {
      return { events: planShortRest(state, { type: 'ShortRest', ...intent }) };
    },
    longRest(state, intent) {
      return { events: planLongRest(state, { type: 'LongRest', ...intent }) };
    },
    rest(state, intent) {
      if (intent.type === 'ShortRest') return { events: planShortRest(state, intent) };
      return { events: planLongRest(state, intent) };
    },
    attack(state, intent) {
      return { events: planAttack(state, content, rng, { type: 'Attack', ...intent }) };
    },
    opportunityAttack(state, intent) {
      return {
        events: planOpportunityAttack(state, content, rng, {
          type: 'OpportunityAttack',
          ...intent,
        }),
      };
    },
    createEncounter(state, intent) {
      return planCreateEncounter(state, content, { type: 'CreateEncounter', ...intent });
    },
    rollInitiative(state, intent) {
      return {
        events: planRollInitiative(state, content, rng, { type: 'RollInitiative', ...intent }),
      };
    },
    startEncounter(state, intent) {
      return { events: planStartEncounter(state, content, { type: 'StartEncounter', ...intent }) };
    },
    beginFirstTurn(state, intent) {
      return { events: planBeginFirstTurn(state, content, { type: 'BeginFirstTurn', ...intent }) };
    },
    advanceTurn(state, intent) {
      return { events: planAdvanceTurn(state, content, { type: 'AdvanceTurn', ...intent }) };
    },
    endEncounter(state, intent) {
      return { events: planEndEncounter(state, content, { type: 'EndEncounter', ...intent }) };
    },
    levelUp(state, intent) {
      return { events: planLevelUp(state, content, rng, { type: 'LevelUp', ...intent }) };
    },
    resolveChoice(state, intent) {
      return { events: planResolveChoice(state, content, { type: 'ResolveChoice', ...intent }) };
    },
    save(state, intent) {
      return { events: planSave(state, content, rng, { type: 'Save', ...intent }) };
    },
    abilityCheck(state, intent) {
      return { events: planAbilityCheck(state, content, rng, { type: 'AbilityCheck', ...intent }) };
    },
    castSpell(state, intent) {
      return { events: planCastSpell(state, content, rng, { type: 'CastSpell', ...intent }) };
    },
    checkConcentration(state, intent) {
      return {
        events: planCheckConcentration(state, content, rng, {
          type: 'CheckConcentration',
          ...intent,
        }),
      };
    },
    move(state, intent) {
      return { events: planMove(state, content, { type: 'Move', ...intent }) };
    },
    dash(state, intent) {
      return { events: planDash(state, content, { type: 'Dash', ...intent }) };
    },
    disengage(state, intent) {
      return { events: planDisengage(state, content, { type: 'Disengage', ...intent }) };
    },
    actionSurge(state, intent) {
      return { events: planActionSurge(state, content, { type: 'ActionSurge', ...intent }) };
    },
    offHandAttack(state, intent) {
      return { events: planOffHandAttack(state, content, rng, { type: 'OffHandAttack', ...intent }) };
    },
    multiattack(state, intent) {
      return { events: planMultiattack(state, content, rng, { type: 'Multiattack', ...intent }) };
    },
    falling(state, intent) {
      return { events: planFalling(state, content, { type: 'Falling', ...intent }) };
    },
    grapple(state, intent) {
      return { events: planGrapple(state, content, rng, { type: 'Grapple', ...intent }) };
    },
    shove(state, intent) {
      return { events: planShove(state, content, rng, { type: 'Shove', ...intent }) };
    },
    hide(state, intent) {
      return { events: planHide(state, content, rng, { type: 'Hide', ...intent }) };
    },
    counterspell(state, intent) {
      return { events: planCounterspell(state, content, rng, { type: 'Counterspell', ...intent }) };
    },
    dispelMagic(state, intent) {
      return { events: planDispelMagic(state, content, rng, { type: 'DispelMagic', ...intent }) };
    },
    identify(state, intent) {
      return { events: planIdentify(state, content, rng, { type: 'Identify', ...intent }) };
    },
    weaponMastery(state, intent) {
      return { events: planWeaponMastery(state, content, rng, { type: 'WeaponMastery', ...intent }) };
    },
    forage(state, intent) {
      return { events: planForage(state, content, rng, { type: 'Forage', ...intent }) };
    },
    navigationCheck(state, intent) {
      return { events: planNavigationCheck(state, content, rng, { type: 'NavigationCheck', ...intent }) };
    },
    moraleCheck(state, intent) {
      return { events: planMoraleCheck(state, content, rng, { type: 'MoraleCheck', ...intent }) };
    },
    reactionRoll(state, intent) {
      return { events: planReactionRoll(state, content, rng, { type: 'ReactionRoll', ...intent }) };
    },
    resurrect(state, intent) {
      return { events: planResurrect(state, content, { type: 'Resurrect', ...intent }) };
    },
  };

  const memo = new Map<string, unknown>();
  let memoVersion = -1;
  const memoize = <T>(args: ReadonlyArray<string | number>, state: CampaignState, compute: () => T): T => {
    if (state.version !== memoVersion) {
      memo.clear();
      memoVersion = state.version;
    }
    const key = args.join('|');
    if (memo.has(key)) return memo.get(key) as T;
    const result = compute();
    memo.set(key, result);
    return result;
  };

  const deriveNs: Engine['derive'] = {
    character(state, id) {
      return memoize(['character', id], state, () =>
        computeDerivedCharacter({
          character: requireCharacter(state, id),
          itemInstances: state.itemInstances,
          content,
          pendingChoices: state.pendingChoices,
        }),
      );
    },
    ac(state, id) {
      return memoize(['ac', id], state, () =>
        computeAC({
          character: requireCharacter(state, id),
          itemInstances: state.itemInstances,
          content,
          pendingChoices: state.pendingChoices,
        }),
      );
    },
    savingThrow(state, id, ability) {
      return memoize(['save', id, ability], state, () =>
        computeSavingThrow({
          character: requireCharacter(state, id),
          itemInstances: state.itemInstances,
          content,
          pendingChoices: state.pendingChoices,
          ability,
        }),
      );
    },
    attackBonus(state, id, weaponInstanceId) {
      return memoize(['attack', id, weaponInstanceId], state, () =>
        computeAttackBonus({
          character: requireCharacter(state, id),
          itemInstances: state.itemInstances,
          content,
          pendingChoices: state.pendingChoices,
          weaponInstanceId,
        }),
      );
    },
    spellSaveDC(state, id, classId) {
      return memoize(['spellDC', id, classId], state, () =>
        computeSpellSaveDC({
          character: requireCharacter(state, id),
          itemInstances: state.itemInstances,
          content,
          pendingChoices: state.pendingChoices,
          classId,
        }),
      );
    },
    spellAttackBonus(state, id, classId) {
      return memoize(['spellAtk', id, classId], state, () =>
        computeSpellAttackBonus({
          character: requireCharacter(state, id),
          itemInstances: state.itemInstances,
          content,
          pendingChoices: state.pendingChoices,
          classId,
        }),
      );
    },
    spellSlots(state, id) {
      return memoize(['slots', id], state, () =>
        computeSpellSlots(requireCharacter(state, id), content.classes),
      );
    },
    abilityModifier(score) {
      return abilityModifier(score);
    },
    proficiencyBonus(level) {
      return proficiencyBonus(level);
    },
  };

  return {
    content,
    schemaVersion: SCHEMA_VERSION,
    rng,
    createCampaign(init) {
      return {
        id: init.id ?? newCampaignId(),
        name: init.name,
        state: emptyCampaignState(),
        events: [],
        cursor: 0,
        schemaVersion: SCHEMA_VERSION,
      };
    },
    apply,
    applyAll,
    replay,
    commit,
    undo,
    redo,
    do(campaign, intent) {
      return performIntent(this, campaign, intent);
    },
    plan: planNs,
    derive: deriveNs,
  };
};

export type { Campaign } from './commit.js';
