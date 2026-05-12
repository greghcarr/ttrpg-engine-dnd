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
import { applyItemAcquired } from './reducers/inventory.js';
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
      default: {
        const exhaustive: never = event;
        invariant(false, `Unhandled event: ${JSON.stringify(exhaustive)}`);
      }
    }
    draft.version += 1;
  });

export const applyAll = (state: CampaignState, events: ReadonlyArray<Event>): CampaignState =>
  events.reduce<CampaignState>(apply, state);
