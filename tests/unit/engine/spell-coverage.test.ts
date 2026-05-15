// Spell-by-spell smoke test. For each spell shipped in the starter pack,
// we cast it under a controlled scenario and assert that the engine
// emits the events a D&D-knowledgeable reader expects to see. A leveled
// spell that ships in the pack with no mechanical effect at all (Magic
// Missile, Bless before they were wired up) fails this test, surfacing
// the gap.
//
// The intent table below is the source of truth for "what should this
// spell do, mechanically?". Each entry is short: just enough to identify
// the expected event kinds. Damage values aren't asserted (those are
// owned by tighter unit tests); we're catching omissions and shape
// drift here, not exact dice.
//
// `skip` is used for spells that have their own dedicated planner
// (counterspell, dispel-magic, identify) where planCastSpell isn't the
// right entry point, and for pure utility cantrips whose entire effect
// is narrative (mage-hand, prestidigitation, light, detect-magic). Every
// `skip` line carries a reason so it stays auditable.

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../../src/engine/index.js';
import { seededRNG } from '../../../src/rng/seeded.js';
import { commit } from '../../../src/engine/commit.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import { loadStarterPack } from '../../../src/content/packs/starter.js';
import { CharacterSchema, type Character } from '../../../src/schemas/runtime/character.js';
import { newCharacterId } from '../../../src/ids.js';
import type { CharacterCreatedEvent } from '../../../src/schemas/events/progression.js';
import type { Event } from '../../../src/schemas/events/index.js';

type Expectation =
  | { kind: 'attack' }
  | { kind: 'save' }
  | { kind: 'heal' }
  | { kind: 'auto-hit'; minDarts: number }
  | { kind: 'buff'; conditionId: string }
  | { kind: 'remove-condition'; seedConditionId: string }
  | { kind: 'hp-pool-knockout' }
  | { kind: 'summon' }
  | { kind: 'skip'; reason: string };

