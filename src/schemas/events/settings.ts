import { z } from 'zod';
import { EventEnvelopeSchema } from './envelope.js';

export const CampaignSettingsChangedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('CampaignSettingsChanged'),
  grittyRest: z.boolean().optional(),
  heroPoints: z.boolean().optional(),
  sanity: z.boolean().optional(),
  massCombat: z.boolean().optional(),
  feaCharacterFlaws: z.boolean().optional(),
  customHouserulesAdd: z.array(z.string()).optional(),
  customHouserulesRemove: z.array(z.string()).optional(),
});
export type CampaignSettingsChangedEvent = z.infer<typeof CampaignSettingsChangedEventSchema>;
