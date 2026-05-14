// Combat Sandbox mode.
//
// Renders the scenario's combatants ordered by initiative, with HP,
// conditions, position, and an inline action toolbar on the active
// combatant's row. Hard-coded action set per step 5 of the build
// order: Attack (per non-self target) · Move (NSEW 5ft steps) · Dash ·
// Dodge · End Turn. No generalization yet — the toolbar is rebuilt on
// each commit because the active combatant moves around.

import type { Campaign, OpportunityAvailableEvent } from 'ttrpg-engine-dnd';
import type { EngineHost, Intent } from '../engine-host.js';
import type { DemoSession } from '../scenarios/index.js';

export interface CombatSandboxOptions {
  readonly host: EngineHost;
  readonly scenario: DemoSession;
  readonly root: HTMLElement;
  readonly onStatus?: (text: string) => void;
}

export interface CombatSandbox {
  readonly unmount: () => void;
}

const STEP_FEET = 5;

const activeEncounterId = (campaign: Campaign, fallback: string): string => {
  return campaign.state.activeEncounterId ?? fallback;
};

const activeCombatantId = (campaign: Campaign, encounterId: string): string | undefined => {
  const enc = campaign.state.encounters[encounterId];
  if (!enc) return undefined;
  return enc.combatants[enc.activeIndex]?.combatantId;
};

const orderedCombatants = (
  campaign: Campaign,
  encounterId: string,
): ReadonlyArray<{ combatantId: string; initiative: number; initiativeOrder: number; position?: { x: number; y: number } }> => {
  const enc = campaign.state.encounters[encounterId];
  if (!enc) return [];
  return enc.combatants
    .map((c) => ({
      combatantId: c.combatantId,
      initiative: c.initiative,
      initiativeOrder: c.initiativeOrder,
      position: c.position,
    }))
    .sort((a, b) => a.initiativeOrder - b.initiativeOrder);
};

const equippedWeaponId = (campaign: Campaign, combatantId: string): string | undefined => {
  return campaign.state.characters[combatantId]?.equipped.mainHand;
};

