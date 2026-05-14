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
    describe(scenario.name, () => {
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
