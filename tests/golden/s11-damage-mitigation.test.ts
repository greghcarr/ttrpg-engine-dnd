import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index.js';
import { seededRNG } from '../../src/rng/seeded.js';
import { throwOnCallRNG } from '../../src/rng/throw.js';
import { replay } from '../../src/engine/replay.js';
import { commit } from '../../src/engine/commit.js';
import {
  TEST_PACK,
  TEST_CONTENT,
  buildFighter,
  eventId,
  isoTimestamp,
} from '../fixtures/index.js';
import { formatTranscript } from '../transcript.js';
import type { ContentPack } from '../../src/content/pack.js';
import type { CharacterCreatedEvent } from '../../src/schemas/events/progression.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../src/ids.js';
import type { DamageAppliedEvent } from '../../src/schemas/events/combat.js';

const fireResistantPack: ContentPack = {
  ...TEST_PACK,
  conditions: [
    ...TEST_PACK.conditions,
    {
      id: 'fire-resistant',
      name: 'Fire-resistant',
      stackable: false,
      endsOn: [],
      effects: [{ kind: 'GrantResistance', damageType: 'fire' }],
    },
    {
      id: 'fire-immune',
      name: 'Fire-immune',
      stackable: false,
      endsOn: [],
      effects: [{ kind: 'GrantImmunity', damageType: 'fire' }],
    },
    {
      id: 'fire-vulnerable',
      name: 'Fire-vulnerable',
      stackable: false,
      endsOn: [],
      effects: [{ kind: 'GrantVulnerability', damageType: 'fire' }],
    },
  ],
};

const buildEnchanter = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Mira the Enchanter',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['fireball'],
  });

const buildWithCondition = (name: string, conditionId: string): Character => {
  const base = buildFighter({ name, hpMax: 60, hpCurrent: 60 });
  return CharacterSchema.parse({
    ...base,
    appliedConditions: [
      { id: '01HKQM3J6S1H4ZGSTPYBHN0VCS', conditionId },
    ],
  });
};

describe('golden: damage mitigation order of operations', () => {
  it('Fireball hits three targets: normal, resistant, immune. Each takes the right amount.', async () => {
    const engine = createEngine({ contentPacks: [fireResistantPack], rng: seededRNG(5) });
    const mira = buildEnchanter();
    const normal = buildFighter({ name: 'Goblin Mundane', hpMax: 60, hpCurrent: 60 });
    const resistant = buildWithCondition('Goblin Resistant', 'fire-resistant');
    const immune = buildWithCondition('Goblin Immune', 'fire-immune');

    let campaign = engine.createCampaign({ name: 'mitigation' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: mira } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: normal } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: resistant } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: immune } satisfies CharacterCreatedEvent,
    ]);

    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: mira.id,
        spellId: 'fireball',
        slotLevel: 3,
        targetIds: [normal.id, resistant.id, immune.id],
        castingClassId: 'wizard',
      }).events,
    );

    const damageEvents = campaign.events.filter(
      (e): e is DamageAppliedEvent => e.type === 'DamageApplied',
    );
    const byTarget = new Map(damageEvents.map((e) => [e.targetId, e]));
    const normalDamage = byTarget.get(normal.id);
    const resistantDamage = byTarget.get(resistant.id);
    const immuneDamage = byTarget.get(immune.id);

    expect(normalDamage?.components[0]?.mitigation).toBeUndefined();
    expect(resistantDamage?.components[0]?.mitigation).toBe('resisted');
    expect(resistantDamage?.components[0]?.amount).toBe(
      Math.floor((resistantDamage?.components[0]?.rawAmount ?? 0) / 2),
    );
    expect(immuneDamage?.components[0]?.mitigation).toBe('immune');
    expect(immuneDamage?.components[0]?.amount).toBe(0);

    const replayed = replay(campaign.events);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(campaign.state));
    void throwOnCallRNG();
    expect(() => replay(campaign.events)).not.toThrow();

    await expect(
      formatTranscript(campaign.events, TEST_CONTENT, {
        title: 'Fireball vs mundane, fire-resistant, fire-immune targets',
      }),
    ).toMatchFileSnapshot('./transcripts/s11-damage-mitigation.transcript.md');
  });

  it('vulnerability doubles damage', () => {
    const engine = createEngine({ contentPacks: [fireResistantPack], rng: seededRNG(3) });
    const mira = buildEnchanter();
    const vulnerable = buildWithCondition('Goblin Vulnerable', 'fire-vulnerable');
    let campaign = engine.createCampaign({ name: 'vuln' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: mira } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: vulnerable } satisfies CharacterCreatedEvent,
    ]);
    campaign = commit(
      campaign,
      engine.plan.castSpell(campaign.state, {
        characterId: mira.id,
        spellId: 'fireball',
        slotLevel: 3,
        targetIds: [vulnerable.id],
        castingClassId: 'wizard',
      }).events,
    );
    const dmg = campaign.events.find(
      (e): e is DamageAppliedEvent =>
        e.type === 'DamageApplied' && e.targetId === vulnerable.id,
    );
    expect(dmg?.components[0]?.mitigation).toBe('vulnerable');
    expect(dmg?.components[0]?.amount).toBe(
      (dmg?.components[0]?.rawAmount ?? 0) * 2,
    );
  });
});
