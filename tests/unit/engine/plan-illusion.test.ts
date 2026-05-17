// Slice 137: illusion-interaction primitive — Silent Image and
// Major Image dedicated planners plus the Investigate action.
//
// Covers: cast emits the full chain (action/slot/concentration/
// illusion-created), Investigation check pass adds to disbelievedBy,
// failed Investigation leaves the disbelieved set unchanged, voluntary
// dismiss, concentration drop sweeps the illusion, multi-creature
// belief state tracks per-investigator.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  IllusionCreatedEvent,
  IllusionInvestigatedEvent,
  IllusionDismissedEvent,
} from '../../../src/schemas/events/illusions.js';
import type { ConcentrationStartedEvent } from '../../../src/schemas/events/concentration.js';
import type { SpellSlotConsumedEvent } from '../../../src/schemas/events/spellcasting.js';

const PACK = loadStarterPack();

const buildWizard = (preparedSpells: string[] = ['silent-image', 'major-image']): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Illusionist',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: [],
    preparedSpells,
  });

const buildSharpInvestigator = (): Character =>
  // INT 18, proficient investigator (rogue 5 = prof +3 + INT +4 = +7).
  // Against DC 15 (wizard-5 INT 18), succeeds on a 8+ d20.
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Sharp Eye',
    speciesId: 'human',
    backgroundId: 'investigator',
    classes: [{ classId: 'rogue', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 10, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: [],
  });

const buildDullInvestigator = (): Character =>
  // INT 6, no proficiency. INT mod -2. Against DC 15, needs d20 17+.
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Dim Witted',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 14, DEX: 10, CON: 12, INT: 6, WIS: 8, CHA: 10 },
    hp: { current: 12, max: 12, temp: 0 },
    featsTaken: [],
  });

const seedCampaign = (
  wizard: Character,
  extra: Character[] = [],
): { campaign: Campaign; engine: ReturnType<typeof createEngine> } => {
  const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
  let campaign: Campaign = engine.createCampaign({ name: 'illusion' });
  campaign = commit(campaign, [
    { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
    ...extra.map((c) => ({
      id: eventId(),
      at: isoTimestamp(),
      type: 'CharacterCreated' as const,
      snapshot: c,
    } satisfies CharacterCreatedEvent)),
  ]);
  return { campaign, engine };
};

describe('engine.plan.silentImage', () => {
  it('emits SpellCastDeclared + slot + concentration + IllusionCreated; illusion lives in state with the caster\'s spell DC baked', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const { events } = engine.plan.silentImage(campaign.state, {
      casterId: wizard.id,
      label: 'Phantom Wall',
      location: 'the hallway',
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'SpellCastDeclared',
      'SpellSlotConsumed',
      'ConcentrationStarted',
      'IllusionCreated',
    ]);
    const created = events.find(
      (e): e is IllusionCreatedEvent => e.type === 'IllusionCreated',
    )!;
    expect(created.casterId).toBe(wizard.id);
    expect(created.sourceSpellId).toBe('silent-image');
    expect(created.kind).toBe('visual');
    expect(created.label).toBe('Phantom Wall');
    // Wizard-5 INT 18 spell DC = 8 + 3 prof + 4 INT = 15.
    expect(created.investigationDC).toBe(15);
    const after = commit(campaign, events);
    expect(after.state.illusions[created.illusionId]).toBeDefined();
    expect(after.state.illusions[created.illusionId]!.disbelievedBy).toEqual([]);
  });

  it('illusion is linked to the concentration EffectInstance', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const { events } = engine.plan.silentImage(campaign.state, {
      casterId: wizard.id,
      label: 'Phantom Wall',
      location: 'somewhere',
    });
    const started = events.find(
      (e): e is ConcentrationStartedEvent => e.type === 'ConcentrationStarted',
    )!;
    const created = events.find(
      (e): e is IllusionCreatedEvent => e.type === 'IllusionCreated',
    )!;
    expect(created.sourceEffectInstanceId).toBe(started.effectInstanceId);
  });

  it('rejects when caster does not know silent-image', () => {
    const wizard = buildWizard([]);
    const { campaign, engine } = seedCampaign(wizard);
    expect(() =>
      engine.plan.silentImage(campaign.state, {
        casterId: wizard.id,
        label: 'X',
        location: 'Y',
      }),
    ).toThrow(/silent-image/);
  });
});

