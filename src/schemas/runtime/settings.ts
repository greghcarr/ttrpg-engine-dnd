import { z } from 'zod';

export const CampaignSettingsSchema = z.object({
  grittyRest: z.boolean().default(false),
  heroPoints: z.boolean().default(false),
  sanity: z.boolean().default(false),
  massCombat: z.boolean().default(false),
  feaCharacterFlaws: z.boolean().default(false),
  customHouserules: z.array(z.string()).default([]),
});
export type CampaignSettings = z.infer<typeof CampaignSettingsSchema>;

export const defaultCampaignSettings = (): CampaignSettings => ({
  grittyRest: false,
  heroPoints: false,
  sanity: false,
  massCombat: false,
  feaCharacterFlaws: false,
  customHouserules: [],
});