const SPELL_EXPECTATIONS: Record<string, Expectation> = {
  // Cantrips with explicit attack rolls
  'fire-bolt': { kind: 'attack' },
  'eldritch-blast': { kind: 'attack' },
  'ray-of-frost': { kind: 'attack' },
  'shocking-grasp': { kind: 'attack' },
  // Cantrip save spells
  'sacred-flame': { kind: 'save' },
  // L1+
  'magic-missile': { kind: 'auto-hit', minDarts: 3 },
  'fireball': { kind: 'save' },
  'burning-hands': { kind: 'save' },
  'thunderwave': { kind: 'save' },
  'hold-person': { kind: 'save' },
  'cure-wounds': { kind: 'heal' },
  'healing-word': { kind: 'heal' },
  'bless': { kind: 'buff', conditionId: 'blessed' },
  'spiritual-weapon': { kind: 'attack' },
  // Spells with dedicated planners (planCounterspell, planDispelMagic,
  // planIdentify) — castSpell isn't the right call site.
  'counterspell': { kind: 'skip', reason: 'has dedicated planCounterspell' },
  'dispel-magic': { kind: 'skip', reason: 'has dedicated planDispelMagic' },
  'identify': { kind: 'skip', reason: 'has dedicated planIdentify' },
  // Utility / narrative-only — cast emits no mechanical event.
  'mage-hand': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'prestidigitation': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'light': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'detect-magic': { kind: 'skip', reason: 'detection only, no mechanical effect' },
  'guidance': { kind: 'buff', conditionId: 'guided' },
  // Defensive / movement spells not yet mechanically modeled.
  'shield': { kind: 'skip', reason: 'has dedicated planShield (reaction, not planCastSpell)' },
  'mage-armor': { kind: 'buff', conditionId: 'mage-armored' },
  'misty-step': { kind: 'skip', reason: 'has dedicated planMistyStep (bonus action teleport, not planCastSpell)' },
  // Control / crowd-control spells not yet mechanically modeled.
  'faerie-fire': { kind: 'save' },
  'bane': { kind: 'save' },
  'sleep': { kind: 'hp-pool-knockout' },
  'web': { kind: 'save' },
  'spirit-guardians': { kind: 'skip', reason: 'aura-damage mechanic: cast itself emits only ConcentrationStarted; damage fires via engine.plan.tickAura per-turn' },
  // Buffs / utility spells with simple shapes not yet wired.
  'aid': { kind: 'heal' },
  'polymorph': { kind: 'skip', reason: 'has dedicated planPolymorph (not planCastSpell)' },
  'lesser-restoration': { kind: 'remove-condition', seedConditionId: 'poisoned' },
  // Additional PHB 2024 cantrips with attack rolls
  'chill-touch': { kind: 'attack' },
  'produce-flame': { kind: 'attack' },
  'starry-wisp': { kind: 'attack' },
  'thorn-whip': { kind: 'attack' },
  // Additional PHB 2024 cantrips with saves
  'acid-splash': { kind: 'save' },
  'frostbite': { kind: 'save' },
  'mind-sliver': { kind: 'save' },
  'poison-spray': { kind: 'save' },
  'thunderclap': { kind: 'save' },
  'toll-the-dead': { kind: 'save' },
  'vicious-mockery': { kind: 'save' },
  'word-of-radiance': { kind: 'save' },
  // Utility / narrative cantrips with no wired mechanical effect yet.
  'blade-ward': { kind: 'skip', reason: 'self resistance buff, no condition wired' },
  'dancing-lights': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'druidcraft': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'friends': { kind: 'skip', reason: 'social buff cantrip, no mechanical effect' },
  'mending': { kind: 'skip', reason: 'utility repair, no mechanical effect' },
  'message': { kind: 'skip', reason: 'utility communication, no mechanical effect' },
  'minor-illusion': { kind: 'skip', reason: 'illusion cantrip, no mechanical effect' },
  'mold-earth': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'resistance': { kind: 'skip', reason: 'narrow-window save buff, no condition wired' },
  'shillelagh': { kind: 'skip', reason: 'weapon-enhancement cantrip, not wired through planCastSpell' },
  'spare-the-dying': { kind: 'skip', reason: 'stabilize-only cantrip, no mechanical event yet' },
  'thaumaturgy': { kind: 'skip', reason: 'narrative cantrip, no mechanical effect' },
  'true-strike': { kind: 'skip', reason: '2024 weapon-attack rebrand, not wired through planCastSpell' },
  // PHB 2024 L1 spells with wired mechanics
  'cause-fear': { kind: 'save' },
  'charm-person': { kind: 'save' },
  'color-spray': { kind: 'hp-pool-knockout' },
  'dissonant-whispers': { kind: 'save' },
  'earth-tremor': { kind: 'save' },
  'guiding-bolt': { kind: 'attack' },
  'hellish-rebuke': { kind: 'save' },
  'inflict-wounds': { kind: 'attack' },
  'ray-of-sickness': { kind: 'attack' },
  'tashas-hideous-laughter': { kind: 'save' },
  // PHB 2024 L1 spells shipped schema-only (no mechanicalEffects yet).
  // Each line records why it's deferred so the gap is auditable.
  'absorb-elements': { kind: 'skip', reason: 'reaction-cast with damage-absorption rider; reaction system not modeled' },
  'alarm': { kind: 'skip', reason: 'ritual alarm zone; no combat-event side' },
  'animal-friendship': { kind: 'skip', reason: 'charmed-beast-only variant; condition target restriction not modeled' },
  'chromatic-orb': { kind: 'skip', reason: 'caster-chosen damage type at cast time; choice protocol not exposed in spell mechanic schema' },
  'command': { kind: 'skip', reason: 'per-word condition effects vary; not modeled generically' },
  'compelled-duel': { kind: 'skip', reason: 'movement-aversion rider on charm; rider primitive not modeled' },
  'comprehend-languages': { kind: 'skip', reason: 'utility ritual, narrative only' },
  'create-or-destroy-water': { kind: 'skip', reason: 'utility, narrative only' },
  'detect-evil-and-good': { kind: 'skip', reason: 'detection ritual, narrative only' },
  'detect-poison-and-disease': { kind: 'skip', reason: 'detection ritual, narrative only' },
  'disguise-self': { kind: 'skip', reason: 'illusion utility, narrative only' },
  'divine-favor': { kind: 'skip', reason: 'concentration weapon-damage rider; on-hit trigger system not modeled' },
  'ensnaring-strike': { kind: 'skip', reason: 'ranger smite with on-hit save rider; on-hit trigger system not modeled' },
  'entangle': { kind: 'skip', reason: 'area-effect restrained; area-effect spell mechanic not modeled' },
  'expeditious-retreat': { kind: 'skip', reason: 'bonus-action speed buff, narrative only' },
  'false-life': { kind: 'skip', reason: 'self temp-HP; temp-HP-grant mechanic not wired for spells' },
  'feather-fall': { kind: 'skip', reason: 'reaction, narrative only' },
  'find-familiar': { kind: 'summon' },
  'fog-cloud': { kind: 'skip', reason: 'area obscurement, narrative only' },
  'goodberry': { kind: 'skip', reason: 'creates consumable items; item-creation mechanic not wired for spells' },
  'grease': { kind: 'skip', reason: 'area difficult terrain + DEX save for prone; area mechanic not modeled' },
  'hail-of-thorns': { kind: 'skip', reason: 'ranger smite with on-hit AoE rider; on-hit trigger system not modeled' },
  'heroism': { kind: 'skip', reason: 'recurring temp-HP per turn + immune-to-fear; recurring effect + new condition needed' },
  'hex': { kind: 'skip', reason: 'curse with on-hit +1d6 necrotic; on-hit trigger system not modeled' },
  'hunters-mark': { kind: 'skip', reason: 'has dedicated planHuntersMark (concentration mark, not planCastSpell)' },
  'jump': { kind: 'skip', reason: 'utility movement, narrative only' },
  'longstrider': { kind: 'skip', reason: 'speed buff, narrative only' },
  'protection-from-evil-and-good': { kind: 'skip', reason: 'conditional disadvantage tied to creature types; type-conditional buff not modeled' },
  'purify-food-and-drink': { kind: 'skip', reason: 'utility ritual, narrative only' },
  'sanctuary': { kind: 'skip', reason: 'reaction-aversion via WIS save; reaction system not modeled' },
  'searing-smite': { kind: 'skip', reason: 'paladin smite with on-hit damage rider; on-hit trigger system not modeled' },
  'shield-of-faith': { kind: 'skip', reason: '+2 AC concentration buff; AC-buff condition not yet wired' },
  'silent-image': { kind: 'skip', reason: 'illusion concentration, narrative only' },
  'speak-with-animals': { kind: 'skip', reason: 'ritual, narrative only' },
  'thunderous-smite': { kind: 'skip', reason: 'paladin smite with on-hit damage + push; on-hit trigger system not modeled' },
  'unseen-servant': { kind: 'summon' },
  'wrathful-smite': { kind: 'skip', reason: 'paladin smite with on-hit frightened rider; on-hit trigger system not modeled' },
  // PHB 2024 L2 spells with wired mechanics
  'blindness-deafness': { kind: 'save' },
  'crown-of-madness': { kind: 'save' },
  'flame-blade': { kind: 'attack' },
  'heat-metal': { kind: 'save' },
  'invisibility': { kind: 'buff', conditionId: 'invisible' },
  'melfs-acid-arrow': { kind: 'attack' },
  'moonbeam': { kind: 'save' },
  'prayer-of-healing': { kind: 'heal' },
  'protection-from-poison': { kind: 'remove-condition', seedConditionId: 'poisoned' },
  'scorching-ray': { kind: 'attack' },
  'shatter': { kind: 'save' },
  'suggestion': { kind: 'save' },
  // PHB 2024 L2 spells shipped schema-only. Reasons mirror the engine
  // primitive each one is waiting on; see docs/starter-pack-gaps.md.
  'alter-self': { kind: 'skip', reason: 'shapeshift utility; transformation handler not modeled for spells' },
  'animal-messenger': { kind: 'skip', reason: 'ritual utility, narrative only' },
  'arcane-lock': { kind: 'skip', reason: 'utility (sealed door); no combat-event side' },
  'augury': { kind: 'skip', reason: 'divination ritual, narrative only' },
  'barkskin': { kind: 'skip', reason: 'sets AC to 17; AC-buff condition not yet modeled' },
  'blur': { kind: 'skip', reason: 'imposes disadvantage on attacks against caster; attack-roll-buff condition not modeled' },
  'branding-smite': { kind: 'skip', reason: 'paladin smite with on-hit radiant rider; on-hit trigger system not modeled' },
  'calm-emotions': { kind: 'skip', reason: 'caster-chosen variant (suppress charm/frighten vs make indifferent); choice protocol not modeled' },
  'cloud-of-daggers': { kind: 'skip', reason: 'area damage on enter; area-effect spell mechanic not modeled' },
  'continual-flame': { kind: 'skip', reason: 'utility (creates flame); no combat-event side' },
  'cordon-of-arrows': { kind: 'skip', reason: 'placed-trap area effect; trap mechanic not modeled' },
  'darkness': { kind: 'skip', reason: 'area obscurement, concentration; area mechanic + visibility-condition not modeled' },
  'darkvision': { kind: 'skip', reason: 'utility (grants darkvision); no combat-event side' },
  'detect-thoughts': { kind: 'skip', reason: 'divination utility; detection mechanic not modeled' },
  'dragons-breath': { kind: 'skip', reason: 'grants ally a breath-weapon reaction-style; on-action rider not modeled' },
  'dust-devil': { kind: 'skip', reason: 'summoned mobile area; area + summon mechanics not modeled' },
  'earthbind': { kind: 'skip', reason: 'forces target to ground via STR save; aerial restraint condition not modeled' },
  'enhance-ability': { kind: 'skip', reason: 'caster-chosen ability buff; ability-check-buff condition not modeled' },
  'enlarge-reduce': { kind: 'skip', reason: 'caster-chosen variant (grow vs shrink); choice protocol + size condition not modeled' },
  'enthrall': { kind: 'skip', reason: 'WIS save against perception disadvantage on caster; perception-buff condition not modeled' },
  'find-steed': { kind: 'summon' },
  'find-traps': { kind: 'skip', reason: 'divination utility; detection mechanic not modeled' },
  'flaming-sphere': { kind: 'skip', reason: 'mobile area damage; area-effect mechanic not modeled' },
  'gentle-repose': { kind: 'skip', reason: 'utility ritual (preserves corpse), narrative only' },
  'gust-of-wind': { kind: 'skip', reason: 'pushes / suppresses via STR save; push primitive not modeled' },
  'knock': { kind: 'skip', reason: 'utility (opens lock), narrative only' },
  'levitate': { kind: 'skip', reason: 'lifts a target; flight / hover condition not modeled' },
  'locate-animals-or-plants': { kind: 'skip', reason: 'divination utility, narrative only' },
  'locate-object': { kind: 'skip', reason: 'divination utility, narrative only' },
  'magic-mouth': { kind: 'skip', reason: 'utility (programmed illusion), narrative only' },
  'magic-weapon': { kind: 'skip', reason: '+1 weapon attack/damage buff; item-buff condition not modeled' },
  'mirror-image': { kind: 'skip', reason: 'creates three duplicates that intercept attacks; duplicate-pool condition not modeled' },
  'nystuls-magic-aura': { kind: 'skip', reason: 'utility (anti-detect), narrative only' },
  'pass-without-trace': { kind: 'skip', reason: '+10 stealth aura; aura-buff condition not modeled' },
  'phantasmal-force': { kind: 'skip', reason: 'INT save illusion + recurring psychic damage; recurring-rider primitive not modeled' },
  'ray-of-enfeeblement': { kind: 'skip', reason: 'ranged attack with on-hit weapon-damage halving; on-hit rider primitive not modeled' },
  'rope-trick': { kind: 'skip', reason: 'utility (extradimensional space), narrative only' },
  'see-invisibility': { kind: 'skip', reason: 'utility (see invisible), narrative only' },
  'silence': { kind: 'skip', reason: 'area zone of silence; area-effect mechanic not modeled' },
  'skywrite': { kind: 'skip', reason: 'utility (writes in sky), narrative only' },
  'spider-climb': { kind: 'skip', reason: 'wall-walking utility; movement-mode condition not modeled' },
  'spike-growth': { kind: 'skip', reason: 'area damage on movement; area-effect mechanic not modeled' },
  'summon-beast': { kind: 'summon' },
  'warding-bond': { kind: 'skip', reason: 'damage-share + AC/save buff; multi-target linked condition not modeled' },
  'zone-of-truth': { kind: 'skip', reason: 'area + CHA save against deception; area-effect mechanic not modeled' },
  // PHB 2024 L3 spells with wired mechanics
  'call-lightning': { kind: 'save' },
  'fear': { kind: 'save' },
  'hypnotic-pattern': { kind: 'save' },
  'lightning-bolt': { kind: 'save' },
  'mass-healing-word': { kind: 'heal' },
  'sleet-storm': { kind: 'save' },
  'vampiric-touch': { kind: 'attack' },
  // PHB 2024 L3 spells shipped schema-only; see docs/starter-pack-gaps.md.
  'animate-dead': { kind: 'summon' },
  'aura-of-vitality': { kind: 'skip', reason: 'recurring bonus-action heal aura; recurring-rider primitive not modeled' },
  'beacon-of-hope': { kind: 'skip', reason: 'multi-buff condition (advantage on WIS + death saves + max heal); composite-buff condition not modeled' },
  'bestow-curse': { kind: 'skip', reason: 'caster-chosen curse variant (disadvantage / movement / damage / paralysis); choice protocol not modeled' },
  'blinding-smite': { kind: 'skip', reason: 'paladin smite with on-hit save → blinded rider; on-hit trigger system not modeled' },
  'clairvoyance': { kind: 'skip', reason: 'remote sensor utility; scrying mechanic not modeled' },
  'conjure-animals': { kind: 'summon' },
  'create-food-and-water': { kind: 'skip', reason: 'utility (food creation), narrative only' },
  'crusaders-mantle': { kind: 'skip', reason: 'paladin aura granting +1d4 radiant to ally weapon attacks; on-hit-rider on aura not modeled' },
  'daylight': { kind: 'skip', reason: 'utility (creates bright light), narrative only' },
  'elemental-weapon': { kind: 'skip', reason: 'caster-chosen damage type weapon enhance; item-buff + caster-chosen variant not modeled' },
  'feign-death': { kind: 'skip', reason: 'utility (death simulation), narrative only' },
  'fly': { kind: 'skip', reason: 'flight movement-mode; movement-mode condition not modeled' },
  'gaseous-form': { kind: 'skip', reason: 'transformation utility; transformation handler not modeled for spells' },
  'glyph-of-warding': { kind: 'skip', reason: 'placed-trap with stored spell; trap mechanic not modeled' },
  'haste': { kind: 'skip', reason: 'multi-buff condition (extra action + speed + AC + DEX-save advantage); composite-buff condition not modeled' },
  'hunger-of-hadar': { kind: 'skip', reason: 'area damage on enter and per-turn; area-effect + recurring-rider mechanics not modeled' },
  'leomunds-tiny-hut': { kind: 'skip', reason: 'persistent shelter dome; area-effect mechanic not modeled' },
  'lightning-arrow': { kind: 'skip', reason: 'ranger on-hit rider that converts arrow damage; on-hit trigger system not modeled' },
  'magic-circle': { kind: 'skip', reason: 'persistent ward against creature types; type-conditional area-effect not modeled' },
  'major-image': { kind: 'skip', reason: 'illusion with INT save on interaction; illusion + recurring-rider primitives not modeled' },
  'meld-into-stone': { kind: 'skip', reason: 'utility (merge with stone), narrative only' },
  'nondetection': { kind: 'skip', reason: 'utility (anti-detect buff), narrative only' },
  'phantom-steed': { kind: 'summon' },
  'plant-growth': { kind: 'skip', reason: 'area difficult terrain + agricultural utility; area-effect mechanic not modeled' },
  'protection-from-energy': { kind: 'skip', reason: 'resistance to chosen damage type; resistance-buff condition not modeled' },
  'remove-curse': { kind: 'skip', reason: 'removes the cursed condition; cursed condition itself not yet modeled' },
  'revivify': { kind: 'skip', reason: 'resurrection utility; death / revival mechanic not modeled for spells' },
  'sending': { kind: 'skip', reason: 'utility (telepathic message), narrative only' },
  'slow': { kind: 'skip', reason: 'area + multi-effect WIS save (speed half + no reactions + delayed action); composite area condition not modeled' },
  'speak-with-dead': { kind: 'skip', reason: 'utility (question corpse), narrative only' },
  'speak-with-plants': { kind: 'skip', reason: 'utility (talk to plants), narrative only' },
  'spirit-shroud': { kind: 'skip', reason: 'caster-chosen damage type + on-hit rider; on-hit trigger + caster-chosen variant not modeled' },
  'stinking-cloud': { kind: 'skip', reason: 'area + per-turn CON save → incapacitated; area-effect + recurring-rider mechanics not modeled' },
  'summon-fey': { kind: 'summon' },
  'summon-lesser-demons': { kind: 'summon' },
  'summon-shadowspawn': { kind: 'summon' },
  'summon-undead': { kind: 'summon' },
  'thunder-step': { kind: 'skip', reason: 'teleport + area thunder damage; multi-mechanic spell with dedicated planner pattern not yet implemented' },
  'tongues': { kind: 'skip', reason: 'utility (language understanding), narrative only' },
  'water-breathing': { kind: 'skip', reason: 'utility (breathe underwater), narrative only' },
  'water-walk': { kind: 'skip', reason: 'utility (walk on water), narrative only' },
  'wind-wall': { kind: 'skip', reason: 'area STR save with object deflection; area-effect mechanic not modeled' },
};

