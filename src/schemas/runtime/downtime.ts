import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';
import { DowntimeKindSchema, DowntimeOutcomeSchema } from '../events/downtime.js';

export const DowntimeLogEntrySchema = z.object({
  characterId: ULIDSchema,
  kind: DowntimeKindSchema,
  days: z.number().int().min(1),
  outcome: DowntimeOutcomeSchema,
  summary: z.string(),
  atIso: z.string(),
  producedItemDefinitionId: z.string().optional(),
  toolProficiencyGained: z.string().optional(),
});
export type DowntimeLogEntry = z.infer<typeof DowntimeLogEntrySchema>;
