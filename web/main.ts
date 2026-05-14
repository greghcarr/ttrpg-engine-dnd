import { createEngineHost, type EngineHost } from './engine-host.js';
import { mountCombatSandbox, type CombatSandbox } from './modes/combat-sandbox.js';
import { mountEventInspector, type EventInspector } from './modes/event-inspector.js';
import { mountPendingChoiceResolver, type PendingChoiceResolver } from './ui/pending-choice.js';
import { buildGoblinSkirmish, type GoblinSkirmish } from './scenarios/goblin-skirmish.js';

type StarterModule = typeof import('ttrpg-engine-dnd/starter-pack');
type StarterPack = ReturnType<StarterModule['loadStarterPack']>;

const DEFAULT_SEED = 42;

const status = document.getElementById('status');
const setStatus = (text: string): void => {
  if (status) status.textContent = text;
};

const resetBtn = document.getElementById('btn-reset') as HTMLButtonElement | null;
const seedInput = document.getElementById('seed-input') as HTMLInputElement | null;
const sandboxRoot = document.getElementById('combat-sandbox-root');
const inspectorRoot = document.getElementById('event-inspector-root');
const choiceRoot = document.getElementById('pending-choice-root');

// URL hash format: `#seed=42&mode=combat`. We only read/write `seed` for
// now; `mode` lands when the second mode does. Keep this tolerant of
// unknown keys so future hash params don't strand sessions.
const readHashParams = (): URLSearchParams => {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  return new URLSearchParams(raw);
};

const writeHashSeed = (seed: number): void => {
  const params = readHashParams();
  params.set('seed', String(seed));
  const next = `#${params.toString()}`;
  if (location.hash !== next) {
    history.replaceState(null, '', next);
  }
};

const readHashSeed = (): number => {
  const raw = readHashParams().get('seed');
  if (raw === null) return DEFAULT_SEED;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SEED;
};

const activeCombatantId = (
  campaign: {
    state: {
      encounters: Record<
        string,
        { combatants: ReadonlyArray<{ combatantId: string; initiativeOrder: number }>; activeIndex: number }
      >;
      activeEncounterId?: string;
    };
  },
): string | undefined => {
  const id = campaign.state.activeEncounterId;
  if (!id) return undefined;
  const enc = campaign.state.encounters[id];
  if (!enc) return undefined;
  return enc.combatants[enc.activeIndex]?.combatantId;
};

interface DemoSession {
  readonly host: EngineHost;
  readonly scenario: GoblinSkirmish;
  readonly idToName: ReadonlyMap<string, string>;
}

const startSession = (starter: StarterPack, seed: number): DemoSession => {
  const scenario = buildGoblinSkirmish(starter, { seed });
  const host = createEngineHost(scenario.engine, scenario.campaign);
  const idToName = new Map<string, string>();
  for (const [name, id] of Object.entries(scenario.combatants)) idToName.set(id, name);

  host.subscribe((c) => {
    const enc = c.state.encounters[scenario.encounterId];
    const initiative = enc?.combatants
      .slice()
      .sort((a, b) => a.initiativeOrder - b.initiativeOrder)
      .map((cb) => `${idToName.get(cb.combatantId) ?? cb.combatantId}@${cb.initiative}`);
    const active = activeCombatantId(c);
    const activeCb = enc?.combatants.find((cb) => cb.combatantId === active);
    const activeChar = active ? c.state.characters[active] : undefined;
    const charSummary = Object.values(c.state.characters).map((ch) => ({
      name: ch.name,
      hp: `${ch.hp.current}/${ch.hp.max}`,
      conditions: ch.appliedConditions.map((a) => a.conditionId),
    }));
    console.log('[demo] commit', {
      events: c.events.length,
      cursor: c.cursor,
      active: active ? idToName.get(active) : undefined,
      activeTurnUsage: activeCb?.turnUsage,
      activeConditions: activeChar?.appliedConditions.map((a) => a.conditionId),
      initiative,
      characters: charSummary,
    });
  });

  return { host, scenario, idToName };
};

const renderReady = (session: DemoSession): void => {
  const initialActive = activeCombatantId(session.host.getCampaign());
  console.log('[demo] scenario ready', {
    schemaVersion: session.scenario.engine.schemaVersion,
    seed: session.scenario.seed,
    encounterId: session.scenario.encounterId,
    combatants: session.scenario.combatants,
    initialEvents: session.host.getCampaign().events.length,
    activeCombatant: initialActive ? session.idToName.get(initialActive) : undefined,
  });
  setStatus(
    `Scenario ready (seed ${session.scenario.seed}). ` +
      `${session.host.getCampaign().events.length} seed events committed. ` +
      `${initialActive ? `${session.idToName.get(initialActive)}'s turn` : 'No active combatant'} — pick an action from their row in the sandbox.`,
  );
};

async function boot(): Promise<void> {
  setStatus('Loading starter pack...');
  const { loadStarterPack } = await import('ttrpg-engine-dnd/starter-pack');

  setStatus('Building scenario...');
  const starter = loadStarterPack();

  let seed = readHashSeed();
  writeHashSeed(seed);
  if (seedInput) seedInput.value = String(seed);

  let session = startSession(starter, seed);
  let sandbox: CombatSandbox | undefined;
  let inspector: EventInspector | undefined;
  let resolver: PendingChoiceResolver | undefined;
  const mountPanels = (): void => {
    if (sandboxRoot) {
      sandbox = mountCombatSandbox({
        host: session.host,
        scenario: session.scenario,
        root: sandboxRoot,
        onStatus: setStatus,
      });
    }
    if (inspectorRoot) {
      inspector = mountEventInspector({ host: session.host, root: inspectorRoot, onStatus: setStatus });
    }
    if (choiceRoot) {
      resolver = mountPendingChoiceResolver({ host: session.host, root: choiceRoot, onStatus: setStatus });
    }
  };
  mountPanels();
  renderReady(session);

  const reset = (newSeed: number): void => {
    seed = newSeed;
    writeHashSeed(seed);
    if (seedInput) seedInput.value = String(seed);
    sandbox?.unmount();
    inspector?.unmount();
    resolver?.unmount();
    session = startSession(starter, seed);
    mountPanels();
    renderReady(session);
  };

  if (resetBtn) {
    resetBtn.disabled = false;
    resetBtn.addEventListener('pointerdown', () => {
      const raw = seedInput?.value ?? String(seed);
      const parsed = Number.parseInt(raw, 10);
      const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : seed;
      reset(next);
    });
  }

  // React to manual edits of the URL hash (back/forward, paste).
  window.addEventListener('hashchange', () => {
    const next = readHashSeed();
    if (next !== seed) reset(next);
  });
}

boot().catch((err) => {
  console.error('[demo] boot failed', err);
  setStatus(`Boot failed: ${(err as Error).message}`);
});
