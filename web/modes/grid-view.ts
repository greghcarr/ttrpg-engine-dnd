// Mini grid view.
//
// A small at-a-glance map showing every combatant on the encounter
// grid. Re-renders on every commit so movement is visible. The cell
// extent auto-fits the actors' positions (with a one-cell padding
// margin) so scenarios that spread out don't overflow the panel. The
// active combatant gets a ring; downed combatants fade.

import type { Campaign } from 'ttrpg-engine-dnd';
import type { EngineHost } from '../engine-host.js';
import type { DemoSession } from '../scenarios/index.js';

export interface GridViewOptions {
  readonly host: EngineHost;
  readonly scenario: DemoSession;
  readonly root: HTMLElement;
}

export interface GridView {
  readonly unmount: () => void;
}

const FEET_PER_CELL = 5;
const TOKEN_PALETTE: ReadonlyArray<string> = [
  '#4a89ff',
  '#e7553c',
  '#2ea84f',
  '#b67500',
  '#8e5fcc',
  '#cc5fa0',
  '#3aa5a5',
  '#c0a020',
];

const initialsFor = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? '') + (parts[1]![0] ?? '')).toUpperCase();
};

const colorForIndex = (i: number): string => TOKEN_PALETTE[i % TOKEN_PALETTE.length]!;

interface Bounds {
  readonly minCellX: number;
  readonly maxCellX: number;
  readonly minCellY: number;
  readonly maxCellY: number;
}

const computeBounds = (positions: ReadonlyArray<{ x: number; y: number }>): Bounds => {
  if (positions.length === 0) {
    return { minCellX: 0, maxCellX: 5, minCellY: 0, maxCellY: 5 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of positions) {
    const cx = Math.floor(p.x / FEET_PER_CELL);
    const cy = Math.floor(p.y / FEET_PER_CELL);
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
  }
  // One-cell padding around the occupied area, and a minimum extent
  // so single-actor or tightly-clustered scenarios don't render a
  // 1x1 grid.
  const padded = {
    minCellX: minX - 1,
    maxCellX: maxX + 1,
    minCellY: minY - 1,
    maxCellY: maxY + 1,
  };
  const widen = (lo: number, hi: number, min: number): [number, number] => {
    let span = hi - lo + 1;
    let l = lo;
    let h = hi;
    while (span < min) {
      h += 1;
      span += 1;
      if (span < min) {
        l -= 1;
        span += 1;
      }
    }
    return [l, h];
  };
  const [mx, Mx] = widen(padded.minCellX, padded.maxCellX, 6);
  const [my, My] = widen(padded.minCellY, padded.maxCellY, 4);
  return { minCellX: mx, maxCellX: Mx, minCellY: my, maxCellY: My };
};

export const mountGridView = (opts: GridViewOptions): GridView => {
  const { host, scenario, root } = opts;

  root.classList.add('grid-view');
  root.innerHTML = `
    <header class="grid-view-header">
      <h2>Map</h2>
    </header>
    <div class="grid-view-board" aria-label="Combatant positions"></div>
  `;
  const board = root.querySelector<HTMLDivElement>('.grid-view-board');
  if (!board) throw new Error('grid-view: failed to mount root template');

  const colorByCombatantId = new Map<string, string>();

  const render = (campaign: Campaign): void => {
    const encId = campaign.state.activeEncounterId ?? scenario.encounterId;
    const enc = campaign.state.encounters[encId];
    if (!enc) {
      board.replaceChildren();
      return;
    }
    const activeId = enc.combatants[enc.activeIndex]?.combatantId;

    // Assign stable colors in initiative order on first sight.
    const sorted = enc.combatants
      .slice()
      .sort((a, b) => a.initiativeOrder - b.initiativeOrder);
    sorted.forEach((cb, i) => {
      if (!colorByCombatantId.has(cb.combatantId)) {
        colorByCombatantId.set(cb.combatantId, colorForIndex(i));
      }
    });

    const positions = sorted
      .map((cb) => cb.position)
      .filter((p): p is { x: number; y: number } => p !== undefined);
    const bounds = computeBounds(positions);
    const cols = bounds.maxCellX - bounds.minCellX + 1;
    const rows = bounds.maxCellY - bounds.minCellY + 1;

    board.style.setProperty('--grid-cols', String(cols));
    board.style.setProperty('--grid-rows', String(rows));

    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        frag.appendChild(cell);
      }
    }
    for (const cb of sorted) {
      if (!cb.position) continue;
      const ch = campaign.state.characters[cb.combatantId];
      const cellX = Math.floor(cb.position.x / FEET_PER_CELL) - bounds.minCellX;
      const cellY = Math.floor(cb.position.y / FEET_PER_CELL) - bounds.minCellY;
      const token = document.createElement('div');
      token.className = 'grid-token';
      if (cb.combatantId === activeId) token.classList.add('grid-token-active');
      if (ch && ch.hp.current <= 0) token.classList.add('grid-token-downed');
      token.style.setProperty('--token-col', String(cellX + 1));
      token.style.setProperty('--token-row', String(cellY + 1));
      token.style.setProperty(
        '--token-color',
        colorByCombatantId.get(cb.combatantId) ?? '#888',
      );
      token.textContent = initialsFor(ch?.name ?? cb.combatantId.slice(0, 2));
      token.title = ch
        ? `${ch.name} — ${ch.hp.current}/${ch.hp.max} HP @ (${cb.position.x},${cb.position.y})`
        : `${cb.combatantId} @ (${cb.position.x},${cb.position.y})`;
      frag.appendChild(token);
    }
    board.replaceChildren(frag);
  };

  render(host.getCampaign());
  const unsubscribe = host.subscribe(render);

  return {
    unmount: () => {
      unsubscribe();
      root.classList.remove('grid-view');
      root.replaceChildren();
    },
  };
};
