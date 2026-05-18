import { describe, expect, it } from 'vitest';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import { computeSavingThrow } from '../../../src/derive/save.js';
import { computeAbilityCheck } from '../../../src/derive/ability-check.js';
import { computeAttackBonus } from '../../../src/derive/attack.js';
import { effectiveAbilityScore } from '../../../src/derive/ability.js';
import { buildEffectStack } from '../../../src/derive/effect-stack.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { resolveContent } from '../../../src/content/pack.js';
import { commit, type Campaign } from '../../../src/engine/commit.js';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import { eventId, isoTimestamp, makeItemInstance } from '../../fixtures/index.js';

// Slice 229: OverrideAbilityScore primitive (floor semantics). Each
// canonical user is a magic item that sets an ability to a specific
// value while attuned, with no effect when the base score is already
// at or above that value. Mirrors the SetACFloor (slice 74) shape.

const PACK = loadStarterPack();
const CONTENT = resolveContent([PACK]);

const buildCharacter = (overrides?: Partial<Character>): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Hero',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 40, max: 40, temp: 0 },
    featsTaken: [],
    ...overrides,
  });

describe('effectiveAbilityScore helper (slice 229)', () => {
  it('returns the base score when no floor is provided', () => {
    expect(effectiveAbilityScore(12)).toBe(12);
    expect(effectiveAbilityScore(12, undefined)).toBe(12);
  });

  it('returns the floor when it is greater than the base', () => {
    expect(effectiveAbilityScore(12, 19)).toBe(19);
  });

  it('returns the base when it is greater than or equal to the floor', () => {
    expect(effectiveAbilityScore(19, 19)).toBe(19);
    expect(effectiveAbilityScore(20, 19)).toBe(20);
  });
});

describe('OverrideAbilityScore accumulator (slice 229)', () => {
  it('collects floor entries from equipped items', () => {
    const character = buildCharacter();
    const amulet = makeItemInstance('amulet-of-health');
    const character2: Character = {
      ...character,
      equipped: { ...character.equipped, attuned: [amulet.id] },
    };
    const itemInstances = { [amulet.id]: amulet };
    const acc = buildEffectStack({ character: character2, content: CONTENT, itemInstances });
    expect(acc.effectiveAbilityScoreFloor('CON')?.value).toBe(19);
    expect(acc.effectiveAbilityScoreFloor('STR')).toBeUndefined();
  });

  it('multiple floors on the same ability fold to the highest', () => {
    const character = buildCharacter();
    const gauntlets = makeItemInstance('gauntlets-of-ogre-power');
    const belt = makeItemInstance('belt-of-cloud-giant-strength');
    const character2: Character = {
      ...character,
      equipped: {
        ...character.equipped,
        attuned: [gauntlets.id, belt.id],
      },
    };
    const itemInstances = { [gauntlets.id]: gauntlets, [belt.id]: belt };
    const acc = buildEffectStack({ character: character2, content: CONTENT, itemInstances });
    // Gauntlets sets STR 19; Cloud Giant belt sets STR 27. Highest wins.
    expect(acc.effectiveAbilityScoreFloor('STR')?.value).toBe(27);
  });
});

describe('Amulet of Health: CON-19 floor on saves (slice 229 canonical user)', () => {
  it('a CON 12 fighter wearing the amulet rolls CON saves with +4 (mod for CON 19), not +1', () => {
    const character = buildCharacter({ abilityScores: { STR: 12, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 10 } });
    const amulet = makeItemInstance('amulet-of-health');
    const character2: Character = {
      ...character,
      equipped: { ...character.equipped, attuned: [amulet.id] },
    };
    const itemInstances = { [amulet.id]: amulet };
    const save = computeSavingThrow({
      character: character2,
      itemInstances,
      content: CONTENT,
      ability: 'CON',
    });
    // Fighter has CON save proficiency at level 5: PB +3 + mod +4 = +7
    expect(save.total).toBe(7);
    expect(save.breakdown.find((e) => e.source === 'CON-mod')?.value).toBe(4);
  });

  it('a CON 20 fighter wearing the amulet still rolls CON saves with +5 (no demotion)', () => {
    const character = buildCharacter({ abilityScores: { STR: 12, DEX: 14, CON: 20, INT: 10, WIS: 10, CHA: 10 } });
    const amulet = makeItemInstance('amulet-of-health');
    const character2: Character = {
      ...character,
      equipped: { ...character.equipped, attuned: [amulet.id] },
    };
    const itemInstances = { [amulet.id]: amulet };
    const save = computeSavingThrow({
      character: character2,
      itemInstances,
      content: CONTENT,
      ability: 'CON',
    });
    expect(save.breakdown.find((e) => e.source === 'CON-mod')?.value).toBe(5);
  });
});

