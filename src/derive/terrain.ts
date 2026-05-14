import type {
  Door,
  LocationMap,
  TerrainKind,
} from '../schemas/runtime/location.js';
import {
  DEFAULT_CELL_SIZE_FEET,
  DIFFICULT_MOVEMENT_COST,
  NORMAL_MOVEMENT_COST,
} from '../schemas/runtime/location.js';
import type { Position } from '../schemas/runtime/encounter.js';

export const terrainAt = (map: LocationMap, x: number, y: number): TerrainKind | undefined => {
  if (x < 0 || x >= map.widthCells) return undefined;
  if (y < 0 || y >= map.heightCells) return undefined;
  return map.terrain[y]?.[x];
};

export const movementCostFor = (terrain: TerrainKind): number => {
  switch (terrain) {
    case 'normal':
      return NORMAL_MOVEMENT_COST;
    case 'water':
    case 'difficult':
      return DIFFICULT_MOVEMENT_COST;
    case 'impassable':
      return Number.POSITIVE_INFINITY;
  }
};

export const movementCostAt = (map: LocationMap, x: number, y: number): number => {
  const terrain = terrainAt(map, x, y);
  if (terrain === undefined) return Number.POSITIVE_INFINITY;
  return movementCostFor(terrain);
};

const chebyshevSteps = (a: Position, b: Position): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const chebyshevDistanceFeet = (
  a: Position,
  b: Position,
  cellSizeFeet: number = DEFAULT_CELL_SIZE_FEET,
): number => chebyshevSteps(a, b) * cellSizeFeet;

export const isInRangeFeet = (
  from: Position,
  to: Position,
  rangeFeet: number,
  cellSizeFeet: number = DEFAULT_CELL_SIZE_FEET,
): boolean => chebyshevDistanceFeet(from, to, cellSizeFeet) <= rangeFeet;

interface RayCell {
  readonly x: number;
  readonly y: number;
}

export const bresenhamCells = (from: Position, to: Position): RayCell[] => {
  const cells: RayCell[] = [];
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return cells;
};

const doorBlocksSight = (door: Door): boolean =>
  door.state === 'closed' || door.state === 'locked';

export const hasLineOfSight = (
  map: LocationMap,
  doorsAtLocation: ReadonlyArray<Door>,
  from: Position,
  to: Position,
): boolean => {
  const cells = bresenhamCells(from, to);
  for (let i = 1; i < cells.length - 1; i++) {
    const cell = cells[i]!;
    if (terrainAt(map, cell.x, cell.y) === 'impassable') return false;
    for (const door of doorsAtLocation) {
      if (door.position.x === cell.x && door.position.y === cell.y && doorBlocksSight(door)) {
        return false;
      }
    }
  }
  return true;
};

export const hasLineOfEffect = hasLineOfSight;
