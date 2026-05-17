import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { ResolvedContent } from '../../content/pack.js';
import type { Event } from '../../schemas/events/index.js';
import type { RNG } from '../../rng/index.js';
import type {
  RemoteSensorPlacedEvent,
  RemoteSensorModeChangedEvent,
  RemoteSensorRemovedEvent,
  SensorRemovalReason,
} from '../../schemas/events/sensors.js';
import type { SensorMode } from '../../schemas/runtime/sensor.js';
import type {
  ConcentrationBrokenEvent,
  ConcentrationStartedEvent,
} from '../../schemas/events/concentration.js';
import type {
  SpellCastDeclaredEvent,
  SpellSlotConsumedEvent,
} from '../../schemas/events/spellcasting.js';
import type { ActionEconomyConsumedEvent } from '../../schemas/events/action-economy.js';
import { newEventId, newSensorId, newEffectInstanceId } from '../../ids.js';
import { nowIso } from '../../internal/clock.js';
import { invariant } from '../../internal/invariants.js';
import type { ULID } from '../ids-utils.js';

// Slice 135: dedicated planners for placing, switching, and removing
// remote sensors. RAW 2024 Clairvoyance is the canonical user; Scrying
// will piggyback once its "target makes a WIS save against being
// scryed" arm is wired (separate slice).

const CLAIRVOYANCE_MIN_SLOT_LEVEL = 3;
const CLAIRVOYANCE_DURATION_MINUTES = 10;

const economyConsumedIfEncountered = (
  state: CampaignState,
  characterId: string,
  at: string,
  kind: 'action' | 'bonusAction' | 'reaction',
): ActionEconomyConsumedEvent | undefined => {
  if (state.activeEncounterId === undefined) return undefined;
  const encounter = state.encounters[state.activeEncounterId];
  if (encounter === undefined) return undefined;
  if (!encounter.combatants.some((c) => c.combatantId === characterId)) return undefined;
  return {
    id: newEventId() as ULID,
    at,
    type: 'ActionEconomyConsumed',
    encounterId: state.activeEncounterId,
    combatantId: characterId,
    kind,
  };
};

export interface ClairvoyanceIntent {
  readonly type: 'Clairvoyance';
  readonly casterId: string;
  // Free-text description of the location where the sensor is placed.
  // The engine doesn't reason about it; consumers / DMs display it
  // and describe what's seen / heard.
  readonly location: string;
  // Optional human-readable label for the sensor (defaults to
  // "Clairvoyant Sensor"). Consumer-facing.
  readonly label?: string;
  // Initial sense mode. RAW: caster chooses seeing or hearing at cast
  // time, can switch with an action thereafter via planSwitchSensorMode.
  readonly mode: SensorMode;
  readonly slotLevel?: number;
  readonly at?: string;
}

/**
 * RAW 2024 Clairvoyance: 3rd-level divination, 10-minute cast,
 * Concentration up to 10 minutes, range 1 mile. The caster places an
 * invisible sensor in a location known or in an obvious location
 * within range. The caster perceives through the sensor in one of two
 * modes (seeing or hearing) chosen at cast time; the planSwitchSensor
 * Mode planner toggles modes thereafter.
 *
 * The 10-minute cast time means in-encounter use is unusual; the
 * planner still consumes an action when cast inside an encounter (a
 * caster who chooses to cast a 10-minute spell mid-fight commits to
 * the action that turn; out-of-encounter casts just emit the cast
 * declared / slot / concentration / sensor events).
 *
 * Event sequence (in order):
 *   - ActionEconomyConsumed (in encounter only)
 *   - SpellCastDeclared
 *   - SpellSlotConsumed
 *   - ConcentrationBroken (if a prior concentration was active)
 *   - ConcentrationStarted
 *   - RemoteSensorPlaced (linked to the concentration effect)
 */
