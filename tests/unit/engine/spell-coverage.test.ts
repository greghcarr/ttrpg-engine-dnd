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
import type { CasterChoice } from '../../../src/engine/plan/cast-spell.js';

type Expectation =
  | { kind: 'attack'; casterChoice?: CasterChoice }
  | { kind: 'save'; casterChoice?: CasterChoice }
  | { kind: 'heal' }
  | { kind: 'auto-hit'; minDarts: number }
  | { kind: 'buff'; conditionId: string; casterChoice?: CasterChoice }
  | { kind: 'remove-condition'; seedConditionId: string }
  | { kind: 'hp-pool-knockout' }
  | { kind: 'summon' }
  | { kind: 'temp-hp' }
  | { kind: 'trap'; casterChoice?: CasterChoice }
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
  'blade-ward': { kind: 'buff', conditionId: 'blade-warded-active' },
  'dancing-lights': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'druidcraft': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'friends': { kind: 'skip', reason: 'social buff cantrip, no mechanical effect' },
  'mending': { kind: 'skip', reason: 'utility repair, no mechanical effect' },
  'message': { kind: 'skip', reason: 'utility communication, no mechanical effect' },
  'minor-illusion': { kind: 'skip', reason: 'illusion cantrip, no mechanical effect' },
  'mold-earth': { kind: 'skip', reason: 'utility cantrip, no mechanical effect' },
  'resistance': { kind: 'buff', conditionId: 'resisted' },
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
  'absorb-elements': { kind: 'skip', reason: 'has dedicated engine.plan.absorbElements (reaction to a DamageApplied event of the matching type, not planCastSpell)' },
  'alarm': { kind: 'skip', reason: 'ritual alarm zone; no combat-event side' },
  'animal-friendship': { kind: 'skip', reason: 'charmed-beast-only variant; condition target restriction not modeled' },
  'chromatic-orb': { kind: 'attack', casterChoice: { kind: 'damageType', value: 'fire' } },
  'command': { kind: 'save', casterChoice: { kind: 'variant', value: 'halt' } },
  'compelled-duel': { kind: 'skip', reason: 'movement-aversion rider on charm; rider primitive not modeled' },
  'comprehend-languages': { kind: 'skip', reason: 'utility ritual, narrative only' },
  'create-or-destroy-water': { kind: 'skip', reason: 'utility, narrative only' },
  'detect-evil-and-good': { kind: 'skip', reason: 'detection ritual, narrative only' },
  'detect-poison-and-disease': { kind: 'skip', reason: 'detection ritual, narrative only' },
  'disguise-self': { kind: 'skip', reason: 'illusion utility, narrative only' },
  'divine-favor': { kind: 'buff', conditionId: 'divine-favor-active' },
  'ensnaring-strike': { kind: 'skip', reason: 'ranger smite with on-hit save rider; on-hit trigger system not modeled' },
  'entangle': { kind: 'skip', reason: 'aura-damage mechanic (STR save → restrained, no damage); fires via engine.plan.tickAura on enter / per-turn, not on cast. RAW difficult-terrain side-effect isn\'t expressed.' },
  'expeditious-retreat': { kind: 'skip', reason: 'bonus-action speed buff, narrative only' },
  'false-life': { kind: 'temp-hp' },
  'feather-fall': { kind: 'buff', conditionId: 'feather-falling-active' },
  'find-familiar': { kind: 'summon' },
  'fog-cloud': { kind: 'skip', reason: 'area obscurement, narrative only' },
  'goodberry': { kind: 'skip', reason: 'creates consumable items; item-creation mechanic not wired for spells' },
  'grease': { kind: 'skip', reason: 'aura-damage mechanic (DEX save → prone, no damage); fires via engine.plan.tickAura on enter, not on cast. RAW difficult-terrain side-effect isn\'t expressed.' },
  'hail-of-thorns': { kind: 'skip', reason: 'ranger smite with on-hit AoE rider; on-hit trigger system not modeled' },
  'heroism': { kind: 'buff', conditionId: 'heroic-active' },
  'hex': { kind: 'buff', conditionId: 'hexed-active' },
  'hunters-mark': { kind: 'skip', reason: 'has dedicated planHuntersMark (concentration mark, not planCastSpell)' },
  'jump': { kind: 'skip', reason: 'utility movement, narrative only' },
  'longstrider': { kind: 'buff', conditionId: 'longstrider-active' },
  'protection-from-evil-and-good': { kind: 'buff', conditionId: 'protection-from-evil-and-good-active' },
  'purify-food-and-drink': { kind: 'skip', reason: 'utility ritual, narrative only' },
  'sanctuary': { kind: 'buff', conditionId: 'sanctuary-active' },
  'searing-smite': { kind: 'buff', conditionId: 'searing-smite-active' },
  'shield-of-faith': { kind: 'buff', conditionId: 'shield-of-faith-active' },
  'silent-image': { kind: 'skip', reason: 'illusion concentration, narrative only' },
  'speak-with-animals': { kind: 'skip', reason: 'ritual, narrative only' },
  'thunderous-smite': { kind: 'buff', conditionId: 'thunderous-smite-active' },
  'unseen-servant': { kind: 'summon' },
  'wrathful-smite': { kind: 'buff', conditionId: 'wrathful-smite-active' },
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
  'barkskin': { kind: 'buff', conditionId: 'barkskin-active' },
  'blur': { kind: 'buff', conditionId: 'blurred-active' },
  'branding-smite': { kind: 'buff', conditionId: 'branding-smite-active' },
  'calm-emotions': { kind: 'save', casterChoice: { kind: 'variant', value: 'suppress' } },
  'cloud-of-daggers': { kind: 'skip', reason: 'aura-damage mechanic (no save, 4d4 slashing auto-damage); fires via engine.plan.tickAura per-turn / on-enter, not on cast' },
  'continual-flame': { kind: 'skip', reason: 'utility (creates flame); no combat-event side' },
  'cordon-of-arrows': { kind: 'trap' },
  'darkness': { kind: 'skip', reason: 'area obscurement, concentration; area mechanic + visibility-condition not modeled' },
  'darkvision': { kind: 'buff', conditionId: 'darkvision-active' },
  'detect-thoughts': { kind: 'skip', reason: 'divination utility; detection mechanic not modeled' },
  'dragons-breath': { kind: 'skip', reason: 'grants ally a breath-weapon reaction-style; on-action rider not modeled' },
  'dust-devil': { kind: 'skip', reason: 'summoned mobile area; area + summon mechanics not modeled' },
  'earthbind': { kind: 'save' },
  'enhance-ability': { kind: 'buff', conditionId: 'bears-endurance-active', casterChoice: { kind: 'variant', value: 'bears-endurance' } },
  'enlarge-reduce': { kind: 'buff', conditionId: 'enlarged-active', casterChoice: { kind: 'variant', value: 'enlarge' } },
  'enthrall': { kind: 'skip', reason: 'WIS save against perception disadvantage on caster; perception-buff condition not modeled' },
  'find-steed': { kind: 'summon' },
  'find-traps': { kind: 'skip', reason: 'divination utility; detection mechanic not modeled' },
  'flaming-sphere': { kind: 'skip', reason: 'aura-damage mechanic (DEX save 2d6 fire, half on success); fires via engine.plan.tickAura at end of caster turn against adjacent creatures. RAW mobile-sphere movement is consumer-side.' },
  'gentle-repose': { kind: 'skip', reason: 'utility ritual (preserves corpse), narrative only' },
  'gust-of-wind': { kind: 'save' },
  'knock': { kind: 'skip', reason: 'utility (opens lock), narrative only' },
  'levitate': { kind: 'skip', reason: 'lifts a target; flight / hover condition not modeled' },
  'locate-animals-or-plants': { kind: 'skip', reason: 'divination utility, narrative only' },
  'locate-object': { kind: 'skip', reason: 'divination utility, narrative only' },
  'magic-mouth': { kind: 'skip', reason: 'utility (programmed illusion), narrative only' },
  'magic-weapon': { kind: 'skip', reason: 'has dedicated engine.plan.magicWeapon (needs a specific weaponInstanceId target, not planCastSpell)' },
  'mirror-image': { kind: 'skip', reason: 'creates three duplicates that intercept attacks; duplicate-pool condition not modeled' },
  'nystuls-magic-aura': { kind: 'skip', reason: 'utility (anti-detect), narrative only' },
  'pass-without-trace': { kind: 'buff', conditionId: 'pass-without-trace-active' },
  'phantasmal-force': { kind: 'skip', reason: 'INT save illusion + recurring psychic damage; recurring-rider primitive not modeled' },
  'ray-of-enfeeblement': { kind: 'skip', reason: 'ranged attack with on-hit weapon-damage halving; on-hit rider primitive not modeled' },
  'rope-trick': { kind: 'skip', reason: 'utility (extradimensional space), narrative only' },
  'see-invisibility': { kind: 'skip', reason: 'utility (see invisible), narrative only' },
  'silence': { kind: 'skip', reason: 'area zone of silence; area-effect mechanic not modeled' },
  'skywrite': { kind: 'skip', reason: 'utility (writes in sky), narrative only' },
  'spider-climb': { kind: 'buff', conditionId: 'spider-climbing-active' },
  'spike-growth': { kind: 'skip', reason: 'movement-damage mechanic (2d4 piercing per 5 ft moved through zone, no save); fires via engine.plan.tickMovementDamage, not on cast. RAW difficult-terrain side-effect isn\'t expressed.' },
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
  'bestow-curse': { kind: 'save', casterChoice: { kind: 'variant', value: 'ability-disadvantage' } },
  'blinding-smite': { kind: 'skip', reason: 'paladin smite with on-hit save → blinded rider; on-hit trigger system not modeled' },
  'clairvoyance': { kind: 'skip', reason: 'remote sensor utility; scrying mechanic not modeled' },
  'conjure-animals': { kind: 'summon' },
  'create-food-and-water': { kind: 'skip', reason: 'utility (food creation), narrative only' },
  'crusaders-mantle': { kind: 'buff', conditionId: 'crusaders-mantle-active' },
  'daylight': { kind: 'skip', reason: 'utility (creates bright light), narrative only' },
  'elemental-weapon': { kind: 'skip', reason: 'has dedicated engine.plan.elementalWeapon (needs a specific weaponInstanceId + damageType, not planCastSpell)' },
  'feign-death': { kind: 'skip', reason: 'utility (death simulation), narrative only' },
  'fly': { kind: 'buff', conditionId: 'flying-active' },
  'gaseous-form': { kind: 'skip', reason: 'transformation utility; transformation handler not modeled for spells' },
  'glyph-of-warding': { kind: 'trap', casterChoice: { kind: 'damageType', value: 'fire' } },
  'haste': { kind: 'buff', conditionId: 'hasted-active' },
  'hunger-of-hadar': { kind: 'skip', reason: 'multi-component aura-damage (cold-on-enter no save + acid-on-turn-end with DEX save); fires via engine.plan.tickAura with per-call intent.trigger, not on cast' },
  'leomunds-tiny-hut': { kind: 'skip', reason: 'persistent shelter dome; area-effect mechanic not modeled' },
  'lightning-arrow': { kind: 'skip', reason: 'ranger on-hit rider that converts arrow damage; on-hit trigger system not modeled' },
  'magic-circle': { kind: 'buff', conditionId: 'magic-circle-active' },
  'major-image': { kind: 'skip', reason: 'illusion with INT save on interaction; illusion + recurring-rider primitives not modeled' },
  'meld-into-stone': { kind: 'skip', reason: 'utility (merge with stone), narrative only' },
  'nondetection': { kind: 'skip', reason: 'utility (anti-detect buff), narrative only' },
  'phantom-steed': { kind: 'summon' },
  'plant-growth': { kind: 'skip', reason: 'area difficult terrain + agricultural utility; area-effect mechanic not modeled' },
  'protection-from-energy': { kind: 'buff', conditionId: 'protection-fire-active', casterChoice: { kind: 'variant', value: 'fire' } },
  'remove-curse': { kind: 'skip', reason: 'removes the cursed condition; cursed condition itself not yet modeled' },
  'revivify': { kind: 'skip', reason: 'has dedicated engine.plan.resurrect (the resurrection planner handles revivify / raise-dead / reincarnate / resurrection / true-resurrection — not planCastSpell)' },
  'sending': { kind: 'skip', reason: 'utility (telepathic message), narrative only' },
  'slow': { kind: 'skip', reason: 'area + multi-effect WIS save (speed half + no reactions + delayed action); composite area condition not modeled' },
  'speak-with-dead': { kind: 'skip', reason: 'utility (question corpse), narrative only' },
  'speak-with-plants': { kind: 'skip', reason: 'utility (talk to plants), narrative only' },
  'spirit-shroud': { kind: 'buff', conditionId: 'spirit-shroud-cold-active', casterChoice: { kind: 'variant', value: 'cold' } },
  'stinking-cloud': { kind: 'skip', reason: 'aura-damage mechanic (condition-only via conditionOnFail: poisoned); fires via engine.plan.tickAura per-turn, not on cast' },
  'summon-fey': { kind: 'summon' },
  'summon-lesser-demons': { kind: 'summon' },
  'summon-shadowspawn': { kind: 'summon' },
  'summon-undead': { kind: 'summon' },
  'thunder-step': { kind: 'skip', reason: 'teleport + area thunder damage; multi-mechanic spell with dedicated planner pattern not yet implemented' },
  'tongues': { kind: 'skip', reason: 'utility (language understanding), narrative only' },
  'water-breathing': { kind: 'skip', reason: 'utility (breathe underwater), narrative only' },
  'water-walk': { kind: 'skip', reason: 'utility (walk on water), narrative only' },
  'wind-wall': { kind: 'skip', reason: 'area STR save with object deflection; area-effect mechanic not modeled' },
  // PHB 2024 L4 spells with wired mechanics
  'blight': { kind: 'save' },
  'charm-monster': { kind: 'save' },
  'conjure-minor-elementals': { kind: 'summon' },
  'conjure-woodland-beings': { kind: 'summon' },
  'freedom-of-movement': { kind: 'buff', conditionId: 'freedom-of-movement-active' },
  'greater-invisibility': { kind: 'buff', conditionId: 'invisible' },
  'ice-storm': { kind: 'save' },
  'phantasmal-killer': { kind: 'save' },
  'summon-aberration': { kind: 'summon' },
  'summon-construct': { kind: 'summon' },
  'summon-elemental': { kind: 'summon' },
  'summon-greater-demon': { kind: 'summon' },
  // PHB 2024 L4 spells shipped schema-only; see docs/starter-pack-gaps.md.
  'arcane-eye': { kind: 'skip', reason: 'sensor (controllable remote viewing eye); sensor / scrying primitive not modeled' },
  'aura-of-life': { kind: 'skip', reason: 'paladin aura that holds allies above half-HP-floor + revives at 0 HP; sub-floor health mechanic not modeled' },
  'aura-of-purity': { kind: 'skip', reason: 'paladin aura granting resistance to poison + disease/condition immunities; multi-effect aura ally projection not wired' },
  'banishment': { kind: 'skip', reason: 'CHA save banishes target to another plane; cross-plane travel + return-on-concentration-drop not modeled' },
  'black-tentacles': { kind: 'skip', reason: 'aura-damage mechanic (DEX save 3d6 bludgeoning + conditionOnFail: restrained); fires via engine.plan.tickAura on enter / per-turn, not on cast' },
  'compulsion': { kind: 'skip', reason: 'forced movement on WIS save with recurring re-save; recurring-save area mechanic not modeled' },
  'confusion': { kind: 'save' },
  'control-water': { kind: 'skip', reason: 'water-shape utility; terrain primitive not modeled' },
  'death-ward': { kind: 'buff', conditionId: 'death-ward-active' },
  'dimension-door': { kind: 'skip', reason: 'short-range teleport (with optional passenger); has a teleport-pattern similar to Misty Step but no dedicated planner yet' },
  'divination': { kind: 'skip', reason: 'cleric ritual divination; DM-resolution primitive not modeled' },
  'dominate-beast': { kind: 'skip', reason: 'WIS save → controlled-mind; domination semantics distinct from Charmed not modeled' },
  'elemental-bane': { kind: 'skip', reason: 'CON save imposes vulnerability to chosen damage type + suppresses resistance; caster-chosen damage type + on-attack-output modifier not modeled' },
  'fabricate': { kind: 'skip', reason: '10-minute creation ritual; crafting / material-transformation primitive not modeled' },
  'faithful-hound': { kind: 'skip', reason: 'placed sentry that barks + attacks on intruders; alarm + delayed attack pattern not modeled' },
  'fire-shield': { kind: 'buff', conditionId: 'fire-shield-warm-active', casterChoice: { kind: 'variant', value: 'warm' } },
  'giant-insect': { kind: 'skip', reason: 'transforms ordinary insects into giant variants; transformation handler for non-self targets not modeled' },
  'guardian-of-faith': { kind: 'skip', reason: 'summoned guardian that radiates damage in a 10ft area; area-effect mechanic + delayed expiration not modeled' },
  'hallucinatory-terrain': { kind: 'skip', reason: 'large-area illusion; terrain primitive not modeled' },
  'locate-creature': { kind: 'skip', reason: 'divination locator; sensor / scrying primitive not modeled' },
  'private-sanctum': { kind: 'skip', reason: 'large-area ward against detection/sound/teleport; area-warding primitive not modeled' },
  'resilient-sphere': { kind: 'skip', reason: 'forced cage around target on DEX save; multi-target movement-restriction primitive not modeled' },
  'secret-chest': { kind: 'skip', reason: 'extradimensional storage utility; ethereal-stash primitive not modeled' },
  'stone-shape': { kind: 'skip', reason: 'utility shaping of stone; terrain primitive not modeled' },
  'stoneskin': { kind: 'buff', conditionId: 'stoneskin-active' },
  'wall-of-fire': { kind: 'skip', reason: 'aura-damage mechanic (DEX save 5d8 fire, half on success); fires via engine.plan.tickAura per-turn, not on cast. RAW side-selectable damage isn\'t expressed.' },
  'watery-sphere': { kind: 'skip', reason: 'STR save sphere prison + movement; multi-target movement-restriction primitive not modeled' },
  // PHB 2024 L5 spells with wired mechanics
  'cloudkill': { kind: 'save' },
  'cone-of-cold': { kind: 'save' },
  'conjure-elemental': { kind: 'summon' },
  'contagion': { kind: 'save' },
  'dominate-person': { kind: 'save' },
  'greater-restoration': { kind: 'remove-condition', seedConditionId: 'paralyzed' },
  'hold-monster': { kind: 'save' },
  'holy-weapon': { kind: 'buff', conditionId: 'holy-weapon-active' },
  'insect-plague': { kind: 'save' },
  'mass-cure-wounds': { kind: 'heal' },
  'summon-celestial': { kind: 'summon' },
  'summon-draconic-spirit': { kind: 'summon' },
  'synaptic-static': { kind: 'save' },
  // PHB 2024 L5 spells shipped schema-only; see docs/starter-pack-gaps.md.
  'animate-objects': { kind: 'skip', reason: 'controllable summoned objects; treats inanimate matter as creature, not modeled' },
  'awaken': { kind: 'skip', reason: '8-hour ritual transformation; sapience-granting primitive not modeled' },
  'bigbys-hand': { kind: 'skip', reason: 'controllable spell-construct with action menu; differs from passive summon shape' },
  'circle-of-power': { kind: 'skip', reason: 'aura granting advantage on saves vs magic + half-damage on success; conditional aura sub-effect not modeled' },
  'commune': { kind: 'skip', reason: 'cleric ritual divination; DM-resolution primitive not modeled' },
  'commune-with-nature': { kind: 'skip', reason: 'ritual divination utility, narrative only' },
  'contact-other-plane': { kind: 'skip', reason: 'ritual divination with cumulative INT-save madness risk; DM-resolution primitive not modeled' },
  'creation': { kind: 'skip', reason: 'utility creation of vegetable / mineral matter; creation primitive not modeled' },
  'destructive-wave': { kind: 'skip', reason: 'AoE CON save with multi-type damage (thunder + radiant or necrotic) + condition on fail; multi-damage AoE primitive not modeled' },
  'dispel-evil-and-good': { kind: 'skip', reason: 'aura + on-touch dispel + reaction-style banish; multi-mode spell not modeled' },
  'dream': { kind: 'skip', reason: 'narrative communication / nightmare; DM-resolution primitive not modeled' },
  'far-step': { kind: 'skip', reason: 'recurring 60 ft teleport per bonus action; reused-cast pattern not modeled' },
  'flame-strike': { kind: 'skip', reason: 'AoE DEX save with multi-type damage (fire + radiant); multi-damage AoE primitive not modeled' },
  'geas': { kind: 'skip', reason: '30-day forced compulsion + recurring psychic damage on disobedience; long-duration compulsion primitive not modeled' },
  'hallow': { kind: 'skip', reason: '24-hour ritual area ward with caster-chosen sub-effect; area-warding + choice primitive not modeled' },
  'legend-lore': { kind: 'skip', reason: 'ritual divination; DM-resolution primitive not modeled' },
  'mislead': { kind: 'skip', reason: 'illusion duplicate with sensory swap; multi-image illusion primitive not modeled' },
  'modify-memory': { kind: 'skip', reason: 'WIS save with narrative memory edit; DM-resolution + narrative primitive not modeled' },
  'passwall': { kind: 'skip', reason: 'creates a passage through solid surfaces; terrain primitive not modeled' },
  'planar-binding': { kind: 'skip', reason: 'cross-plane forced summon; planar travel primitive not modeled' },
  'raise-dead': { kind: 'skip', reason: 'has dedicated engine.plan.resurrect (not planCastSpell)' },
  'rarys-telepathic-bond': { kind: 'skip', reason: 'utility telepathic link, narrative only' },
  'reincarnate': { kind: 'skip', reason: 'has dedicated engine.plan.resurrect with newSpeciesId intent param (not planCastSpell). The random-species-table roll is consumer-side; the engine accepts the chosen species id.' },
  'scrying': { kind: 'skip', reason: 'remote sensor with WIS save resistance; sensor / scrying primitive not modeled' },
  'seeming': { kind: 'skip', reason: 'mass illusion swap; illusion primitive not modeled' },
  'steel-wind-strike': { kind: 'skip', reason: 'multi-target melee with teleport; multi-target weapon planner not modeled' },
  'swift-quiver': { kind: 'skip', reason: 'bonus-action extra ammo-attacks; on-action attack rider primitive not modeled' },
  'telekinesis': { kind: 'skip', reason: 'forced creature/object movement; contested check + movement primitive not modeled' },
  'teleportation-circle': { kind: 'skip', reason: 'ritual long-range teleport; teleport-network primitive not modeled' },
  'tree-stride': { kind: 'skip', reason: 'tree-to-tree teleport per action; tree-anchored teleport primitive not modeled' },
  'wall-of-force': { kind: 'skip', reason: 'impenetrable barrier (no damage, no save); area-wall primitive not modeled' },
  'wall-of-light': { kind: 'skip', reason: 'damaging barrier + sun-burst blind; area-wall + on-cross damage primitive not modeled' },
  'wall-of-stone': { kind: 'skip', reason: 'terrain creation (panels of stone); terrain primitive not modeled' },
  // PHB 2024 L6 spells with wired mechanics
  'chain-lightning': { kind: 'save' },
  'circle-of-death': { kind: 'save' },
  'disintegrate': { kind: 'save' },
  'eyebite': { kind: 'save' },
  'flesh-to-stone': { kind: 'save' },
  'harm': { kind: 'save' },
  'heal': { kind: 'heal' },
  'mass-suggestion': { kind: 'save' },
  'summon-fiend': { kind: 'summon' },
  'sunbeam': { kind: 'save' },
  // PHB 2024 L6 spells shipped schema-only; see docs/starter-pack-gaps.md.
  'arcane-gate': { kind: 'skip', reason: 'two-portal teleport between linked points; portal primitive not modeled' },
  'blade-barrier': { kind: 'skip', reason: 'aura-damage mechanic (DEX save 6d10 slashing); fires via engine.plan.tickAura per-turn, not on cast' },
  'conjure-fey': { kind: 'skip', reason: 'CR-6+ fey summon with subclass-flavored statblock; advanced summon primitive not modeled' },
  'contingency': { kind: 'skip', reason: 'pre-stored conditional spell; conditional-cast primitive not modeled' },
  'create-undead': { kind: 'skip', reason: 'creates ghoul / ghast servitors; undead-creation primitive not modeled' },
  'drawmijs-instant-summons': { kind: 'skip', reason: 'utility (recall enchanted item); ritual storage primitive not modeled' },
  'find-the-path': { kind: 'skip', reason: 'concentration locator; sensor / scrying primitive not modeled' },
  'forbiddance': { kind: 'skip', reason: 'creature-type-keyed area ward; area-warding primitive not modeled' },
  'globe-of-invulnerability': { kind: 'skip', reason: '10-ft globe blocking 5th-or-lower-level spells; spell-filtering primitive not modeled' },
  'guards-and-wards': { kind: 'skip', reason: 'multi-effect building ward (illusion + lock + obscure + restrain); composite ward primitive not modeled' },
  'heroes-feast': { kind: 'skip', reason: 'long-rest preparation that grants temp-HP, save-advantage, immunity to poison/frightened for 24h; multi-effect ritual buff not modeled' },
  'investiture-of-flame': { kind: 'skip', reason: 'self-buff transformation with elemental damage aura + immunity; multi-effect transformation primitive not modeled' },
  'investiture-of-ice': { kind: 'skip', reason: 'self-buff transformation with elemental damage aura + immunity; multi-effect transformation primitive not modeled' },
  'investiture-of-stone': { kind: 'skip', reason: 'self-buff transformation with resistance + earth burrow; multi-effect transformation primitive not modeled' },
  'investiture-of-wind': { kind: 'skip', reason: 'self-buff transformation with fly + ranged debuff; multi-effect transformation primitive not modeled' },
  'magic-jar': { kind: 'skip', reason: 'soul transfer between caster and target; possession primitive not modeled' },
  'move-earth': { kind: 'skip', reason: 'terrain reshaping; terrain primitive not modeled' },
  'ottos-irresistible-dance': { kind: 'skip', reason: 'target dances and has disadvantage on rolls; dancing condition + recurring save not modeled' },
  'planar-ally': { kind: 'skip', reason: 'requests aid from an other-planar entity; DM-resolution + cross-plane summon not modeled' },
  'programmed-illusion': { kind: 'skip', reason: 'long-duration triggered illusion; illusion + trigger primitive not modeled' },
  'soul-cage': { kind: 'skip', reason: 'reaction-cast captures a dying soul for power; on-death trigger + utility hooks not modeled' },
  'tashas-otherworldly-guise': { kind: 'skip', reason: 'self transformation with fly + damage rider + AC override; multi-effect transformation primitive not modeled' },
  'tensers-transformation': { kind: 'skip', reason: 'self-buff transformation granting weapon proficiencies + temp HP + extra damage; multi-effect transformation primitive not modeled' },
  'true-seeing': { kind: 'skip', reason: 'truesight 120 ft + sees illusions / ethereal / shapechangers; multi-effect detection primitive not modeled' },
  'wall-of-ice': { kind: 'skip', reason: 'aura-damage mechanic (DEX save 10d6 cold, half on success); fires via engine.plan.tickAura per-turn, not on cast. RAW persistent terrain block-passage isn\'t expressed.' },
  'wall-of-thorns': { kind: 'skip', reason: 'aura-damage mechanic (DEX save 7d8 piercing, half on success); fires via engine.plan.tickAura per-turn, not on cast. RAW difficult-terrain side-effect isn\'t expressed.' },
  'wind-walk': { kind: 'skip', reason: 'mass cloud-travel transformation; multi-target transformation primitive not modeled' },
  'word-of-recall': { kind: 'skip', reason: 'instant teleport to a designated sanctuary; teleport-network primitive not modeled' },
  // PHB 2024 L7 spells with wired mechanics
  'conjure-celestial': { kind: 'summon' },
  'delayed-blast-fireball': { kind: 'save' },
  'finger-of-death': { kind: 'save' },
  'fire-storm': { kind: 'save' },
  'regenerate': { kind: 'heal' },
  // PHB 2024 L7 spells shipped schema-only; see docs/starter-pack-gaps.md.
  'crown-of-stars': { kind: 'skip', reason: 'orbiting motes of light that fire on bonus action; on-action attack rider not modeled' },
  'divine-word': { kind: 'skip', reason: 'tiered effect by HP threshold (stunned / blinded / deafened / killed); HP-threshold effect not modeled' },
  'dream-of-the-blue-veil': { kind: 'skip', reason: 'cross-world travel; planar travel primitive not modeled' },
  'etherealness': { kind: 'skip', reason: 'enter the Ethereal Plane; cross-plane travel primitive not modeled' },
  'forcecage': { kind: 'skip', reason: '20-ft cage of force; multi-target movement-restriction + saves-vs-teleport not modeled' },
  'mirage-arcane': { kind: 'skip', reason: 'large-area illusion terrain; terrain + illusion primitive not modeled' },
  'mordenkainens-magnificent-mansion': { kind: 'skip', reason: 'extradimensional dwelling utility; extradimensional space primitive not modeled' },
  'mordenkainens-sword': { kind: 'skip', reason: 'controllable floating force-sword with bonus-action attacks; on-action attack primitive not modeled' },
  'plane-shift': { kind: 'skip', reason: 'planar travel; cross-plane travel primitive not modeled' },
  'power-word-pain': { kind: 'skip', reason: 'tiered effect by HP threshold (intense pain); HP-threshold effect not modeled' },
  'prismatic-spray': { kind: 'skip', reason: 'random-damage-type cone with 8 effect rolls; multi-damage AoE + RNG-table primitive not modeled' },
  'project-image': { kind: 'skip', reason: 'long-range illusion duplicate; illusion + sensor primitive not modeled' },
  'resurrection': { kind: 'skip', reason: 'has dedicated engine.plan.resurrect (not planCastSpell)' },
  'reverse-gravity': { kind: 'skip', reason: 'inverts gravity in 50-ft cylinder; physics primitive not modeled' },
  'sequester': { kind: 'skip', reason: 'time-stop / invisibility on target until trigger; trigger-resume primitive not modeled' },
  'simulacrum': { kind: 'skip', reason: 'has dedicated engine.plan.simulacrum (not planCastSpell)' },
  'symbol': { kind: 'skip', reason: 'placed glyph with caster-chosen trigger and effect; trap mechanic + choice not modeled' },
  'teleport': { kind: 'skip', reason: 'long-range teleport with familiarity table; teleport-network primitive not modeled' },
  'whirlwind': { kind: 'skip', reason: 'cylinder of wind with DEX save + restrained + lift; area-effect with multi-stage rider not modeled' },
  // PHB 2024 L8 spells with wired mechanics
  'dominate-monster': { kind: 'save' },
  'feeblemind': { kind: 'save' },
  'incendiary-cloud': { kind: 'save' },
  'maddening-darkness': { kind: 'save' },
  'sunburst': { kind: 'save' },
  'tsunami': { kind: 'save' },
  // PHB 2024 L8 spells shipped schema-only; see docs/starter-pack-gaps.md.
  'animal-shapes': { kind: 'skip', reason: 'mass beast transformation; multi-target transformation primitive not modeled' },
  'antimagic-field': { kind: 'skip', reason: 'spherical suppression of magic; magic-suppression primitive not modeled' },
  'antipathy-sympathy': { kind: 'skip', reason: 'long-term Charm or Frightened on creature-type proximity; type-conditional buff not modeled' },
  'clone': { kind: 'skip', reason: 'soul-transferring backup; resurrection-on-death primitive not modeled' },
  'control-weather': { kind: 'skip', reason: 'large-scale weather shaping; environment primitive not modeled' },
  'demiplane': { kind: 'skip', reason: 'extradimensional room; extradimensional space primitive not modeled' },
  'earthquake': { kind: 'skip', reason: 'large-area save + terrain destruction + collapses; area-effect with multi-stage rider not modeled' },
  'glibness': { kind: 'skip', reason: 'utility (auto-success on CHA checks + lie detection immunity); narrative buff' },
  'holy-aura': { kind: 'buff', conditionId: 'holy-aura-active' },
  'maze': { kind: 'skip', reason: 'banishes a target to a demiplane labyrinth; cross-plane single-target primitive not modeled' },
  'mind-blank': { kind: 'buff', conditionId: 'mind-blanked-active' },
  'power-word-stun': { kind: 'skip', reason: 'tiered HP-threshold stun (≤150 HP); HP-threshold effect not modeled' },
  'telepathy': { kind: 'skip', reason: 'long-range unlimited-distance bond utility; narrative only' },
  // PHB 2024 L9 spells with wired mechanics
  'mass-heal': { kind: 'heal' },
  'psychic-scream': { kind: 'save' },
  'weird': { kind: 'save' },
  // PHB 2024 L9 spells shipped schema-only; see docs/starter-pack-gaps.md.
  'astral-projection': { kind: 'skip', reason: 'projects party to the Astral Plane; cross-plane travel primitive not modeled' },
  'foresight': { kind: 'buff', conditionId: 'foresight-active' },
  'gate': { kind: 'skip', reason: 'creates portal to another plane and can call a named being; cross-plane summon primitive not modeled' },
  'imprisonment': { kind: 'skip', reason: 'six variants of long-term imprisonment; multi-mode utility primitive not modeled' },
  'invulnerability': { kind: 'buff', conditionId: 'invulnerable-active' },
  'mass-polymorph': { kind: 'skip', reason: 'mass transformation; multi-target transformation primitive not modeled' },
  'meteor-swarm': { kind: 'skip', reason: 'four 40-ft spheres dealing 20d6 fire + 20d6 bludgeoning; multi-AoE multi-damage primitive not modeled' },
  'power-word-heal': { kind: 'skip', reason: 'full heal + remove charmed/frightened/paralyzed/stunned; healing surge + remove-multiple-conditions composite' },
  'power-word-kill': { kind: 'skip', reason: 'tiered HP-threshold instant death (≤100 HP); HP-threshold effect not modeled' },
  'prismatic-wall': { kind: 'skip', reason: 'multi-layer wall with seven distinct damage / save effects; area-wall + multi-damage primitive not modeled' },
  'ravenous-void': { kind: 'skip', reason: 'pulls creatures + objects toward a point + force damage; forced movement + AoE primitive not modeled' },
  'shapechange': { kind: 'skip', reason: 'has dedicated transformation handler patterns (Wild Shape, Polymorph); a Shapechange-specific planner is the obvious follow-up' },
  'storm-of-vengeance': { kind: 'skip', reason: 'multi-round growing storm with stage-keyed damage; recurring multi-stage area-effect primitive not modeled' },
  'time-ravage': { kind: 'skip', reason: 'massive necrotic + aging on failed CON save; multi-effect single-target primitive not modeled' },
  'time-stop': { kind: 'skip', reason: 'caster gains 1d4 + 1 extra turns; turn-economy primitive not modeled' },
  'true-polymorph': { kind: 'skip', reason: 'has dedicated engine.plan.polymorph (not planCastSpell)' },
  'true-resurrection': { kind: 'skip', reason: 'has dedicated engine.plan.resurrect (not planCastSpell)' },
  'wish': { kind: 'skip', reason: 'has dedicated engine.plan.wish (not planCastSpell)' },
};

const buildWizard = (preparedSpells: string[]): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Spell Tester',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [{ classId: 'wizard', level: 19, hitDiceRemaining: 19 }],
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
    classes: [{ classId: 'cleric', level: 19, hitDiceRemaining: 19 }],
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

      const casterChoice =
        (expectation.kind === 'attack'
          || expectation.kind === 'buff'
          || expectation.kind === 'save'
          || expectation.kind === 'trap')
          ? expectation.casterChoice
          : undefined;
      const events = engine.plan.castSpell(campaign.state, {
        characterId: caster.id,
        spellId,
        slotLevel: spell.level,
        targetIds,
        ...(casterChoice !== undefined ? { casterChoice } : {}),
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
        case 'temp-hp': {
          expect(types, 'expected TempHPGranted').toContain('TempHPGranted');
          break;
        }
        case 'trap': {
          expect(types, 'expected TrapArmed').toContain('TrapArmed');
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
