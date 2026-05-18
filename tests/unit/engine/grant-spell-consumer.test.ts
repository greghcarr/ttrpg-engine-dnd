import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { effectiveSpellList } from '../../../src/derive/effective-spell-list.js';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';

// Slice 212: GrantSpell engine consumer. cast-spell.ts now consults
// the bearer's effect stack for `GrantSpell` entries via the new
// `effectiveSpellList` derive helper, so subclass domain spell lists
// and other "extra spell" feature grants actually let the bearer
// cast those spells without putting them in `character.preparedSpells`.
//
// Canonical user: Life Domain L3 Life Domain Spells, which now
// ships with four GrantSpell entries (Aid, Bless, Cure Wounds,
// Lesser Restoration at always-prepared preparation per SRD 5.2.1).

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildCleric = (level: number, subclass: 'life-domain' | null): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Solace',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classes: [{
      classId: 'cleric',
      level,
      hitDiceRemaining: level,
      ...(subclass !== null ? { subclassId: subclass } : {}),
    }],
    abilityScores: { STR: 12, DEX: 12, CON: 14, INT: 10, WIS: 18, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    // Intentionally NOT including bless / cure-wounds / etc. — those
    // come from the subclass GrantSpell entries.
    preparedSpells: [],
  });

const buildAlly = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Ally',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 3, hitDiceRemaining: 3 }],
    abilityScores: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 10, max: 30, temp: 0 },
    featsTaken: [],
  });

describe('slice 212: GrantSpell engine consumer + Life Domain L3 Spells', () => {
  it('the accumulator collects GrantSpell entries for an L3 Life Domain cleric', () => {
    const cleric = buildCleric(3, 'life-domain');
    const acc = buildEffectStack({
      character: cleric,
      content: CONTENT,
      itemInstances: {},
    });
    const ids = acc.grantedSpells().map((g) => g.spellId).sort();
    expect(ids).toEqual(['aid', 'bless', 'cure-wounds', 'lesser-restoration']);
    for (const g of acc.grantedSpells()) {
      expect(g.preparation).toBe('always-prepared');
    }
  });

  it("effectiveSpellList unions character.preparedSpells with granted spells", () => {
    const cleric = buildCleric(3, 'life-domain');
    // Stash one "explicitly prepared" spell so the union path matters.
    const withPrepared = { ...cleric, preparedSpells: ['guidance'] };
    const list = effectiveSpellList({
      character: withPrepared as Character,
      content: CONTENT,
      itemInstances: {},
    });
    expect(list).toContain('guidance');
    expect(list).toContain('bless');
    expect(list).toContain('cure-wounds');
  });

  it('an L3 Life Domain cleric can cast Cure Wounds even though it is not in preparedSpells', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(212) });
    const cleric = buildCleric(3, 'life-domain');
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'life-domain-grant' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'cure-wounds',
        slotLevel: 1,
        targetIds: [ally.id],
      }),
    ).not.toThrow();
  });

  it('an L3 cleric WITHOUT life-domain subclass cannot cast Cure Wounds (no GrantSpell)', () => {
    const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(212) });
    const cleric = buildCleric(3, null);
    const ally = buildAlly();
    let campaign: Campaign = engine.createCampaign({ name: 'no-subclass' });
    campaign = commit(campaign, [
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: cleric } satisfies CharacterCreatedEvent,
      { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: ally } satisfies CharacterCreatedEvent,
    ]);
    expect(() =>
      engine.plan.castSpell(campaign.state, {
        characterId: cleric.id,
        spellId: 'cure-wounds',
        slotLevel: 1,
        targetIds: [ally.id],
      }),
    ).toThrow(/does not know or prepare/);
  });
});
