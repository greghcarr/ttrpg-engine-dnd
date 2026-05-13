import type { Character } from '../schemas/runtime/character.js';
import type { ItemInstance } from '../schemas/runtime/item-instance.js';
import type { PendingChoice } from '../schemas/runtime/pending-choice.js';
import type { Effect } from '../schemas/effects.js';
import type { ResolvedContent } from '../content/pack.js';
import { EffectAccumulator, applyEffectToBuilder } from '../effects/builder.js';

const collectResolvedChoiceEffects = (
  character: Character,
  pendingChoices: Readonly<Record<string, PendingChoice>>,
): Effect[] => {
  const effects: Effect[] = [];
  for (const choiceId of character.pendingChoiceIds) {
    const choice = pendingChoices[choiceId];
    if (!choice?.resolution) continue;
    for (const optionId of choice.resolution.selectedOptionIds) {
      const option = choice.options.find((o) => o.id === optionId);
      if (option) effects.push(...option.effects);
    }
  }
  return effects;
};

// When the same feature id appears at multiple class levels (e.g. Sneak
// Attack at 1, 3, 5...), keep only the highest-level instance. Class
// features that scale with level (Sneak Attack dice, Channel Divinity
// uses, ki points, etc.) can then be expressed as one feature per scale
// step in the content pack, with the engine selecting the right one.
const dedupeFeaturesByLatestLevel = <T extends { id: string }>(
  perLevelFeatures: ReadonlyArray<ReadonlyArray<T>>,
): T[] => {
  const latest = new Map<string, T>();
  for (const features of perLevelFeatures) {
    for (const feature of features) latest.set(feature.id, feature);
  }
  return [...latest.values()];
};

const collectClassEffects = (character: Character, content: ResolvedContent): Effect[] => {
  const effects: Effect[] = [];
  for (const enrollment of character.classes) {
    const cls = content.classes.get(enrollment.classId);
    if (!cls) continue;
    const perLevel: ReadonlyArray<ReadonlyArray<{ id: string; effects: Effect[] }>>[] = [];
    const classLevels: { id: string; effects: Effect[] }[][] = [];
    for (let level = 1; level <= enrollment.level; level++) {
      const entry = cls.levelTable[String(level)];
      classLevels.push(entry ? [...entry.features] : []);
    }
    void perLevel;
    for (const feature of dedupeFeaturesByLatestLevel(classLevels)) {
      effects.push(...feature.effects);
    }
    if (enrollment.subclassId !== undefined) {
      const subclass = content.subclasses.get(enrollment.subclassId);
      if (subclass) {
        const subclassLevels: { id: string; effects: Effect[] }[][] = [];
        for (let level = 1; level <= enrollment.level; level++) {
          subclassLevels.push([...(subclass.levelGrants[String(level)] ?? [])]);
        }
        for (const feature of dedupeFeaturesByLatestLevel(subclassLevels)) {
          effects.push(...feature.effects);
        }
      }
    }
  }
  return effects;
};

const collectFeatEffects = (character: Character, content: ResolvedContent): Effect[] => {
  const effects: Effect[] = [];
  for (const featId of character.featsTaken) {
    const feat = content.feats.get(featId);
    if (feat) effects.push(...feat.effects);
  }
  return effects;
};

const collectItemEffects = (
  character: Character,
  itemInstances: Readonly<Record<string, ItemInstance>>,
  content: ResolvedContent,
): Effect[] => {
  const effects: Effect[] = [];
  for (const instanceId of character.equipped.attuned) {
    const inst = itemInstances[instanceId];
    if (!inst) continue;
    const def = content.items.get(inst.definitionId);
    if (def && def.itemKind === 'magic') {
      effects.push(...def.effects);
    }
  }
  return effects;
};

const collectConditionEffects = (character: Character, content: ResolvedContent): Effect[] => {
  const effects: Effect[] = [];
  for (const applied of character.appliedConditions) {
    const condition = content.conditions.get(applied.conditionId);
    if (condition) effects.push(...condition.effects);
  }
  return effects;
};

export interface BuildEffectStackInput {
  readonly character: Character;
  readonly content: ResolvedContent;
  readonly itemInstances: Readonly<Record<string, ItemInstance>>;
  readonly pendingChoices?: Readonly<Record<string, PendingChoice>>;
}

export const collectEffectsFromCharacter = (input: BuildEffectStackInput): Effect[] => {
  const { character, content, itemInstances, pendingChoices } = input;
  const effects: Effect[] = [];
  const species = content.species.get(character.speciesId);
  if (species) effects.push(...species.traits);
  const background = content.backgrounds.get(character.backgroundId);
  if (background) effects.push(...background.traits);
  effects.push(...collectClassEffects(character, content));
  effects.push(...collectFeatEffects(character, content));
  effects.push(...collectItemEffects(character, itemInstances, content));
  effects.push(...collectConditionEffects(character, content));
  if (pendingChoices) {
    effects.push(...collectResolvedChoiceEffects(character, pendingChoices));
  }
  return effects;
};

export const buildEffectStack = (input: BuildEffectStackInput): EffectAccumulator => {
  const { character, content, itemInstances, pendingChoices } = input;
  const acc = new EffectAccumulator();

  const species = content.species.get(character.speciesId);
  if (species) {
    for (const effect of species.traits) {
      applyEffectToBuilder(effect, acc, { source: `species:${species.id}` });
    }
  }

  const background = content.backgrounds.get(character.backgroundId);
  if (background) {
    for (const effect of background.traits) {
      applyEffectToBuilder(effect, acc, { source: `background:${background.id}` });
    }
  }

  for (const effect of collectClassEffects(character, content)) {
    applyEffectToBuilder(effect, acc, { source: 'class' });
  }
  for (const effect of collectFeatEffects(character, content)) {
    applyEffectToBuilder(effect, acc, { source: 'feat' });
  }
  for (const effect of collectItemEffects(character, itemInstances, content)) {
    applyEffectToBuilder(effect, acc, { source: 'item' });
  }
  for (const effect of collectConditionEffects(character, content)) {
    applyEffectToBuilder(effect, acc, { source: 'condition' });
  }
  if (pendingChoices) {
    for (const effect of collectResolvedChoiceEffects(character, pendingChoices)) {
      applyEffectToBuilder(effect, acc, { source: 'choice' });
    }
  }

  return acc;
};
