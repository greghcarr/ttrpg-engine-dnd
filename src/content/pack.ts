import { z } from 'zod';
import {
  BackgroundSchema,
  ClassSchema,
  ConditionSchema,
  FeatSchema,
  ItemDefinitionSchema,
  MonsterStatblockSchema,
  SpeciesSchema,
  SpellSchema,
  SubclassSchema,
  type Background,
  type Class,
  type Condition,
  type Feat,
  type ItemDefinition,
  type MonsterStatblock,
  type Species,
  type Spell,
  type Subclass,
} from '../schemas/content/index.js';

export const ContentPackSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  species: z.array(SpeciesSchema).default([]),
  backgrounds: z.array(BackgroundSchema).default([]),
  classes: z.array(ClassSchema).default([]),
  subclasses: z.array(SubclassSchema).default([]),
  feats: z.array(FeatSchema).default([]),
  spells: z.array(SpellSchema).default([]),
  items: z.array(ItemDefinitionSchema).default([]),
  monsters: z.array(MonsterStatblockSchema).default([]),
  conditions: z.array(ConditionSchema).default([]),
});
export type ContentPack = z.infer<typeof ContentPackSchema>;

export interface ResolvedContent {
  species: ReadonlyMap<string, Species>;
  backgrounds: ReadonlyMap<string, Background>;
  classes: ReadonlyMap<string, Class>;
  subclasses: ReadonlyMap<string, Subclass>;
  feats: ReadonlyMap<string, Feat>;
  spells: ReadonlyMap<string, Spell>;
  items: ReadonlyMap<string, ItemDefinition>;
  monsters: ReadonlyMap<string, MonsterStatblock>;
  conditions: ReadonlyMap<string, Condition>;
}

export const resolveContent = (packs: ReadonlyArray<ContentPack>): ResolvedContent => {
  const species = new Map<string, Species>();
  const backgrounds = new Map<string, Background>();
  const classes = new Map<string, Class>();
  const subclasses = new Map<string, Subclass>();
  const feats = new Map<string, Feat>();
  const spells = new Map<string, Spell>();
  const items = new Map<string, ItemDefinition>();
  const monsters = new Map<string, MonsterStatblock>();
  const conditions = new Map<string, Condition>();

  for (const pack of packs) {
    for (const e of pack.species) species.set(e.id, e);
    for (const e of pack.backgrounds) backgrounds.set(e.id, e);
    for (const e of pack.classes) classes.set(e.id, e);
    for (const e of pack.subclasses) subclasses.set(e.id, e);
    for (const e of pack.feats) feats.set(e.id, e);
    for (const e of pack.spells) spells.set(e.id, e);
    for (const e of pack.items) items.set(e.id, e);
    for (const e of pack.monsters) monsters.set(e.id, e);
    for (const e of pack.conditions) conditions.set(e.id, e);
  }

  return { species, backgrounds, classes, subclasses, feats, spells, items, monsters, conditions };
};

const formatZodPath = (path: ReadonlyArray<PropertyKey>): string =>
  path.length === 0 ? '<root>' : path.map((p) => String(p)).join('.');

export class ContentPackLoadError extends Error {
  public readonly issues: ReadonlyArray<{ path: string; message: string }>;
  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    const summary = issues.length === 1 ? '1 issue' : `${issues.length} issues`;
    const body = issues.map((i) => `  ${i.path}: ${i.message}`).join('\n');
    super(`Content pack failed validation (${summary}):\n${body}`);
    this.name = 'ContentPackLoadError';
    this.issues = issues;
  }
}

export const loadContentPack = (input: unknown): ContentPack => {
  const result = ContentPackSchema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => ({
    path: formatZodPath(i.path),
    message: i.message,
  }));
  throw new ContentPackLoadError(issues);
};
