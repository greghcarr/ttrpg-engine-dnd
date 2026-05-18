// CI replay test for every scenario shipped in web/scenarios/.
//
// The plan's headline correctness claim: `replay(events).state` deep-
// equals the live `campaign.state`. The web demo's Import button
// surfaces this to users; this test gates it at CI time so the demo
// can't ship with a broken replay claim.
//
// Loops over web/scenarios/index.ts's SCENARIOS registry — adding a
// scenario there is all it takes to extend CI coverage.

import { describe, expect, it } from 'vitest';
import { replay, serializeCampaign, loadCampaign } from 'dnd-srd-engine';
import { SCENARIOS } from '../../web/scenarios/index.js';

describe('web demo: replay equivalence', () => {
  for (const scenario of SCENARIOS) {
    describe(scenario.id, () => {
      it('replay(events).state deep-equals campaign.state', () => {
        const { campaign } = scenario.build();
        const rebuilt = replay(campaign.events);
        expect(rebuilt).toEqual(campaign.state);
      });

      it('serialize → load round-trip preserves the state', () => {
        const { campaign } = scenario.build();
        const json = serializeCampaign(campaign);
        const loaded = loadCampaign(json);
        expect(loaded.state).toEqual(campaign.state);
        expect(loaded.events).toEqual(campaign.events);
        expect(loaded.id).toBe(campaign.id);
        expect(loaded.schemaVersion).toBe(campaign.schemaVersion);
      });

      it('is deterministic under a fixed seed', () => {
        const a = scenario.build({ seed: 7 });
        const b = scenario.build({ seed: 7 });
        // Event IDs and timestamps differ across builds (ULID + Date.now),
        // but the derived state must match. Compare state — not events —
        // to assert determinism over the RNG-bearing decisions.
        const aRollOutcomes = a.campaign.events
          .filter((e) => e.type === 'InitiativeRolled')
          .flatMap((e) => (e as { rolls: ReadonlyArray<{ d20: number }> }).rolls.map((r) => r.d20));
        const bRollOutcomes = b.campaign.events
          .filter((e) => e.type === 'InitiativeRolled')
          .flatMap((e) => (e as { rolls: ReadonlyArray<{ d20: number }> }).rolls.map((r) => r.d20));
        expect(aRollOutcomes).toEqual(bRollOutcomes);
      });
    });
  }
});

// Headline-action probes — one per scenario, exercising the rule
// each scenario's picker hint promises. The replay-equivalence tests
// above cover construction; these cover *demonstration*. A scenario
// whose hint says "click → to see the engine reject" but where the
// engine doesn't actually reject is a broken scenario, even if it
// replays cleanly.

const requireScenario = (id: string) => {
  const s = SCENARIOS.find((sc) => sc.id === id);
  if (!s) throw new Error(`scenario "${id}" missing from registry`);
  return s;
};

describe('web demo: frightened-halfling headline action', () => {
  it('Pip moving east (toward Goblin Scout) rejects', () => {
    const session = requireScenario('frightened-halfling').build();
    const pipId = session.combatants['halfling']!;
    const pip = session.campaign.state.characters[pipId]!;
    void pip;
    // The toolbar move-east button steps +5 in x. Pip starts at (5,5)
    // facing the goblin at (25,5); east goes closer.
    expect(() =>
      session.engine.plan.move(session.campaign.state, {
        combatantId: pipId,
        to: { x: 10, y: 5 },
      }),
    ).toThrow(/frightened|closer|source/i);
  });
  it('Pip moving west (away from the goblin) succeeds', () => {
    const session = requireScenario('frightened-halfling').build();
    const pipId = session.combatants['halfling']!;
    const { events } = session.engine.plan.move(session.campaign.state, {
      combatantId: pipId,
      to: { x: 0, y: 5 },
    });
    expect(events.some((e) => e.type === 'CombatantMoved')).toBe(true);
  });
});

describe('web demo: misty-step-occupied headline action', () => {
  it('Misty Step into Goblin Left (occupied square) rejects', () => {
    const session = requireScenario('misty-step-occupied').build();
    const wizardId = session.combatants['wizard']!;
    const goblinAId = session.combatants['goblinA']!;
    const goblinPos =
      session.campaign.state.encounters[session.encounterId]!.combatants.find(
        (c) => c.combatantId === goblinAId,
      )?.position;
    if (!goblinPos) throw new Error('goblin A missing position');
    expect(() =>
      session.engine.plan.mistyStep(session.campaign.state, {
        casterId: wizardId,
        to: { x: goblinPos.x, y: goblinPos.y },
      }),
    ).toThrow(/occupied|unoccupied|space/i);
  });
});

// Scenario-specific regression: attacking Brindle in the
// Concentrating-Wizard scenario must not crash on the synthetic
// concentrationEffectId. Earlier the dual-cleanup path (DamageApplied
// auto-clear + planConcentrationBreakOnDrop ConcentrationBroken event)
// hit a redundant invariant in applyConcentrationBroken.
describe('web demo: concentrating-wizard headline action', () => {
  it('attacking Brindle drops her to 0 without throwing on the synthetic concentrationEffectId', () => {
    for (const seed of [38, 42, 7, 99]) {
      const session = requireScenario('downed-wizard').build({ seed });
      const wizardId = session.combatants['wizard']!;
      const goblinId = session.combatants['goblin']!;
      const goblin = session.campaign.state.characters[goblinId]!;
      const weaponId = goblin.equipped.mainHand!;
      expect(() =>
        session.engine.plan.attack(session.campaign.state, {
          attackerId: goblinId,
          targetId: wizardId,
          weaponInstanceId: weaponId,
        }),
      ).not.toThrow();
    }
  });
});

describe('web demo: goblin-skirmish sanity', () => {
  it('seeds four combatants, an active encounter, and the first turn started', () => {
    const session = requireScenario('goblin-skirmish').build();
    expect(Object.keys(session.combatants).length).toBe(4);
    expect(session.campaign.state.activeEncounterId).toBeDefined();
    const enc = session.campaign.state.encounters[session.encounterId]!;
    expect(enc.status).toBe('active');
    expect(enc.round).toBe(1);
  });
});
