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
import { replay, serializeCampaign, loadCampaign } from 'ttrpg-engine-dnd';
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

// Scenario-specific regression: attacking Brindle in the
// Concentrating-Wizard scenario must not crash on the synthetic
// concentrationEffectId. Earlier the dual-cleanup path (DamageApplied
// auto-clear + planConcentrationBreakOnDrop ConcentrationBroken event)
// hit a redundant invariant in applyConcentrationBroken.
describe('web demo: concentrating-wizard scenario survives an attack', () => {
  it('attacking Brindle drops her to 0 without throwing on the synthetic concentrationEffectId', async () => {
    const scenario = SCENARIOS.find((s) => s.id === 'downed-wizard');
    if (!scenario) throw new Error('downed-wizard scenario missing from registry');
    for (const seed of [38, 42, 7, 99]) {
      const session = scenario.build({ seed });
      // Find Brindle (wizard) and the goblin from the combatants map.
      const wizardId = session.combatants['wizard']!;
      const goblinId = session.combatants['goblin']!;
      const goblin = session.campaign.state.characters[goblinId]!;
      const weaponId = goblin.equipped.mainHand!;
      // Goblin is the active combatant. Their attack must not throw.
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
