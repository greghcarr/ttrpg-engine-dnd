import type { CampaignState } from '../schemas/runtime/campaign.js';
import type { Event } from '../schemas/events/index.js';
import { immerProduce } from '../internal/immer.js';
import { applyCharacterCreated } from './reducers/progression.js';
import {
  applyConditionApplied,
  applyConditionRemoved,
  applyDamageApplied,
  applyDeathSaveRolled,
  applyExhaustionChanged,
  applyHealed,
  applyStabilized,
  applyTempHPGranted,
} from './reducers/combat.js';
import {
  applyHitDieSpent,
  applyResourceRestored,
  applyResourceSpent,
} from './reducers/resources.js';
import {
  applyLongRestEnded,
  applyLongRestStarted,
  applyShortRestEnded,
  applyShortRestStarted,
} from './reducers/rest.js';
import {
  applyEncounterCreated,
  applyEncounterEnded,
  applyEncounterStarted,
  applyInitiativeRolled,
  applyRoundEnded,
  applyTurnEnded,
  applyTurnStarted,
} from './reducers/encounter.js';
import { applyAttackRolled, applyDamageRolled } from './reducers/attack.js';
import {
  applyItemAcquired,
  applyItemAttuned,
  applyItemEquipped,
  applyItemUnattuned,
  applyItemUnequipped,
} from './reducers/inventory.js';
import {
  applyChoiceRequired,
  applyChoiceResolved,
  applyLevelUpResolved,
} from './reducers/level-up.js';
import { applyAbilityCheckRolled, applySaveRolled } from './reducers/checks.js';
import {
  applyPactSlotConsumed,
  applySpellCastDeclared,
  applySpellSlotConsumed,
} from './reducers/spellcasting.js';
import {
  applyConcentrationBroken,
  applyConcentrationStarted,
} from './reducers/concentration.js';
import { applyTriggerFired } from './reducers/triggers.js';
import { applyActionEconomyConsumed } from './reducers/action-economy.js';
import {
  applyCombatantMoved,
  applyDashed,
  applyDisengaged,
} from './reducers/movement.js';
import {
  applyPartyCreated,
  applyPartyMembersChanged,
  applyCurrencyAcquired,
  applyCurrencySpent,
  applyItemDepositedToParty,
  applyItemWithdrawnFromParty,
} from './reducers/party.js';
import {
  applySessionStarted,
  applySessionEnded,
  applyJournalEntryAdded,
  applyInGameTimeAdvanced,
} from './reducers/session.js';
import {
  applyLocationCreated,
  applyDoorAdded,
  applyDoorStateChanged,
  applyCharacterLocationChanged,
} from './reducers/locations.js';
import {
  applyQuestStarted,
  applyObjectiveProgressed,
  applyObjectiveCompleted,
  applyObjectiveFailed,
  applyQuestCompleted,
  applyQuestFailed,
  applyQuestAbandoned,
  applyQuestRewardClaimed,
  applyXPAwarded,
  applyMilestoneAwarded,
} from './reducers/quests.js';
import {
  applySpellCountered,
  applySpellDispelled,
  applyItemIdentified,
} from './reducers/reactive-spells.js';
import { applyWeaponMasteryActivated } from './reducers/weapon-mastery.js';
import {
  applyMounted,
  applyDismounted,
  applyVehicleAcquired,
  applyVehicleBoarded,
  applyVehicleDeparted,
  applyVehicleDamaged,
  applyVehicleRepaired,
} from './reducers/mounts-vehicles.js';
import {
  applyTravelLegCompleted,
  applyNavigationCheckRolled,
  applyForagedFor,
} from './reducers/travel.js';
import {
  applyAttitudeChanged,
  applyMoraleCheckRolled,
  applyMoraleBroken,
} from './reducers/npc.js';
import { invariant } from '../internal/invariants.js';

