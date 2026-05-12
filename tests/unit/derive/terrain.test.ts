import { describe, expect, it } from 'vitest';
import {
  chebyshevDistanceFeet,
  hasLineOfSight,
  isInRangeFeet,
  movementCostAt,
  movementCostFor,
  terrainAt,
} from '../../../src/derive/terrain.js';
import type { Door, LocationMap } from '../../../src/schemas/runtime/location.js';

const makeMap = (
  width: number,
  height: number,
  terrain: ReadonlyArray<ReadonlyArray<'normal' | 'difficult' | 'impassable' | 'water'>>,
): LocationMap => ({
  widthCells: width,
  heightCells: height,
  cellSizeFeet: 5,
  terrain: terrain.map((row) => [...row]),
});

describe('derive/terrain', () => {
  describe('terrainAt and movementCost', () => {
    it('reads terrain at coordinates and returns undefined out of bounds', () => {
      const map = makeMap(2, 2, [
        ['normal', 'difficult'],
        ['impassable', 'water'],
      ]);
      expect(terrainAt(map, 0, 0)).toBe('normal');
      expect(terrainAt(map, 1, 0)).toBe('difficult');
      expect(terrainAt(map, 0, 1)).toBe('impassable');
      expect(terrainAt(map, 1, 1)).toBe('water');
      expect(terrainAt(map, 2, 0)).toBeUndefined();
      expect(terrainAt(map, -1, 0)).toBeUndefined();
    });

    it('returns cost 1 for normal, 2 for difficult/water, Infinity for impassable', () => {
      expect(movementCostFor('normal')).toBe(1);
      expect(movementCostFor('difficult')).toBe(2);
      expect(movementCostFor('water')).toBe(2);
      expect(movementCostFor('impassable')).toBe(Number.POSITIVE_INFINITY);
    });

    it('reads cost at a cell and returns Infinity off-map', () => {
      const map = makeMap(2, 1, [['normal', 'difficult']]);
      expect(movementCostAt(map, 0, 0)).toBe(1);
      expect(movementCostAt(map, 1, 0)).toBe(2);
      expect(movementCostAt(map, 5, 5)).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('chebyshevDistanceFeet and range', () => {
    it('computes Chebyshev distance in feet', () => {
      expect(chebyshevDistanceFeet({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(20);
      expect(chebyshevDistanceFeet({ x: 0, y: 0 }, { x: 0, y: 0 }, 5)).toBe(0);
      expect(chebyshevDistanceFeet({ x: 2, y: 2 }, { x: 2, y: 5 }, 5)).toBe(15);
    });

    it('checks range', () => {
      expect(isInRangeFeet({ x: 0, y: 0 }, { x: 6, y: 0 }, 30, 5)).toBe(true);
      expect(isInRangeFeet({ x: 0, y: 0 }, { x: 7, y: 0 }, 30, 5)).toBe(false);
    });
  });

  describe('hasLineOfSight', () => {
    const allNormal = (n: number): LocationMap =>
      makeMap(
        n,
        n,
        Array.from({ length: n }, () => Array.from({ length: n }, () => 'normal' as const)),
      );

    it('returns true on an open map', () => {
      expect(hasLineOfSight(allNormal(5), [], { x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true);
    });

    it('is blocked by an impassable cell between caster and target', () => {
      const map = makeMap(3, 1, [['normal', 'impassable', 'normal']]);
      expect(hasLineOfSight(map, [], { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
    });

    it('is blocked by a closed door between caster and target', () => {
      const map = allNormal(5);
      const door: Door = {
        id: 'door1',
        locationId: 'loc1',
        position: { x: 2, y: 0 },
        state: 'closed',
      };
      expect(hasLineOfSight(map, [door], { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
    });

    it('is not blocked by an open door', () => {
      const map = allNormal(5);
      const door: Door = {
        id: 'door1',
        locationId: 'loc1',
        position: { x: 2, y: 0 },
        state: 'open',
      };
      expect(hasLineOfSight(map, [door], { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
    });

    it('is blocked by a locked door', () => {
      const map = allNormal(5);
      const door: Door = {
        id: 'door1',
        locationId: 'loc1',
        position: { x: 2, y: 2 },
        state: 'locked',
      };
      expect(hasLineOfSight(map, [door], { x: 0, y: 0 }, { x: 4, y: 4 })).toBe(false);
    });
  });
});