describe('engine.plan.majorImage', () => {
  it('creates an audiovisual illusion (kind: audiovisual)', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const { events } = engine.plan.majorImage(campaign.state, {
      casterId: wizard.id,
      label: 'Roaring Dragon',
      location: 'the chamber',
    });
    const created = events.find(
      (e): e is IllusionCreatedEvent => e.type === 'IllusionCreated',
    )!;
    expect(created.kind).toBe('audiovisual');
    expect(created.sourceSpellId).toBe('major-image');
  });

  it('rejects slotLevel < 3', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    expect(() =>
      engine.plan.majorImage(campaign.state, {
        casterId: wizard.id,
        label: 'X',
        location: 'Y',
        slotLevel: 2,
      }),
    ).toThrow(/3rd-level/);
  });

  it('higher-level slot is honored', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const { events } = engine.plan.majorImage(campaign.state, {
      casterId: wizard.id,
      label: 'X',
      location: 'Y',
      slotLevel: 5,
    });
    const slot = events.find(
      (e): e is SpellSlotConsumedEvent => e.type === 'SpellSlotConsumed',
    );
    expect(slot!.slotLevel).toBe(5);
  });
});

describe('engine.plan.investigateIllusion', () => {
  it('successful check: investigator joins disbelievedBy', () => {
    // Seed-walk to find a seed where the sharp investigator rolls
    // high enough to beat DC 15 (mod +7, needs d20 8+; most seeds
    // succeed).
    for (let seed = 1; seed < 30; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const wizard = buildWizard();
      const investigator = buildSharpInvestigator();
      let campaign: Campaign = engine.createCampaign({ name: `investigate-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: investigator } satisfies CharacterCreatedEvent,
      ]);
      const place = engine.plan.silentImage(campaign.state, {
        casterId: wizard.id,
        label: 'X',
        location: 'Y',
      });
      const created = place.events.find(
        (e): e is IllusionCreatedEvent => e.type === 'IllusionCreated',
      )!;
      campaign = commit(campaign, place.events);
      const investigate = engine.plan.investigateIllusion(campaign.state, {
        investigatorId: investigator.id,
        illusionId: created.illusionId,
      });
      const event = investigate.events.find(
        (e): e is IllusionInvestigatedEvent => e.type === 'IllusionInvestigated',
      )!;
      if (!event.success) continue;
      expect(event.dc).toBe(15);
      expect(event.investigatorId).toBe(investigator.id);
      campaign = commit(campaign, investigate.events);
      expect(campaign.state.illusions[created.illusionId]!.disbelievedBy).toContain(
        investigator.id,
      );
      return;
    }
    throw new Error('no seed produced a successful Investigation check');
  });

  it('failed check: disbelievedBy stays empty', () => {
    // The dull investigator (INT -2) almost always fails against DC 15.
    for (let seed = 1; seed < 30; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const wizard = buildWizard();
      const investigator = buildDullInvestigator();
      let campaign: Campaign = engine.createCampaign({ name: `dull-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: investigator } satisfies CharacterCreatedEvent,
      ]);
      const place = engine.plan.silentImage(campaign.state, {
        casterId: wizard.id,
        label: 'X',
        location: 'Y',
      });
      const created = place.events.find(
        (e): e is IllusionCreatedEvent => e.type === 'IllusionCreated',
      )!;
      campaign = commit(campaign, place.events);
      const investigate = engine.plan.investigateIllusion(campaign.state, {
        investigatorId: investigator.id,
        illusionId: created.illusionId,
      });
      const event = investigate.events.find(
        (e): e is IllusionInvestigatedEvent => e.type === 'IllusionInvestigated',
      )!;
      if (event.success) continue;
      campaign = commit(campaign, investigate.events);
      expect(campaign.state.illusions[created.illusionId]!.disbelievedBy).toEqual([]);
      return;
    }
    throw new Error('no seed produced a failed Investigation check');
  });

  it('rejects investigation of an unknown illusion', () => {
    const wizard = buildWizard();
    const investigator = buildSharpInvestigator();
    const { campaign, engine } = seedCampaign(wizard, [investigator]);
    expect(() =>
      engine.plan.investigateIllusion(campaign.state, {
        investigatorId: investigator.id,
        illusionId: 'nonexistent-illusion-id',
      }),
    ).toThrow(/Illusion/);
  });
});

