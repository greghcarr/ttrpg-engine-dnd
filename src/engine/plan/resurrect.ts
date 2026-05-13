import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type {
  CharacterResurrectedEvent,
  ResurrectionSpell,
} from '../../schemas/events/resurrection.js';
import type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../schemas/events/spellcasting.js';
import { newEventId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import { computeAvailableSpellSlots } from '../../derive/spell-slots.js';
import type { ULID } from '../ids-utils.js';

const RESURRECTION_MIN_SLOT_LEVEL: Record<ResurrectionSpell, number> = {
  revivify: 3,
  'raise-dead': 5,
  reincarnate: 5,
  resurrection: 7,
  'true-resurrection': 9,
};

export type ResurrectVia = 'spell-slot' | 'scroll' | 'special';

export interface ResurrectIntent {
  readonly type: 'Resurrect';
  readonly casterId: string;
  readonly targetId: string;
  readonly spell: ResurrectionSpell;
  readonly via?: ResurrectVia;
  readonly slotLevel?: number;
  readonly hpAfter?: number;
  readonly newSpeciesId?: string;
  readonly at?: string;
}

export const planResurrect = (
  state: CampaignState,
  content: ResolvedContent,
  intent: ResurrectIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.casterId];
  if (!caster) throw new Error(`Unknown caster ${intent.casterId}`);
  const target = state.characters[intent.targetId];
  if (!target) throw new Error(`Unknown target ${intent.targetId}`);
  if (target.hp.current > 0) {
    throw new Error(`Target ${intent.targetId} is not at 0 HP`);
  }

  const via: ResurrectVia = intent.via ?? 'spell-slot';
  const minSlot = RESURRECTION_MIN_SLOT_LEVEL[intent.spell];
  const at = intent.at ?? nowIso();
  const events: Event[] = [];
  let declaredId: ULID | undefined;

  if (via === 'spell-slot') {
    const slotLevel = intent.slotLevel ?? minSlot;
    if (slotLevel < minSlot) {
      throw new Error(
        `${intent.spell} requires a level ${minSlot} slot, got ${slotLevel}`,
      );
    }
    const knowsSpell =
      caster.knownSpells.includes(intent.spell) ||
      caster.preparedSpells.includes(intent.spell);
    if (!knowsSpell) {
      throw new Error(
        `Caster ${intent.casterId} does not know or prepare ${intent.spell}`,
      );
    }
    const available = computeAvailableSpellSlots(caster, content.classes);
    const slotsLeft = available.standardByLevel[slotLevel - 1] ?? 0;
    if (slotsLeft <= 0) {
      throw new Error(`No spell slots of level ${slotLevel} available`);
    }
    const declared: SpellCastDeclaredEvent = {
      id: newEventId() as ULID,
      at,
      type: 'SpellCastDeclared',
      characterId: intent.casterId,
      spellId: intent.spell,
      slotLevel,
      slotSource: 'standard',
      targetIds: [intent.targetId],
      castAsRitual: false,
    };
    events.push(declared);
    declaredId = declared.id;
    const consumed: SpellSlotConsumedEvent = {
      id: newEventId() as ULID,
      at,
      type: 'SpellSlotConsumed',
      characterId: intent.casterId,
      slotLevel,
      causedByEventId: declared.id,
    };
    events.push(consumed);
  }

  const resurrected: CharacterResurrectedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'CharacterResurrected',
    characterId: intent.targetId,
    spell: intent.spell,
    byCharacterId: intent.casterId as ULID,
    hpAfter: intent.hpAfter ?? 1,
    via,
    ...(intent.newSpeciesId !== undefined ? { newSpeciesId: intent.newSpeciesId } : {}),
    ...(declaredId !== undefined ? { causedByEventId: declaredId } : {}),
  };
  events.push(resurrected);
  return events;
};
