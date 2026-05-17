import { z } from 'zod';
import { ULIDSchema } from '../primitives.js';

// Slice 137: an active illusion created by Silent Image, Major
// Image, or future illusion spells. Modeled on the slice-94 Trap
// and slice-135 Sensor entity shapes: an opaque labeled artifact
// in state that consumers / DMs interact with narratively, with
// the engine tracking the few pieces of mechanical state that
// matter (the DC for investigation checks, the concentration link
// for cleanup, and the set of creatures who have disbelieved).
//
// RAW 2024 illusions (Silent Image, Major Image, similar): a
// creature that uses the Study action on the image rolls an
// Investigation check against the caster's spell save DC. On a
// success, the creature recognizes the illusion as false. The
// engine tracks which creatures have passed that check via the
// `disbelievedBy` list; consumers can gate narrative on this set
// (e.g. "creatures who disbelieve see through the illusion").

export const ILLUSION_KINDS = ['visual', 'audiovisual'] as const;
export const IllusionKindSchema = z.enum(ILLUSION_KINDS);
export type IllusionKind = z.infer<typeof IllusionKindSchema>;

export const IllusionSchema = z.object({
  id: ULIDSchema,
  // Free-text label for consumers ("Looming Owlbear", "Wall of
  // Flame"). Display-only.
  label: z.string(),
  // Free-text location of the illusion (the engine doesn't model
  // remote position outside encounters). Consumer territory.
  location: z.string(),
  // 'visual': sight-only (Silent Image). 'audiovisual': sight,
  // sound, smell, temperature (Major Image and similar). Future
  // spells can extend the enum.
  kind: IllusionKindSchema,
  casterId: ULIDSchema,
  sourceSpellId: z.string(),
  sourceEffectInstanceId: ULIDSchema.optional(),
  // The caster's spell save DC at cast time, baked here so any
  // future investigation check rolls against a stable target
  // even if the caster's stats change later. Mirrors the Trap
  // pre-bake pattern from slice 94.
  investigationDC: z.number().int().min(1),
  // Creature ids that have successfully passed an Investigation
  // check against this illusion. The engine doesn't itself act
  // on this list; it surfaces it so consumers (DMs / VTTs) can
  // describe what those creatures see and gate narrative on it.
  disbelievedBy: z.array(ULIDSchema).default([]),
});
export type Illusion = z.infer<typeof IllusionSchema>;