export const apply = (state: CampaignState, event: Event): CampaignState =>
  immerProduce(state, (draft) => {
    switch (event.type) {
      case 'CharacterCreated':
        applyCharacterCreated(draft, event);
        break;
      case 'DamageApplied':
        applyDamageApplied(draft, event);
        break;
      case 'Healed':
        applyHealed(draft, event);
        break;
      case 'TempHPGranted':
        applyTempHPGranted(draft, event);
        break;
      case 'ConditionApplied':
        applyConditionApplied(draft, event);
        break;
      case 'ConditionRemoved':
        applyConditionRemoved(draft, event);
        break;
      case 'ExhaustionChanged':
        applyExhaustionChanged(draft, event);
        break;
      case 'DeathSaveRolled':
        applyDeathSaveRolled(draft, event);
        break;
      case 'Stabilized':
        applyStabilized(draft, event);
        break;
      case 'ResourceSpent':
        applyResourceSpent(draft, event);
        break;
      case 'ResourceRestored':
        applyResourceRestored(draft, event);
        break;
      case 'HitDieSpent':
        applyHitDieSpent(draft, event);
        break;
      case 'ShortRestStarted':
        applyShortRestStarted(draft, event);
        break;
      case 'ShortRestEnded':
        applyShortRestEnded(draft, event);
        break;
      case 'LongRestStarted':
        applyLongRestStarted(draft, event);
        break;
      case 'LongRestEnded':
        applyLongRestEnded(draft, event);
        break;
      case 'EncounterCreated':
        applyEncounterCreated(draft, event);
        break;
      case 'EncounterStarted':
        applyEncounterStarted(draft, event);
        break;
      case 'InitiativeRolled':
        applyInitiativeRolled(draft, event);
        break;
      case 'TurnStarted':
        applyTurnStarted(draft, event);
        break;
      case 'TurnEnded':
        applyTurnEnded(draft, event);
        break;
      case 'RoundEnded':
        applyRoundEnded(draft, event);
        break;
      case 'EncounterEnded':
        applyEncounterEnded(draft, event);
        break;
      case 'AttackRolled':
        applyAttackRolled(draft, event);
        break;
      case 'DamageRolled':
        applyDamageRolled(draft, event);
        break;
      case 'ItemAcquired':
        applyItemAcquired(draft, event);
        break;
      case 'LevelUpResolved':
        applyLevelUpResolved(draft, event);
        break;
      case 'ChoiceRequired':
        applyChoiceRequired(draft, event);
        break;
      case 'ChoiceResolved':
        applyChoiceResolved(draft, event);
        break;
      case 'SaveRolled':
        applySaveRolled(draft, event);
        break;
      case 'AbilityCheckRolled':
        applyAbilityCheckRolled(draft, event);
        break;
      case 'SpellCastDeclared':
        applySpellCastDeclared(draft, event);
        break;
      case 'SpellSlotConsumed':
        applySpellSlotConsumed(draft, event);
        break;
      case 'PactSlotConsumed':
        applyPactSlotConsumed(draft, event);
        break;
      case 'ConcentrationStarted':
        applyConcentrationStarted(draft, event);
        break;
      case 'ConcentrationBroken':
        applyConcentrationBroken(draft, event);
        break;
      case 'TriggerFired':
        applyTriggerFired(draft, event);
        break;
      case 'ActionEconomyConsumed':
        applyActionEconomyConsumed(draft, event);
        break;
      case 'CombatantMoved':
        applyCombatantMoved(draft, event);
        break;
      case 'Dashed':
        applyDashed(draft, event);
        break;
      case 'Disengaged':
        applyDisengaged(draft, event);
        break;
      case 'ItemEquipped':
        applyItemEquipped(draft, event);
        break;
      case 'ItemUnequipped':
        applyItemUnequipped(draft, event);
        break;
      case 'ItemAttuned':
        applyItemAttuned(draft, event);
        break;
      case 'ItemUnattuned':
        applyItemUnattuned(draft, event);
        break;
      case 'PartyCreated':
        applyPartyCreated(draft, event);
        break;
      case 'PartyMembersChanged':
        applyPartyMembersChanged(draft, event);
        break;
      case 'CurrencyAcquired':
        applyCurrencyAcquired(draft, event);
        break;
      case 'CurrencySpent':
        applyCurrencySpent(draft, event);
        break;
      case 'ItemDepositedToParty':
        applyItemDepositedToParty(draft, event);
        break;
      case 'ItemWithdrawnFromParty':
        applyItemWithdrawnFromParty(draft, event);
        break;
      case 'SessionStarted':
        applySessionStarted(draft, event);
        break;
      case 'SessionEnded':
        applySessionEnded(draft, event);
        break;
      case 'JournalEntryAdded':
        applyJournalEntryAdded(draft, event);
        break;
      case 'InGameTimeAdvanced':
        applyInGameTimeAdvanced(draft, event);
        break;
      case 'LocationCreated':
        applyLocationCreated(draft, event);
        break;
      case 'DoorAdded':
        applyDoorAdded(draft, event);
        break;
      case 'DoorStateChanged':
        applyDoorStateChanged(draft, event);
        break;
      case 'CharacterLocationChanged':
        applyCharacterLocationChanged(draft, event);
        break;
      case 'QuestStarted':
        applyQuestStarted(draft, event);
        break;
      case 'ObjectiveProgressed':
        applyObjectiveProgressed(draft, event);
        break;
      case 'ObjectiveCompleted':
        applyObjectiveCompleted(draft, event);
        break;
      case 'ObjectiveFailed':
        applyObjectiveFailed(draft, event);
        break;
      case 'QuestCompleted':
        applyQuestCompleted(draft, event);
        break;
      case 'QuestFailed':
        applyQuestFailed(draft, event);
        break;
      case 'QuestAbandoned':
        applyQuestAbandoned(draft, event);
        break;
      case 'QuestRewardClaimed':
        applyQuestRewardClaimed(draft, event);
        break;
      case 'XPAwarded':
        applyXPAwarded(draft, event);
        break;
      case 'MilestoneAwarded':
        applyMilestoneAwarded(draft, event);
        break;
      case 'SpellCountered':
        applySpellCountered(draft, event);
        break;
      case 'SpellDispelled':
        applySpellDispelled(draft, event);
        break;
      case 'ItemIdentified':
        applyItemIdentified(draft, event);
        break;
      case 'WeaponMasteryActivated':
        applyWeaponMasteryActivated(draft, event);
        break;
      case 'Mounted':
        applyMounted(draft, event);
        break;
      case 'Dismounted':
        applyDismounted(draft, event);
        break;
      case 'VehicleAcquired':
        applyVehicleAcquired(draft, event);
        break;
      case 'VehicleBoarded':
        applyVehicleBoarded(draft, event);
        break;
      case 'VehicleDeparted':
        applyVehicleDeparted(draft, event);
        break;
      case 'VehicleDamaged':
        applyVehicleDamaged(draft, event);
        break;
      case 'VehicleRepaired':
        applyVehicleRepaired(draft, event);
        break;
      case 'TravelLegCompleted':
        applyTravelLegCompleted(draft, event);
        break;
      case 'NavigationCheckRolled':
        applyNavigationCheckRolled(draft, event);
        break;
      case 'ForagedFor':
        applyForagedFor(draft, event);
        break;
      case 'AttitudeChanged':
        applyAttitudeChanged(draft, event);
        break;
      case 'MoraleCheckRolled':
        applyMoraleCheckRolled(draft, event);
        break;
      case 'MoraleBroken':
        applyMoraleBroken(draft, event);
        break;
      default: {
        const exhaustive: never = event;
        invariant(false, `Unhandled event: ${JSON.stringify(exhaustive)}`);
      }
    }
    draft.version += 1;
  });

export const applyAll = (state: CampaignState, events: ReadonlyArray<Event>): CampaignState =>
  events.reduce<CampaignState>(apply, state);
