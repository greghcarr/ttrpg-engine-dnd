import { describe, expect, it } from 'vitest';
import { apply } from '../../../src/engine/apply.js';
import { emptyCampaignState } from '../../../src/schemas/runtime/campaign.js';
import { eventId, isoTimestamp } from '../../fixtures/index.js';
import type { CampaignSettingsChangedEvent } from '../../../src/schemas/events/settings.js';

const evt = <T extends { id: string; at: string }>(e: Omit<T, 'id' | 'at'>): T =>
  ({ id: eventId(), at: isoTimestamp(), ...e }) as T;

describe('reducer: campaign settings', () => {
  it('starts with all toggles off and no houserules', () => {
    const s = emptyCampaignState();
    expect(s.settings.grittyRest).toBe(false);
    expect(s.settings.heroPoints).toBe(false);
    expect(s.settings.customHouserules).toEqual([]);
  });

  it('flips multiple toggles in a single event', () => {
    let s = emptyCampaignState();
    s = apply(
      s,
      evt<CampaignSettingsChangedEvent>({
        type: 'CampaignSettingsChanged',
        grittyRest: true,
        heroPoints: true,
        massCombat: true,
      }),
    );
    expect(s.settings.grittyRest).toBe(true);
    expect(s.settings.heroPoints).toBe(true);
    expect(s.settings.massCombat).toBe(true);
    expect(s.settings.sanity).toBe(false);
  });

  it('adds and removes custom houserules', () => {
    let s = emptyCampaignState();
    s = apply(
      s,
      evt<CampaignSettingsChangedEvent>({
        type: 'CampaignSettingsChanged',
        customHouserulesAdd: ['critical-fumble', 'inspiration-on-nat-1', 'no-multiclassing'],
      }),
    );
    expect(s.settings.customHouserules).toEqual(['critical-fumble', 'inspiration-on-nat-1', 'no-multiclassing']);
    s = apply(
      s,
      evt<CampaignSettingsChangedEvent>({
        type: 'CampaignSettingsChanged',
        customHouserulesRemove: ['critical-fumble'],
      }),
    );
    expect(s.settings.customHouserules).toEqual(['inspiration-on-nat-1', 'no-multiclassing']);
  });

  it('dedupes when adding an existing houserule', () => {
    let s = emptyCampaignState();
    s = apply(
      s,
      evt<CampaignSettingsChangedEvent>({
        type: 'CampaignSettingsChanged',
        customHouserulesAdd: ['critical-fumble'],
      }),
    );
    s = apply(
      s,
      evt<CampaignSettingsChangedEvent>({
        type: 'CampaignSettingsChanged',
        customHouserulesAdd: ['critical-fumble'],
      }),
    );
    expect(s.settings.customHouserules).toEqual(['critical-fumble']);
  });
});