export const planClairvoyance = (
  state: CampaignState,
  _content: ResolvedContent,
  _rng: RNG,
  intent: ClairvoyanceIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.casterId];
  invariant(caster !== undefined, `Caster ${intent.casterId} not found`);
  const slotLevel = intent.slotLevel ?? CLAIRVOYANCE_MIN_SLOT_LEVEL;
  invariant(
    slotLevel >= CLAIRVOYANCE_MIN_SLOT_LEVEL,
    'Clairvoyance requires a 3rd-level or higher slot',
  );
  const knowsSpell =
    caster.knownSpells.includes('clairvoyance') || caster.preparedSpells.includes('clairvoyance');
  invariant(knowsSpell, `Caster ${intent.casterId} does not know Clairvoyance`);

  const at = intent.at ?? nowIso();
  const events: Event[] = [];

  const action = economyConsumedIfEncountered(state, intent.casterId, at, 'action');
  if (action !== undefined) events.push(action);

  const declared: SpellCastDeclaredEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SpellCastDeclared',
    characterId: intent.casterId,
    spellId: 'clairvoyance',
    slotLevel,
    slotSource: 'standard',
    targetIds: [intent.casterId],
    castAsRitual: false,
  };
  events.push(declared);

  const slotConsumed: SpellSlotConsumedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'SpellSlotConsumed',
    characterId: intent.casterId,
    slotLevel,
  };
  events.push(slotConsumed);

  // If the caster is already concentrating, the old effect breaks
  // when the new one starts. Mirrors cast-spell's concentration path.
  if (caster.concentrationEffectId !== undefined) {
    const priorBroken: ConcentrationBrokenEvent = {
      id: newEventId() as ULID,
      at,
      type: 'ConcentrationBroken',
      effectInstanceId: caster.concentrationEffectId,
      casterId: intent.casterId as ULID,
      reason: 'newConcentrationSpell',
      causedByEventId: declared.id,
    };
    events.push(priorBroken);
  }

  const effectInstanceId = newEffectInstanceId();
  const started: ConcentrationStartedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'ConcentrationStarted',
    effectInstanceId: effectInstanceId as ULID,
    casterId: intent.casterId as ULID,
    spellId: 'clairvoyance',
    targetIds: [intent.casterId as ULID],
    conditionsApplied: [],
    durationMinutes: CLAIRVOYANCE_DURATION_MINUTES,
    slotLevel,
    causedByEventId: declared.id,
  };
  events.push(started);

  const sensorId = newSensorId();
  const placed: RemoteSensorPlacedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'RemoteSensorPlaced',
    sensorId: sensorId as ULID,
    label: intent.label ?? 'Clairvoyant Sensor',
    location: intent.location,
    casterId: intent.casterId as ULID,
    sourceSpellId: 'clairvoyance',
    sourceEffectInstanceId: effectInstanceId as ULID,
    mode: intent.mode,
    causedByEventId: declared.id,
  };
  events.push(placed);

  return events;
};

export interface SwitchSensorModeIntent {
  readonly type: 'SwitchSensorMode';
  readonly casterId: string;
  readonly sensorId: string;
  readonly mode: SensorMode;
  readonly at?: string;
}

/**
 * RAW 2024 Clairvoyance: "As your action, you can switch between
 * seeing and hearing." Consumes the caster's action (in encounter)
 * and emits a RemoteSensorModeChanged event.
 */
export const planSwitchSensorMode = (
  state: CampaignState,
  _content: ResolvedContent,
  _rng: RNG,
  intent: SwitchSensorModeIntent,
): ReadonlyArray<Event> => {
  const caster = state.characters[intent.casterId];
  invariant(caster !== undefined, `Caster ${intent.casterId} not found`);
  const sensor = state.sensors[intent.sensorId];
  invariant(sensor !== undefined, `Sensor ${intent.sensorId} not found`);
  invariant(
    sensor.casterId === intent.casterId,
    `Sensor ${intent.sensorId} is not owned by caster ${intent.casterId}`,
  );
  if (sensor.mode === intent.mode) {
    throw new Error(
      `Sensor ${intent.sensorId} is already in ${intent.mode} mode`,
    );
  }
  const at = intent.at ?? nowIso();
  const events: Event[] = [];
  const action = economyConsumedIfEncountered(state, intent.casterId, at, 'action');
  if (action !== undefined) events.push(action);
  const changed: RemoteSensorModeChangedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'RemoteSensorModeChanged',
    sensorId: intent.sensorId as ULID,
    mode: intent.mode,
  };
  events.push(changed);
  return events;
};

export interface RemoveSensorIntent {
  readonly type: 'RemoveSensor';
  readonly sensorId: string;
  // Optional reason; defaults to 'casterAction' (the caster
  // voluntarily ends the spell). Concentration-drop cleanup is
  // handled inside clearConcentrationEffect, not this planner.
  readonly reason?: SensorRemovalReason;
  readonly at?: string;
}

/**
 * Caster-initiated sensor removal (voluntary spell end). The
 * concentration-drop path emits its own RemoteSensorRemoved during
 * clearConcentrationEffect; this planner is for the "I'm done
 * scrying, end the spell" surface without needing to break
 * concentration on something else.
 */
export const planRemoveSensor = (
  state: CampaignState,
  _content: ResolvedContent,
  _rng: RNG,
  intent: RemoveSensorIntent,
): ReadonlyArray<Event> => {
  const sensor = state.sensors[intent.sensorId];
  invariant(sensor !== undefined, `Sensor ${intent.sensorId} not found`);
  const at = intent.at ?? nowIso();
  const removed: RemoteSensorRemovedEvent = {
    id: newEventId() as ULID,
    at,
    type: 'RemoteSensorRemoved',
    sensorId: intent.sensorId as ULID,
    reason: intent.reason ?? 'casterAction',
  };
  return [removed];
};
