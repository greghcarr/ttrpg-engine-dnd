import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { ChoiceRequiredEvent } from '../../src/schemas/events/level-up.js';
import { resolveContent } from '../../src/content/pack.js';
import { formatTranscript } from '../transcript.js';

describe('golden: level-up + choice resolution', () => {
  it('character levels from 1 to 5, replay-equivalent', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(11) });
    const character = buildFighter({
      name: 'Alyx',
      level: 1,
      hpMax: 12,
      hpCurrent: 12,
      hitDiceRemaining: 1,
      CON: 14,
    });
    let campaign = engine.createCampaign({ name: 'level-up' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: character,
      } satisfies CharacterCreatedEvent,
    ]);

    for (let target = 2; target <= 5; target++) {
      campaign = commit(
        campaign,
        engine.plan.levelUp(campaign.state, {
          characterId: character.id,
          classId: 'fighter',
          hpStrategy: 'roll',
        }).events,
      );
    }

    expect(campaign.state.characters[character.id]?.classes[0]?.level).toBe(5);
    expect(campaign.state.characters[character.id]?.hp.max).toBeGreaterThan(12);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));

    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'A Fighter levels from 1 to 5 with rolled HP',
      }),
    ).toMatchFileSnapshot('./transcripts/s3-level-up.transcript.rtf');
  });

  it('user-supplied OfferChoice on a fighting-style feat resolves and contributes to AC', async () => {
    const customPack = {
      ...TEST_PACK,
      classes: TEST_PACK.classes.map((c) =>
        c.id === 'fighter'
          ? {
              ...c,
              levelTable: {
                ...c.levelTable,
                '2': {
                  proficiencyBonus: 2,
                  features: [
                    {
                      id: 'fighting-style',
                      name: 'Fighting Style',
                      effects: [
                        {
                          kind: 'OfferChoice' as const,
                          choiceId: 'fighting-style',
                          prompt: 'Pick a fighting style',
                          options: [
                            {
                              id: 'defense',
                              label: 'Defense',
                              effects: [
                                { kind: 'AddModifier' as const, target: 'ac' as const, value: 1 },
                              ],
                            },
                            {
                              id: 'dueling',
                              label: 'Dueling',
                              effects: [
                                {
                                  kind: 'AddModifier' as const,
                                  target: 'damage' as const,
                                  value: 2,
                                },
                              ],
                            },
                          ],
                          oneOf: 1,
                          when: 'onAcquire' as const,
                        },
                      ],
                    },
                    {
                      id: 'action-surge',
                      name: 'Action Surge',
                      effects: [
                        {
                          kind: 'GrantResource' as const,
                          resourceId: 'action-surge',
                          max: 1,
                          recharge: 'shortRest' as const,
                        },
                      ],
                    },
                  ],
                  columns: {},
                },
              },
            }
          : c,
      ),
    };

    const engine = createEngine({ contentPacks: [customPack], rng: seededRNG(7) });
    const customContent = resolveContent([customPack]);
    const character = buildFighter({
      name: 'Alyx',
      level: 1,
      hpMax: 12,
      hpCurrent: 12,
      hitDiceRemaining: 1,
      CON: 14,
    });
    let campaign = engine.createCampaign({ name: 'fs' });
    campaign = commit(campaign, [
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'CharacterCreated',
        snapshot: character,
      } satisfies CharacterCreatedEvent,
    ]);
    const levelEvents = engine.plan.levelUp(campaign.state, {
      characterId: character.id,
      classId: 'fighter',
      hpStrategy: 'average',
    }).events;
    const choiceRequired = levelEvents.find((e) => e.type === 'ChoiceRequired') as
      | ChoiceRequiredEvent
      | undefined;
    expect(choiceRequired).toBeDefined();
    if (!choiceRequired) throw new Error('no choice');

    campaign = commit(campaign, levelEvents);
    campaign = commit(
      campaign,
      engine.plan.resolveChoice(campaign.state, {
        choiceId: choiceRequired.choiceId,
        characterId: character.id,
        selectedOptionIds: ['defense'],
      }).events,
    );

    const acWithChoice = engine.derive.ac(campaign.state, character.id);
    expect(acWithChoice.breakdown.some((b) => b.value === 1)).toBe(true);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));

    await expect(
      formatTranscript(campaign.events, customContent, {
        title: 'Fighter L2 fighting-style choice (Defense)',
      }),
    ).toMatchFileSnapshot('./transcripts/s3-level-up-fighting-style.transcript.rtf');
  });
});
