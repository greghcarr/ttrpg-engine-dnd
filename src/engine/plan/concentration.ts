import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { ConcentrationBrokenEvent } from '../../schemas/events/concentration.js';
import type { SaveRolledEvent } from '../../schemas/events/checks.js';
import type { RNG } from '../../rng/index.js';
import { rollDie } from '../../rng/dice.js';
import { newEventId } from '../../ids.js';
import { computeSavingThrow } from '../../derive/save.js';
import { D20_SIDES } from '../../internal/constants.js';
import { nowIso } from '../../internal/clock.js';
import type { ULID } from '../ids-utils.js';

const CONCENTRATION_MIN_DC = 10;
const CONCENTRATION_DC_DIVISOR = 2;

export interface CheckConcentrationIntent {
  readonly type: 'CheckConcentration';
  readonly characterId: string;
  readonly damageTaken: number;
  readonly at?: string;
}

const concentrationDC = (damageTaken: number): number =>
  Math.max(CONCENTRATION_MIN_DC, Math.floor(damageTaken / CONCENTRATION_DC_DIVISOR));

export const planCheckConcentration = (
  state: CampaignState,
  content: ResolvedContent,
  rng: RNG,
  intent: CheckConcentrationIntent,
): ReadonlyArray<Event> => {
  const character = state.characters[intent.characterId];
  if (!character) throw new Error(`Unknown character ${intent.characterId}`);
  if (character.concentrationEffectId === undefined) {
    return [];
  }
  if (intent.damageTaken <= 0) {
    return [];
  }

  const at = intent.at ?? nowIso();
  const dc = concentrationDC(intent.damageTaken);
  const saveDerivation = computeSavingThrow({
    character,
    itemInstances: state.itemInstances,
    content,
    ability: 'CON',
  });
  const d20 = rollDie(D20_SIDES, rng);
  const total = d20 + saveDerivation.total;
  const success = total >= dc;

  const save: SaveRolledEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SaveRolled',
    targetId: intent.characterId as ULID,
    ability: 'CON',
    dc,
    d20: [d20],
    used: 'none',
    bonus: saveDerivation.total,
    total,
    success,
  };
  const events: Event[] = [save];

  if (!success) {
    const broken: ConcentrationBrokenEvent = {
      id: newEventId() as ULID,
      at,
      type: 'ConcentrationBroken',
      effectInstanceId: character.concentrationEffectId,
      casterId: intent.characterId as ULID,
      reason: 'failedSave',
      causedByEventId: save.id,
    };
    events.push(broken);
  }
  return events;
};
