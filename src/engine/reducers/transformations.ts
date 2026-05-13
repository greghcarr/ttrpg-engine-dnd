import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type {
  PolymorphAppliedEvent,
  PolymorphRevertedEvent,
  SimulacrumCreatedEvent,
  WishGrantedEvent,
} from '../../schemas/events/transformations.js';
import { invariant } from '../../internal/invariants.js';

export const applyPolymorphApplied = (
  state: Draft<CampaignState>,
  event: PolymorphAppliedEvent,
): void => {
  const character = state.characters[event.targetId];
  invariant(character !== undefined, `Target ${event.targetId} not found`);
  invariant(
    character.polymorphedSnapshot === undefined,
    `${event.targetId} is already polymorphed`,
  );
  character.polymorphedSnapshot = {
    hp: {
      current: character.hp.current,
      max: character.hp.max,
      temp: character.hp.temp,
      maxBonus: character.hp.maxBonus ?? 0,
    },
    abilityScores: { ...character.abilityScores },
    speedFeet: character.speedFeet,
    speciesId: character.speciesId,
    kind: event.kind,
    formName: event.form.name,
    ...(character.armorClass !== undefined ? { armorClass: character.armorClass } : {}),
  };
  character.hp.current = event.form.hp;
  character.hp.max = event.form.hp;
  character.hp.temp = 0;
  // The form's HP replaces the buffed max, so the running bonus
  // doesn't apply to the new form. Stash on the snapshot for revert.
  character.hp.maxBonus = 0;
  character.abilityScores = { ...event.form.abilityScores };
  character.speedFeet = event.form.speedFeet;
  if (event.form.speciesId !== undefined) character.speciesId = event.form.speciesId;
  character.armorClass = event.form.ac;
};

export const applyPolymorphReverted = (
  state: Draft<CampaignState>,
  event: PolymorphRevertedEvent,
): void => {
  const character = state.characters[event.targetId];
  invariant(character !== undefined, `Target ${event.targetId} not found`);
  const snap = character.polymorphedSnapshot;
  invariant(snap !== undefined, `${event.targetId} is not polymorphed`);
  character.hp = {
    current: snap.hp.current,
    max: snap.hp.max,
    temp: snap.hp.temp,
    maxBonus: snap.hp.maxBonus ?? 0,
  };
  character.abilityScores = { ...snap.abilityScores };
  character.speedFeet = snap.speedFeet;
  character.speciesId = snap.speciesId;
  character.armorClass = snap.armorClass;
  character.polymorphedSnapshot = undefined;
};

export const applySimulacrumCreated = (
  state: Draft<CampaignState>,
  event: SimulacrumCreatedEvent,
): void => {
  const original = state.characters[event.originalId];
  invariant(original !== undefined, `Original ${event.originalId} not found`);
  invariant(state.characters[event.simulacrumId] === undefined, `Simulacrum ${event.simulacrumId} already exists`);
  state.characters[event.simulacrumId] = {
    ...original,
    id: event.simulacrumId,
    name: `Simulacrum of ${original.name}`,
    kind: 'creature',
    hp: { current: event.hpMax, max: event.hpMax, temp: 0, maxBonus: 0 },
    appliedConditions: [],
    triggerCounters: {},
    spellSlotsUsed: {},
    pactSlotsUsed: 0,
    concentrationEffectId: undefined,
    inventory: [],
    equipped: { attuned: [] },
    pendingChoiceIds: [],
    polymorphedSnapshot: undefined,
    mountedOnId: undefined,
    moraleBroken: false,
    xp: 0,
  };
};

export const applyWishGranted = (
  state: Draft<CampaignState>,
  event: WishGrantedEvent,
): void => {
  invariant(state.characters[event.granterId] !== undefined, `Granter ${event.granterId} not found`);
  if (event.stressApplied) {
    const granter = state.characters[event.granterId]!;
    granter.exhaustion = Math.min(6, granter.exhaustion + 1);
  }
};