describe('engine.plan.dismissIllusion', () => {
  it('emits IllusionDismissed; illusion is gone from state', () => {
    const wizard = buildWizard();
    const { campaign, engine } = seedCampaign(wizard);
    const place = engine.plan.silentImage(campaign.state, {
      casterId: wizard.id,
      label: 'X',
      location: 'Y',
    });
    const created = place.events.find(
      (e): e is IllusionCreatedEvent => e.type === 'IllusionCreated',
    )!;
    let after = commit(campaign, place.events);
    const dismiss = engine.plan.dismissIllusion(after.state, {
      illusionId: created.illusionId,
    });
    const dismissed = dismiss.events.find(
      (e): e is IllusionDismissedEvent => e.type === 'IllusionDismissed',
    );
    expect(dismissed!.reason).toBe('casterAction');
    after = commit(after, dismiss.events);
    expect(after.state.illusions[created.illusionId]).toBeUndefined();
  });
});

describe('concentration-drop cleanup sweeps illusions', () => {
  it('casting a new concentration spell drops the prior illusion via clearConcentrationEffect', () => {
    const wizard = buildWizard(['silent-image', 'hold-person']);
    const { campaign, engine } = seedCampaign(wizard);
    const first = engine.plan.silentImage(campaign.state, {
      casterId: wizard.id,
      label: 'Phantom 1',
      location: 'hall',
    });
    const created = first.events.find(
      (e): e is IllusionCreatedEvent => e.type === 'IllusionCreated',
    )!;
    let after = commit(campaign, first.events);
    expect(after.state.illusions[created.illusionId]).toBeDefined();

    const second = engine.plan.silentImage(after.state, {
      casterId: wizard.id,
      label: 'Phantom 2',
      location: 'door',
    });
    after = commit(after, second.events);
    expect(after.state.illusions[created.illusionId]).toBeUndefined();
  });
});

describe('multi-creature belief state', () => {
  it('two investigators on the same illusion track independently', () => {
    // The sharp investigator likely succeeds, the dull one likely fails.
    // Seed-walk to find a seed where exactly one succeeds.
    for (let seed = 1; seed < 50; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const wizard = buildWizard();
      const sharp = buildSharpInvestigator();
      const dull = buildDullInvestigator();
      let campaign: Campaign = engine.createCampaign({ name: `multi-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: wizard } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: sharp } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: dull } satisfies CharacterCreatedEvent,
      ]);
      const place = engine.plan.silentImage(campaign.state, {
        casterId: wizard.id,
        label: 'X',
        location: 'Y',
      });
      const created = place.events.find(
        (e): e is IllusionCreatedEvent => e.type === 'IllusionCreated',
      )!;
      campaign = commit(campaign, place.events);
      const sharpCheck = engine.plan.investigateIllusion(campaign.state, {
        investigatorId: sharp.id,
        illusionId: created.illusionId,
      });
      campaign = commit(campaign, sharpCheck.events);
      const dullCheck = engine.plan.investigateIllusion(campaign.state, {
        investigatorId: dull.id,
        illusionId: created.illusionId,
      });
      campaign = commit(campaign, dullCheck.events);
      const sharpEvent = sharpCheck.events.find(
        (e): e is IllusionInvestigatedEvent => e.type === 'IllusionInvestigated',
      )!;
      const dullEvent = dullCheck.events.find(
        (e): e is IllusionInvestigatedEvent => e.type === 'IllusionInvestigated',
      )!;
      if (sharpEvent.success && !dullEvent.success) {
        const disbelievedBy = campaign.state.illusions[created.illusionId]!.disbelievedBy;
        expect(disbelievedBy).toContain(sharp.id);
        expect(disbelievedBy).not.toContain(dull.id);
        return;
      }
    }
    throw new Error('no seed produced the sharp-pass / dull-fail combination');
  });
});