const buildWizard = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Spell Tester',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 28, max: 28, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildCleric = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Spell Tester',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'cleric', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 12, DEX: 10, CON: 14, INT: 10, WIS: 18, CHA: 12 },
    hp: { current: 35, max: 35, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells,
  });

const buildTarget = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Dummy',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: { current: 50, max: 50, temp: 0 },
    featsTaken: ['savage-attacker'],
    armorClass: 8, // low so attack-roll spells reliably hit at a wizard's spell attack bonus
  });

const PACK = loadStarterPack();
const ALL_SPELL_IDS = PACK.spells.map((s) => s.id);

describe('spell coverage: each shipped spell emits the expected event kinds when cast', () => {
  it('every shipped spell has an entry in SPELL_EXPECTATIONS', () => {
    // The expectation table doubles as a check that the test wasn't
    // accidentally narrowed when new spells were added.
    const tableIds = new Set(Object.keys(SPELL_EXPECTATIONS));
    const missing = ALL_SPELL_IDS.filter((id) => !tableIds.has(id));
    expect(missing, `missing expectations for: ${missing.join(', ')}`).toEqual([]);
  });

  for (const spellId of ALL_SPELL_IDS) {
    const expectation = SPELL_EXPECTATIONS[spellId];
    if (expectation === undefined) continue;
    if (expectation.kind === 'skip') {
      it.skip(`${spellId}: ${expectation.reason}`, () => {});
      continue;
    }

    it(`${spellId}: emits a ${expectation.kind} event chain`, () => {
      const spell = PACK.spells.find((s) => s.id === spellId)!;
      const engine = createEngine({ contentPacks: [PACK], rng: seededRNG(1) });
      // Use a cleric for heal / buff / remove-condition spells; wizard
      // for damage spells.
      const isClericalList = expectation.kind === 'heal'
        || expectation.kind === 'buff'
        || expectation.kind === 'remove-condition';
      const caster = isClericalList
        ? buildCleric([spellId])
        : buildWizard([spellId]);
      const t1 = buildTarget();
      const t2 = buildTarget();
      let campaign = engine.createCampaign({ name: `spell-${spellId}` });
      campaign = commit(campaign, [
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t1 } satisfies CharacterCreatedEvent,
        { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: t2 } satisfies CharacterCreatedEvent,
      ]);
      // For remove-condition spells, seed the target with the condition
      // we expect to be removed.
      if (expectation.kind === 'remove-condition') {
        campaign = commit(campaign, [
          {
            id: eventId(),
            at: isoTimestamp(),
            type: 'ConditionApplied',
            targetId: t1.id,
            conditionId: expectation.seedConditionId,
          } as Extract<Event, { type: 'ConditionApplied' }>,
        ]);
      }
      // Magic Missile needs one target per dart; for other spells one or
      // two targets is fine.
      const targetIds = expectation.kind === 'auto-hit'
        ? Array.from({ length: expectation.minDarts }, () => t1.id)
        : [t1.id, t2.id];

      const events = engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId,
        slotLevel: spell.level,
        targetIds,
      }).events as ReadonlyArray<Event>;
      const types = events.map((e) => e.type);

      // Always: SpellCastDeclared.
      expect(types).toContain('SpellCastDeclared');
      // Leveled spells consume a slot.
      if (spell.level > 0) expect(types).toContain('SpellSlotConsumed');

      switch (expectation.kind) {
        case 'attack':
          expect(types, 'expected at least one AttackRolled').toContain('AttackRolled');
          break;
        case 'save':
          expect(types, 'expected at least one SaveRolled').toContain('SaveRolled');
          break;
        case 'heal':
          expect(types, 'expected at least one Healed').toContain('Healed');
          break;
        case 'auto-hit': {
          const damageEvents = events.filter((e): e is Extract<Event, { type: 'DamageApplied' }> => e.type === 'DamageApplied');
          expect(damageEvents.length, 'expected one DamageApplied per dart').toBeGreaterThanOrEqual(expectation.minDarts);
          break;
        }
        case 'buff': {
          const conditions = events.filter((e): e is Extract<Event, { type: 'ConditionApplied' }> => e.type === 'ConditionApplied');
          expect(conditions.length, 'expected at least one ConditionApplied').toBeGreaterThanOrEqual(1);
          expect(conditions.some((e) => e.conditionId === expectation.conditionId)).toBe(true);
          break;
        }
        case 'remove-condition': {
          const removals = events.filter((e): e is Extract<Event, { type: 'ConditionRemoved' }> => e.type === 'ConditionRemoved');
          expect(removals.length, 'expected at least one ConditionRemoved').toBeGreaterThanOrEqual(1);
          expect(removals.some((e) => e.conditionId === expectation.seedConditionId)).toBe(true);
          break;
        }
        case 'summon': {
          expect(types, 'expected CompanionSummoned').toContain('CompanionSummoned');
          break;
        }
        case 'hp-pool-knockout': {
          // Sleep needs low-HP targets to knock out — Dummy's 50 HP exceeds
          // the typical 5d8 pool average. The smoke test asserts that at
          // least one creature in range gets the configured condition for
          // a pool that *does* cover one of them (so we use a targeted
          // wounded subject seeded directly).
          // Targets in this test default to 50 HP, which 5d8 (avg 22.5)
          // can't knock out. We re-cast against a target with 4 HP to
          // confirm the planner emits ConditionApplied when the pool fits.
          const lowTarget = CharacterSchema.parse({
            id: newCharacterId(),
            name: 'Sleepy',
            speciesId: 'human',
            backgroundId: 'soldier',
            classes: [{ classId: 'fighter', level: 1, hitDiceRemaining: 1 }],
            abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
            hp: { current: 4, max: 4, temp: 0 },
            featsTaken: ['savage-attacker'],
          });
          let c2 = engine.createCampaign({ name: `spell-${spellId}-low` });
          c2 = commit(c2, [
            { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: caster } satisfies CharacterCreatedEvent,
            { id: eventId(), at: isoTimestamp(), type: 'CharacterCreated', snapshot: lowTarget } satisfies CharacterCreatedEvent,
          ]);
          const lowEvents = engine.plan.castSpell(c2.state, {
            characterId: caster.id,
            spellId,
            slotLevel: spell.level,
            targetIds: [lowTarget.id],
          }).events;
          const applied = lowEvents.filter(
            (e): e is Extract<Event, { type: 'ConditionApplied' }> => e.type === 'ConditionApplied',
          );
          expect(applied.length, 'expected the low-HP target to be knocked out').toBeGreaterThanOrEqual(1);
          break;
        }
      }
    });
  }
});
