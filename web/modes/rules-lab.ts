// Rules Lab — browser-side RAW-compliance verifier.
//
// Loads the probe library from web/audit/probes.ts and renders one row
// per probe. The visitor clicks "Run audit" and every probe runs
// against a freshly-built engine + the loaded starter pack. Pass = the
// engine enforces the rule; fail = the engine permits a RAW violation.
//
// This is the demo-side counterpart to tests/audit/raw-compliance.test.ts.
// Failing rows here are also failing rows in CI; passing rows here are
// also passing in CI. The trustworthiness story for the demo is "see
// for yourself."

import type { ContentPack } from 'dnd-srd-engine';
import { ALL_PROBES, type Probe, type ProbeResult } from '../audit/probes.js';

export interface RulesLabOptions {
  readonly starter: ContentPack;
  readonly root: HTMLElement;
  readonly onStatus?: (text: string) => void;
}

export interface RulesLab {
  readonly unmount: () => void;
}

interface ProbeRow {
  readonly probe: Probe;
  readonly li: HTMLLIElement;
  readonly statusEl: HTMLSpanElement;
  readonly detailEl: HTMLSpanElement;
}

const groupBy = <T, K extends string>(items: ReadonlyArray<T>, key: (t: T) => K): Map<K, T[]> => {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k) ?? [];
    list.push(item);
    out.set(k, list);
  }
  return out;
};

export const mountRulesLab = (opts: RulesLabOptions): RulesLab => {
  const { starter, root, onStatus } = opts;

  root.classList.add('rules-lab');
  root.innerHTML = `
    <header class="rules-lab-header">
      <h2>Rules Lab</h2>
      <p class="rules-lab-meta">
        ${ALL_PROBES.length} RAW probes. Click <strong>Run audit</strong> to verify the engine enforces each rule.
        Each probe constructs a fresh scenario, runs the matching engine planner, and asserts the rule is honored.
        Green rows = the engine enforces the rule. Red = a RAW violation slipped through.
      </p>
      <div class="rules-lab-toolbar">
        <button type="button" class="btn-run-audit">Run audit</button>
        <span class="rules-lab-summary"></span>
      </div>
    </header>
    <ol class="rules-lab-list" aria-label="RAW probes"></ol>
  `;

  const list = root.querySelector<HTMLOListElement>('.rules-lab-list');
  const runBtn = root.querySelector<HTMLButtonElement>('.btn-run-audit');
  const summary = root.querySelector<HTMLSpanElement>('.rules-lab-summary');
  if (!list || !runBtn || !summary) throw new Error('rules-lab: failed to mount template');

  const rows: ProbeRow[] = [];

  const grouped = groupBy(ALL_PROBES, (p) => p.category);
  for (const [category, probes] of grouped) {
    const header = document.createElement('li');
    header.className = 'rules-lab-group';
    header.textContent = category;
    list.appendChild(header);
    for (const probe of probes) {
      const li = document.createElement('li');
      li.className = 'rules-lab-row';
      li.innerHTML = `
        <span class="rules-lab-status" aria-label="status">·</span>
        <div class="rules-lab-body">
          <div class="rules-lab-name"></div>
          <div class="rules-lab-raw"></div>
          <div class="rules-lab-detail"></div>
        </div>
      `;
      const nameEl = li.querySelector<HTMLDivElement>('.rules-lab-name')!;
      const rawEl = li.querySelector<HTMLDivElement>('.rules-lab-raw')!;
      const detailEl = li.querySelector<HTMLSpanElement>('.rules-lab-detail')!;
      const statusEl = li.querySelector<HTMLSpanElement>('.rules-lab-status')!;
      nameEl.textContent = probe.name;
      rawEl.textContent = probe.raw;
      list.appendChild(li);
      rows.push({ probe, li, statusEl, detailEl });
    }
  }

  const renderResult = (row: ProbeRow, result: ProbeResult): void => {
    row.li.classList.remove('rules-lab-row-pending', 'rules-lab-row-pass', 'rules-lab-row-fail');
    row.li.classList.add(result.passed ? 'rules-lab-row-pass' : 'rules-lab-row-fail');
    row.statusEl.textContent = result.passed ? '✓' : '✗';
    row.detailEl.textContent = result.passed
      ? (result.detail ?? 'enforced')
      : (result.error ?? 'failed');
  };

  const runAll = (): void => {
    runBtn.disabled = true;
    let pass = 0;
    let fail = 0;
    onStatus?.(`Running ${rows.length} RAW probes...`);
    for (const row of rows) {
      row.li.classList.add('rules-lab-row-pending');
      row.statusEl.textContent = '…';
      row.detailEl.textContent = '';
    }
    // Run in a microtask so the UI repaints to "running" before we
    // hammer through the probe set. For ~15 probes the whole run is
    // <100 ms so we don't need real async chunking.
    queueMicrotask(() => {
      for (const row of rows) {
        try {
          const result = row.probe.run(starter);
          renderResult(row, result);
          if (result.passed) pass++;
          else fail++;
        } catch (err) {
          renderResult(row, { passed: false, error: `probe threw: ${(err as Error).message}` });
          fail++;
        }
      }
      summary.textContent = `${pass} of ${rows.length} pass · ${fail} fail`;
      summary.className = `rules-lab-summary ${fail === 0 ? 'rules-lab-summary-all-pass' : 'rules-lab-summary-some-fail'}`;
      onStatus?.(`Audit complete: ${pass}/${rows.length} pass, ${fail} fail`);
      runBtn.disabled = false;
    });
  };

  runBtn.addEventListener('pointerdown', runAll);

  return {
    unmount: () => {
      root.classList.remove('rules-lab');
      root.replaceChildren();
    },
  };
};
