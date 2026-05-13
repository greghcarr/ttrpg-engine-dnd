import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import { TEST_PACK, TEST_CONTENT, buildFighter, eventId, isoTimestamp } from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import { newJournalEntryId, newPartyId } from '../../src/ids.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import type { PartyCreatedEvent } from '../../src/schemas/events/party.js';
import type {
  QuestStartedEvent,
  ObjectiveProgressedEvent,
  ObjectiveCompletedEvent,
  QuestCompletedEvent,
  QuestRewardClaimedEvent,
  XPAwardedEvent,
  MilestoneAwardedEvent,
} from '../../src/schemas/events/quests.js';

describe('golden: quests, objectives, milestone XP (Slice 20)', () => {
  it('full quest lifecycle: start, progress, complete, claim reward, milestone', async () => {
    const engine = createEngine({ contentPacks: [TEST_PACK], rng: seededRNG(20) });
    const alyx = buildFighter({ name: 'Alyx' });
    const borin = buildFighter({ name: 'Borin' });
    const mira = buildFighter({ name: 'Mira' });
    const partyId = newPartyId();
    const goblinQuestId = newJournalEntryId();
    const obj1 = newJournalEntryId();
    const obj2 = newJournalEntryId();
    const obj3 = newJournalEntryId();
    const sideQuestId = newJournalEntryId();
    const sideObj = newJournalEntryId();

    let campaign = engine.createCampaign({ name: 'campaign-one' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: alyx } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: borin } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: mira } satisfies CharacterCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'PartyCreated',
        partyId,
        name: 'The Bridge Burners',
        memberIds: [alyx.id, borin.id, mira.id],
      } satisfies PartyCreatedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'QuestStarted',
        questId: goblinQuestId,
        title: 'Clear the Goblin Caves',
        description: 'The miners have abandoned the south tunnels. Investigate.',
        partyId,
        objectives: [
          {
            id: obj1,
            description: 'Defeat the Goblin Boss',
            status: 'pending',
            optional: false,
            progress: 0,
            required: 1,
          },
          {
            id: obj2,
            description: 'Rescue the captured miners',
            status: 'pending',
            optional: false,
            progress: 0,
            required: 3,
          },
          {
            id: obj3,
            description: 'Recover the stolen ledger (optional)',
            status: 'pending',
            optional: true,
            progress: 0,
            required: 1,
          },
        ],
        reward: {
          xpPerCharacter: 300,
          currency: { cp: 0, sp: 0, ep: 0, gp: 75, pp: 0 },
          itemDefinitionIds: [],
        },
      } satisfies QuestStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'XPAwarded',
        characterId: alyx.id,
        amount: 50,
        source: 'scouting the entrance',
      } satisfies XPAwardedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'QuestStarted',
        questId: sideQuestId,
        title: 'A Whisper in the Dark',
        description: 'Investigate the voice Alyx heard.',
        partyId,
        objectives: [
          {
            id: sideObj,
            description: 'Find the source of the voice',
            status: 'pending',
            optional: false,
            progress: 0,
            required: 1,
          },
        ],
        reward: {
          xpPerCharacter: 100,
          currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
          itemDefinitionIds: [],
        },
      } satisfies QuestStartedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ObjectiveProgressed',
        questId: goblinQuestId,
        objectiveId: obj2,
        delta: 2,
      } satisfies ObjectiveProgressedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'MilestoneAwarded',
        kind: 'minor',
        title: 'Pushed past the first barricade',
        partyId,
        questId: goblinQuestId,
      } satisfies MilestoneAwardedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ObjectiveCompleted',
        questId: goblinQuestId,
        objectiveId: obj1,
      } satisfies ObjectiveCompletedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'ObjectiveProgressed',
        questId: goblinQuestId,
        objectiveId: obj2,
        delta: 1,
      } satisfies ObjectiveProgressedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'QuestCompleted',
        questId: goblinQuestId,
      } satisfies QuestCompletedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'QuestRewardClaimed',
        questId: goblinQuestId,
        beneficiaryCharacterIds: [alyx.id, borin.id, mira.id],
      } satisfies QuestRewardClaimedEvent,
      {
        id: eventId(),
        at: isoTimestamp(),
        type: 'MilestoneAwarded',
        kind: 'major',
        title: 'The Goblin Caves are clear',
        partyId,
        questId: goblinQuestId,
      } satisfies MilestoneAwardedEvent,
    ]);

    const quest = campaign.state.quests[goblinQuestId];
    expect(quest?.status).toBe('completed');
    expect(quest?.rewardClaimed).toBe(true);
    expect(quest?.objectives[2]?.status).toBe('pending');
    expect(campaign.state.characters[alyx.id]?.xp).toBe(50 + 300);
    expect(campaign.state.characters[borin.id]?.xp).toBe(300);
    expect(campaign.state.characters[mira.id]?.xp).toBe(300);
    expect(campaign.state.parties[partyId]?.purse.gp).toBe(75);
    expect(campaign.state.milestones).toHaveLength(2);
    expect(campaign.state.quests[sideQuestId]?.status).toBe('active');

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Slice 20: Clear the Goblin Caves',
      }),
    ).toMatchFileSnapshot('./transcripts/s20-quests-milestones.transcript.rtf');
  });
});
