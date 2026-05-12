import type { Campaign } from './commit.js';
import { replay } from './replay.js';

export const undo = (campaign: Campaign): Campaign => {
  if (campaign.cursor === 0) return campaign;
  const cursor = campaign.cursor - 1;
  const replayedEvents = campaign.events.slice(0, cursor);
  return {
    ...campaign,
    state: replay(replayedEvents),
    cursor,
  };
};

export const redo = (campaign: Campaign): Campaign => {
  if (campaign.cursor >= campaign.events.length) return campaign;
  const cursor = campaign.cursor + 1;
  const replayedEvents = campaign.events.slice(0, cursor);
  return {
    ...campaign,
    state: replay(replayedEvents),
    cursor,
  };
};