describe('Gauntlets of Ogre Power: STR-19 floor on attacks + checks (slice 229)', () => {
  it('a STR 8 character wearing the gauntlets gets +4 STR mod on Athletics checks', () => {
    const character = buildCharacter({ abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 10 } });
    const gauntlets = makeItemInstance('gauntlets-of-ogre-power');
    const character2: Character = {
      ...character,
      equipped: { ...character.equipped, attuned: [gauntlets.id] },
    };
    const itemInstances = { [gauntlets.id]: gauntlets };
    const check = computeAbilityCheck({
      character: character2,
      itemInstances,
      content: CONTENT,
      ability: 'STR',
      skill: 'athletics',
    });
    expect(check.breakdown.find((e) => e.source === 'STR-mod')?.value).toBe(4);
  });

  it('STR-based attack rolls use STR 19 with the gauntlets equipped', () => {
    const character = buildCharacter({ abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 10 } });
    const longsword = makeItemInstance('longsword');
    const gauntlets = makeItemInstance('gauntlets-of-ogre-power');
    const character2: Character = {
      ...character,
      equipped: {
        ...character.equipped,
        mainHand: longsword.id,
        attuned: [gauntlets.id],
      },
    };
    const itemInstances = { [longsword.id]: longsword, [gauntlets.id]: gauntlets };
    const attack = computeAttackBonus({
      character: character2,
      itemInstances,
      content: CONTENT,
      weaponInstanceId: longsword.id,
    });
    expect(attack.breakdown.find((e) => e.source === 'STR-mod')?.value).toBe(4);
  });
});

describe('Belt of Storm Giant Strength: STR-29 damage rolls (slice 229)', () => {
  it('a STR 10 fighter wielding a longsword with the belt deals damage with +9 STR mod', () => {
    for (let seed = 1; seed < 100; seed += 1) {
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(seed) });
      const longsword = makeItemInstance('longsword');
      const belt = makeItemInstance('belt-of-storm-giant-strength');
      const goblin = buildCharacter({ name: 'Goblin' });
      const fighter: Character = {
        ...buildCharacter({ abilityScores: { STR: 10, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 } }),
        equipped: {
          mainHand: longsword.id,
          attuned: [belt.id],
        },
      };
      let campaign: Campaign = engine.createCampaign({ name: `belt-${seed}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: longsword },
        { id: eventId(), at: isoTimestamp(), type: 'ItemAcquired', instance: belt },
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: fighter } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: goblin } satisfies CharacterCreatedEvent,
      ]);
      const events = engine.plan.attack(campaign.state, {
        attackerId: fighter.id,
        targetId: goblin.id,
        weaponInstanceId: longsword.id,
      }).events;
      const dmgEvt = events.find((e) => e.type === 'DamageRolled');
      if (!dmgEvt) continue;
      // Belt of Storm Giant Strength sets STR to 29, mod +9. Longsword
      // damage = 1d8 + 9 (STR mod). The dice roll varies but the
      // modifier is fixed.
      const modifier = (dmgEvt as { rolls: Array<{ modifier: number }> }).rolls[0]!.modifier;
      expect(modifier).toBe(9);
      return;
    }
    throw new Error('no seed produced a DamageRolled event');
  });
});
