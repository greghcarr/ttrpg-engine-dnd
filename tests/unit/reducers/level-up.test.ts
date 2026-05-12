import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { buildFighter, eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type {
  ChoiceRequiredEvent,
  ChoiceResolvedEvent,
  LevelUpResolvedEvent,
} from '../../../src/schemas/events/level-up.js';
import { newChoiceId } from '../../../src/ids.js';

const seed = () => {
  const character = buildFighter({ level: 1, hpMax: 12, hpCurrent: 12, hitDiceRemaining: 1 });
  const state = apply(emptyCampaignState(), {
    id: eventId(),
    at: isoTimestamp(),
    type: 'CharacterCreated',
    snapshot: character,
  } satisfies CharacterCreatedEvent);
  return { state, characterId: character.id };
};

describe('LevelUpResolved reducer', () => {
  it('bumps class level, max HP, current HP, and hit dice', () => {
    const { state, characterId } = seed();
    const event: LevelUpResolvedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'LevelUpResolved',
      characterId,
      classId: 'fighter',
      newClassLevel: 2,
      hpStrategy: 'average',
      hpGained: 8,
    };
    const next = apply(state, event);
    expect(next.characters[characterId]?.classes[0]?.level).toBe(2);
    expect(next.characters[characterId]?.classes[0]?.hitDiceRemaining).toBe(2);
    expect(next.characters[characterId]?.hp.max).toBe(20);
    expect(next.characters[characterId]?.hp.current).toBe(20);
  });

  it('rejects non-sequential level-up', () => {
    const { state, characterId } = seed();
    const event: LevelUpResolvedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'LevelUpResolved',
      characterId,
      classId: 'fighter',
      newClassLevel: 3,
      hpStrategy: 'average',
      hpGained: 8,
    };
    expect(() => apply(state, event)).toThrow(/advance by 1/);
  });

  it('rejects unknown class on character', () => {
    const { state, characterId } = seed();
    const event: LevelUpResolvedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'LevelUpResolved',
      characterId,
      classId: 'wizard',
      newClassLevel: 2,
      hpStrategy: 'average',
      hpGained: 4,
    };
    expect(() => apply(state, event)).toThrow(/no enrollment/);
  });
});

describe('ChoiceRequired + ChoiceResolved reducers', () => {
  it('ChoiceRequired adds a pending choice and links it to the character', () => {
    const { state, characterId } = seed();
    const choiceId = newChoiceId();
    const event: ChoiceRequiredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'fighting-style',
      prompt: 'Pick a fighting style',
      options: [
        { id: 'defense', label: 'Defense', effects: [] },
        { id: 'dueling', label: 'Dueling', effects: [] },
      ],
      oneOf: 1,
    };
    const next = apply(state, event);
    expect(next.pendingChoices[choiceId]).toBeDefined();
    expect(next.characters[characterId]?.pendingChoiceIds).toContain(choiceId);
  });

  it('ChoiceResolved marks the choice as resolved', () => {
    const { state, characterId } = seed();
    const choiceId = newChoiceId();
    const required: ChoiceRequiredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'fighting-style',
      prompt: 'Pick a fighting style',
      options: [
        { id: 'defense', label: 'Defense', effects: [] },
        { id: 'dueling', label: 'Dueling', effects: [] },
      ],
      oneOf: 1,
    };
    const resolved: ChoiceResolvedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: ['defense'],
    };
    const next = applyAll(state, [required, resolved]);
    expect(next.pendingChoices[choiceId]?.resolution?.selectedOptionIds).toEqual(['defense']);
  });

  it('rejects resolving an already-resolved choice', () => {
    const { state, characterId } = seed();
    const choiceId = newChoiceId();
    const required: ChoiceRequiredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'fighting-style',
      prompt: 'Pick',
      options: [{ id: 'a', label: 'A', effects: [] }],
      oneOf: 1,
    };
    const resolved: ChoiceResolvedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: ['a'],
    };
    const mid = applyAll(state, [required, resolved]);
    expect(() => apply(mid, resolved)).toThrow(/already resolved/);
  });

  it('rejects wrong number of selections', () => {
    const { state, characterId } = seed();
    const choiceId = newChoiceId();
    const required: ChoiceRequiredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'fighting-style',
      prompt: 'Pick',
      options: [
        { id: 'a', label: 'A', effects: [] },
        { id: 'b', label: 'B', effects: [] },
      ],
      oneOf: 1,
    };
    const mid = apply(state, required);
    const resolved: ChoiceResolvedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: ['a', 'b'],
    };
    expect(() => apply(mid, resolved)).toThrow(/exactly 1/);
  });

  it('rejects unknown option id', () => {
    const { state, characterId } = seed();
    const choiceId = newChoiceId();
    const required: ChoiceRequiredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'fighting-style',
      prompt: 'Pick',
      options: [{ id: 'a', label: 'A', effects: [] }],
      oneOf: 1,
    };
    const mid = apply(state, required);
    const resolved: ChoiceResolvedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: ['nonexistent'],
    };
    expect(() => apply(mid, resolved)).toThrow(/not in choice/);
  });

  it('resolved choice effects flow into derivations (AC +1 from Defense)', async () => {
    const { state, characterId } = seed();
    const choiceId = newChoiceId();
    const required: ChoiceRequiredEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceRequired',
      choiceId,
      characterId,
      promptKey: 'fighting-style',
      prompt: 'Pick',
      options: [
        {
          id: 'defense',
          label: 'Defense',
          effects: [{ kind: 'AddModifier', target: 'ac', value: 1 }],
        },
        { id: 'dueling', label: 'Dueling', effects: [] },
      ],
      oneOf: 1,
    };
    const resolved: ChoiceResolvedEvent = {
      id: eventId(),
      at: isoTimestamp(),
      type: 'ChoiceResolved',
      choiceId,
      characterId,
      selectedOptionIds: ['defense'],
    };
    const finalState = applyAll(state, [required, resolved]);
    const { computeAC } = await import('../../../src/derive/ac.js');
    const { TEST_CONTENT } = await import('../../fixtures/index.js');
    const character = finalState.characters[characterId];
    if (!character) throw new Error('no character');
    const acWithChoice = computeAC({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
      pendingChoices: finalState.pendingChoices,
    });
    const acWithoutChoice = computeAC({
      character,
      itemInstances: {},
      content: TEST_CONTENT,
    });
    expect(acWithChoice.total).toBe(acWithoutChoice.total + 1);
  });
});