export const mountCombatSandbox = (opts: CombatSandboxOptions): CombatSandbox => {
  const { host, scenario, root, onStatus } = opts;

  root.classList.add('combat-sandbox');
  root.innerHTML = `
    <header class="combat-header">
      <h2>Combat Sandbox</h2>
      <p class="combat-meta"></p>
    </header>
    <div class="oa-queue" aria-label="Pending opportunity attacks" hidden></div>
    <ol class="combatant-list" aria-label="Initiative order"></ol>
  `;

  const meta = root.querySelector<HTMLParagraphElement>('.combat-meta');
  const list = root.querySelector<HTMLOListElement>('.combatant-list');
  const oaQueueEl = root.querySelector<HTMLDivElement>('.oa-queue');
  if (!meta || !list || !oaQueueEl)
    throw new Error('combat-sandbox: failed to mount root template');

  // Opportunity-attack queue. Each move dispatch may emit one or more
  // OpportunityAvailable events; we append them here so the consumer
  // can decide per reactor whether to take it. Re-rendered on every
  // commit (the list shrinks as the user clicks Take / Pass and the
  // host's subscriber re-renders).
  let pendingOAs: OpportunityAvailableEvent[] = [];

  const fire = (intent: Intent, label: string): void => {
    try {
      const { events } = host.dispatch(intent);
      console.log(`[demo] ${label} dispatched`, intent, events.map((e) => e.type), events);
      onStatus?.(`${label} → ${events.length} events committed.`);
      // Capture any opportunity-attack offers surfaced by this dispatch
      // (planMove emits one OpportunityAvailable per eligible reactor).
      // Filter out reactors who can't currently take an OA — saves the
      // user from clicking Pass on offers that would just reject.
      for (const ev of events) {
        if (ev.type === 'OpportunityAvailable') {
          pendingOAs.push(ev as OpportunityAvailableEvent);
        }
      }
    } catch (err) {
      console.error(`[demo] ${label} rejected`, intent, err);
      onStatus?.(`${label} rejected: ${(err as Error).message}`);
    }
  };

  const takeOA = (offer: OpportunityAvailableEvent): void => {
    const reactor = host.getState().characters[offer.reactorId];
    const weaponId = reactor?.equipped.mainHand;
    if (!weaponId) {
      onStatus?.(`OA passed: ${reactor?.name ?? offer.reactorId} has no main-hand weapon`);
      pendingOAs = pendingOAs.filter((o) => o.id !== offer.id);
      return;
    }
    try {
      const { events } = host.dispatch({
        kind: 'opportunityAttack',
        reactorId: offer.reactorId,
        targetId: offer.moverId,
        weaponInstanceId: weaponId,
      });
      console.log('[demo] OpportunityAttack dispatched', offer, events);
      onStatus?.(
        `${reactor?.name ?? offer.reactorId} took an OA → ${events.length} events committed.`,
      );
    } catch (err) {
      console.error('[demo] OpportunityAttack rejected', offer, err);
      onStatus?.(`OA rejected: ${(err as Error).message}`);
    }
    pendingOAs = pendingOAs.filter((o) => o.id !== offer.id);
  };

  const passOA = (offer: OpportunityAvailableEvent): void => {
    pendingOAs = pendingOAs.filter((o) => o.id !== offer.id);
    onStatus?.(`Passed on OA (${offer.reactorId})`);
  };

  const renderOAQueue = (campaign: Campaign): void => {
    if (pendingOAs.length === 0) {
      oaQueueEl.hidden = true;
      oaQueueEl.replaceChildren();
      return;
    }
    oaQueueEl.hidden = false;
    const frag = document.createDocumentFragment();
    const header = document.createElement('p');
    header.className = 'oa-queue-header';
    header.textContent = `Pending opportunity attacks (${pendingOAs.length})`;
    frag.appendChild(header);
    for (const offer of pendingOAs) {
      const reactor = campaign.state.characters[offer.reactorId];
      const mover = campaign.state.characters[offer.moverId];
      const row = document.createElement('div');
      row.className = 'oa-offer';
      const text = document.createElement('span');
      text.className = 'oa-text';
      text.textContent =
        `${reactor?.name ?? offer.reactorId} → OA against ${mover?.name ?? offer.moverId}`;
      row.appendChild(text);
      const takeBtn = document.createElement('button');
      takeBtn.type = 'button';
      takeBtn.textContent = 'Take';
      takeBtn.addEventListener('pointerdown', () => takeOA(offer));
      const passBtn = document.createElement('button');
      passBtn.type = 'button';
      passBtn.textContent = 'Pass';
      passBtn.addEventListener('pointerdown', () => passOA(offer));
      row.appendChild(takeBtn);
      row.appendChild(passBtn);
      frag.appendChild(row);
    }
    oaQueueEl.replaceChildren(frag);
  };

  const buildActionToolbar = (
    activeId: string,
    campaign: Campaign,
    downed: boolean,
  ): HTMLDivElement => {
    const bar = document.createElement('div');
    bar.className = 'action-toolbar';

    const mkBtn = (label: string, onClick: () => void, disabled = false): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.disabled = disabled;
      b.addEventListener('pointerdown', onClick);
      return b;
    };

    const endTurnBtn = mkBtn('End Turn', () =>
      fire({ kind: 'advanceTurn', encounterId: scenario.encounterId }, 'Advance turn'),
    );

    if (downed) {
      // A combatant at 0 HP is unconscious and can take no actions
      // other than death saves (which the engine rolls automatically
      // at turn-start). The only legal click is End Turn so the round
      // can continue.
      const note = document.createElement('span');
      note.className = 'toolbar-note';
      note.textContent = 'Unconscious — only End Turn is available.';
      bar.appendChild(note);
      bar.appendChild(endTurnBtn);
      return bar;
    }

    const attackerWeapon = equippedWeaponId(campaign, activeId);
    const targets = Object.values(campaign.state.characters).filter(
      (c) => c.id !== activeId && c.hp.current > 0,
    );

    if (attackerWeapon) {
      for (const t of targets) {
        bar.appendChild(
          mkBtn(`Attack ${t.name}`, () =>
            fire(
              {
                kind: 'attack',
                attackerId: activeId,
                targetId: t.id,
                weaponInstanceId: attackerWeapon,
              },
              `Attack ${t.name}`,
            ),
          ),
        );
      }
    }

    const encId = activeEncounterId(campaign, scenario.encounterId);
    const pos =
      campaign.state.encounters[encId]?.combatants.find(
        (c) => c.combatantId === activeId,
      )?.position;
    const move = (dx: number, dy: number, label: string): void => {
      if (!pos) {
        onStatus?.('Move rejected: no current position.');
        return;
      }
      fire({ kind: 'move', combatantId: activeId, to: { x: pos.x + dx, y: pos.y + dy } }, `Move ${label}`);
    };
    bar.appendChild(mkBtn('↑', () => move(0, -STEP_FEET, 'N')));
    bar.appendChild(mkBtn('↓', () => move(0, STEP_FEET, 'S')));
    bar.appendChild(mkBtn('←', () => move(-STEP_FEET, 0, 'W')));
    bar.appendChild(mkBtn('→', () => move(STEP_FEET, 0, 'E')));

    bar.appendChild(mkBtn('Dash', () => fire({ kind: 'dash', combatantId: activeId }, 'Dash')));
    bar.appendChild(mkBtn('Dodge', () => fire({ kind: 'dodge', combatantId: activeId }, 'Dodge')));
    bar.appendChild(endTurnBtn);
    return bar;
  };

  const render = (campaign: Campaign): void => {
    const encId = activeEncounterId(campaign, scenario.encounterId);
    const enc = campaign.state.encounters[encId];
    if (!enc) {
      meta.textContent = '(no encounter)';
      list.replaceChildren();
      return;
    }
    const active = activeCombatantId(campaign, encId);
    meta.textContent =
      `Round ${enc.round}  ·  seed ${scenario.seed}  ·  ` +
      `${campaign.events.length} events  ·  ` +
      `status: ${enc.status}`;

    const order = orderedCombatants(campaign, encId);
    const items = order.map((entry) => {
      const ch = campaign.state.characters[entry.combatantId];
      const li = document.createElement('li');
      li.className = 'combatant';
      if (entry.combatantId === active) li.classList.add('active');
      if (ch && ch.hp.current <= 0) li.classList.add('downed');

      const conds = ch ? ch.appliedConditions.map((a) => a.conditionId) : [];
      const pos = entry.position ? `(${entry.position.x},${entry.position.y})` : '';

      li.innerHTML = `
        <div class="combatant-line">
          <span class="combatant-name"></span>
          <span class="combatant-hp"></span>
          <span class="combatant-pos"></span>
          <span class="combatant-initiative"></span>
        </div>
        <div class="combatant-conditions"></div>
      `;
      li.querySelector('.combatant-name')!.textContent = ch?.name ?? entry.combatantId;
      li.querySelector('.combatant-hp')!.textContent = ch
        ? `${ch.hp.current}/${ch.hp.max}${ch.hp.temp > 0 ? ` (+${ch.hp.temp})` : ''} HP`
        : '? HP';
      li.querySelector('.combatant-pos')!.textContent = pos;
      li.querySelector('.combatant-initiative')!.textContent = `init ${entry.initiative}`;
      li.querySelector('.combatant-conditions')!.textContent =
        conds.length === 0 ? '' : conds.join(', ');

      if (entry.combatantId === active && enc.status === 'active' && ch) {
        li.appendChild(buildActionToolbar(active, campaign, ch.hp.current <= 0));
      }
      return li;
    });
    list.replaceChildren(...items);
    renderOAQueue(campaign);
  };

  render(host.getCampaign());
  const unsubscribe = host.subscribe(render);

  return {
    unmount: () => {
      unsubscribe();
      root.classList.remove('combat-sandbox');
      root.replaceChildren();
    },
  };
};
