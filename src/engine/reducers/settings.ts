import type { Draft } from 'immer';
import type { CampaignState } from '../../schemas/runtime/campaign.js';
import type { CampaignSettingsChangedEvent } from '../../schemas/events/settings.js';

export const applyCampaignSettingsChanged = (
  state: Draft<CampaignState>,
  event: CampaignSettingsChangedEvent,
): void => {
  const s = state.settings;
  if (event.grittyRest !== undefined) s.grittyRest = event.grittyRest;
  if (event.heroPoints !== undefined) s.heroPoints = event.heroPoints;
  if (event.sanity !== undefined) s.sanity = event.sanity;
  if (event.massCombat !== undefined) s.massCombat = event.massCombat;
  if (event.feaCharacterFlaws !== undefined) s.feaCharacterFlaws = event.feaCharacterFlaws;
  if (event.customHouserulesAdd !== undefined) {
    for (const r of event.customHouserulesAdd) {
      if (!s.customHouserules.includes(r)) s.customHouserules.push(r);
    }
  }
  if (event.customHouserulesRemove !== undefined) {
    s.customHouserules = s.customHouserules.filter((r) => !event.customHouserulesRemove!.includes(r));
  }
};
