import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadContentPack, resolveContent, type ContentPack } from '../../src/content/pack.js';
import { CharacterSchema, type Character } from '../../src/schemas/runtime/character.js';
import {
  ItemInstanceSchema,
  type ItemInstance,
} from '../../src/schemas/runtime/item-instance.js';
import { newCharacterId, newItemInstanceId } from '../../src/ids.js';
import { ulid } from 'ulid';

const HERE = dirname(fileURLToPath(import.meta.url));

export const TEST_PACK: ContentPack = loadContentPack(
  JSON.parse(readFileSync(resolve(HERE, 'content/test-pack.json'), 'utf8')),
);

export const TEST_CONTENT = resolveContent([TEST_PACK]);

export interface BuildFighterOptions {
  readonly level?: number;
  readonly hpMax?: number;
  readonly hpCurrent?: number;
  readonly hpTemp?: number;
  readonly STR?: number;
  readonly DEX?: number;
  readonly CON?: number;
  readonly INT?: number;
  readonly WIS?: number;
  readonly CHA?: number;
  readonly armorInstanceId?: string;
  readonly shieldInstanceId?: string;
  readonly exhaustion?: number;
  readonly hitDiceRemaining?: number;
  readonly resources?: ReadonlyArray<{ resourceId: string; current: number; max: number }>;
}

const FIGHTER_DEFAULT_HP_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 12,
  2: 19,
  3: 26,
  4: 33,
  5: 40,
};

export const buildFighter = (opts: BuildFighterOptions = {}): Character => {
  const level = opts.level ?? 1;
  const hpMax = opts.hpMax ?? FIGHTER_DEFAULT_HP_BY_LEVEL[level] ?? 12;
  const character = CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Test Fighter',
    speciesId: 'human',
    backgroundId: 'soldier',
    classes: [
      {
        classId: 'fighter',
        level,
        hitDiceRemaining: opts.hitDiceRemaining ?? level,
      },
    ],
    resources: opts.resources ?? [],
    abilityScores: {
      STR: opts.STR ?? 16,
      DEX: opts.DEX ?? 14,
      CON: opts.CON ?? 14,
      INT: opts.INT ?? 10,
      WIS: opts.WIS ?? 10,
      CHA: opts.CHA ?? 10,
    },
    hp: {
      current: opts.hpCurrent ?? hpMax,
      max: hpMax,
      temp: opts.hpTemp ?? 0,
    },
    exhaustion: opts.exhaustion ?? 0,
    featsTaken: ['savage-attacker'],
    equipped: {
      ...(opts.armorInstanceId !== undefined ? { armor: opts.armorInstanceId } : {}),
      ...(opts.shieldInstanceId !== undefined ? { shield: opts.shieldInstanceId } : {}),
      attuned: [],
    },
  });
  return character;
};

export const makeItemInstance = (
  definitionId: string,
  overrides: Partial<ItemInstance> = {},
): ItemInstance =>
  ItemInstanceSchema.parse({
    id: newItemInstanceId(),
    definitionId,
    ...overrides,
  });

export const isoTimestamp = (offsetMs = 0): string =>
  new Date(1_700_000_000_000 + offsetMs).toISOString();

export const eventId = (): string => ulid();
