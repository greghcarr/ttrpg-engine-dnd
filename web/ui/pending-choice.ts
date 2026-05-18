// Generic PendingChoice resolver.
//
// One UI for every choice the engine emits. The engine's PendingChoice
// shape is uniform — no per-kind discriminator — so the resolver just
// reads `{prompt, options, oneOf, forCharacterId}` off the choice
// record and renders option buttons. When `oneOf > 1` it switches to
// checkbox-style multi-select with a Confirm button.
//
// V1 reachability caveat (per docs/web-demo-plan.md "Implementation
// notes"): the v1 planner set (attack/move/dash/dodge/disengage/
// endTurn) does not currently emit ChoiceRequired. PendingChoices
// arrive from level-up flows and from content-pack `OfferChoice`
// effects — neither is reachable from the v1 Combat Sandbox scenario.
// The resolver ships anyway so any future mode that does trigger one
// gets a working UI for free.

import type { PendingChoice } from 'dnd-srd-engine';
import type { EngineHost } from '../engine-host.js';

export interface PendingChoiceResolverOptions {
  readonly host: EngineHost;
  readonly root: HTMLElement;
  readonly onStatus?: (text: string) => void;
}

export interface PendingChoiceResolver {
  readonly unmount: () => void;
}

const pendingChoicesFor = (
  pendingChoices: Record<string, PendingChoice>,
): ReadonlyArray<PendingChoice> =>
  Object.values(pendingChoices).filter((c) => c.resolution === undefined);

export const mountPendingChoiceResolver = (
  opts: PendingChoiceResolverOptions,
): PendingChoiceResolver => {
  const { host, root, onStatus } = opts;

  root.classList.add('pending-choice-resolver');

  const renderChoice = (choice: PendingChoice): HTMLDivElement => {
    const wrap = document.createElement('div');
    wrap.className = 'pending-choice';
    const oneOf = choice.oneOf ?? 1;
    wrap.innerHTML = `
      <p class="choice-prompt"></p>
      <p class="choice-rules"></p>
      <div class="choice-options"></div>
      <div class="choice-confirm"></div>
    `;
    wrap.querySelector('.choice-prompt')!.textContent = choice.prompt;
    wrap.querySelector('.choice-rules')!.textContent =
      `Pick ${oneOf} of ${choice.options.length} for character ${choice.forCharacterId}.`;

    const optionsEl = wrap.querySelector<HTMLDivElement>('.choice-options')!;
    const confirmEl = wrap.querySelector<HTMLDivElement>('.choice-confirm')!;

    const fire = (selectedOptionIds: ReadonlyArray<string>): void => {
      try {
        const { events } = host.dispatch({
          kind: 'resolveChoice',
          choiceId: choice.id,
          characterId: choice.forCharacterId,
          selectedOptionIds,
        });
        console.log('[demo] resolveChoice dispatched', { choiceId: choice.id, selectedOptionIds, events });
        onStatus?.(`Resolved "${choice.prompt}" → ${events.length} events committed.`);
      } catch (err) {
        console.error('[demo] resolveChoice rejected', err);
        onStatus?.(`Choice rejected: ${(err as Error).message}`);
      }
    };

    if (oneOf === 1) {
      // Single-select: each option button resolves the choice immediately.
      for (const opt of choice.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = opt.label;
        b.title = opt.id;
        b.addEventListener('pointerdown', () => fire([opt.id]));
        optionsEl.appendChild(b);
      }
    } else {
      // Multi-select: render checkboxes + a Confirm button that fires
      // once the right number are checked.
      const selected = new Set<string>();
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.textContent = `Confirm (${selected.size}/${oneOf})`;
      confirm.disabled = true;
      confirm.addEventListener('pointerdown', () => {
        if (selected.size === oneOf) fire([...selected]);
      });
      for (const opt of choice.options) {
        const label = document.createElement('label');
        label.className = 'choice-checkbox';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = opt.id;
        cb.addEventListener('change', () => {
          if (cb.checked) {
            if (selected.size >= oneOf) {
              cb.checked = false;
              return;
            }
            selected.add(opt.id);
          } else {
            selected.delete(opt.id);
          }
          confirm.textContent = `Confirm (${selected.size}/${oneOf})`;
          confirm.disabled = selected.size !== oneOf;
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + opt.label));
        optionsEl.appendChild(label);
      }
      confirmEl.appendChild(confirm);
    }

    return wrap;
  };

  const render = (): void => {
    const choices = pendingChoicesFor(host.getCampaign().state.pendingChoices);
    if (choices.length === 0) {
      root.replaceChildren();
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const frag = document.createDocumentFragment();
    const header = document.createElement('h2');
    header.textContent = `Pending choices (${choices.length})`;
    frag.appendChild(header);
    for (const choice of choices) frag.appendChild(renderChoice(choice));
    root.replaceChildren(frag);
  };

  render();
  const unsubscribe = host.subscribe(render);

  return {
    unmount: () => {
      unsubscribe();
      root.classList.remove('pending-choice-resolver');
      root.replaceChildren();
      root.hidden = false;
    },
  };
};
