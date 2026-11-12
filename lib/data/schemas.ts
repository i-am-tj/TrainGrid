import { z } from "zod";
import { isIsoDate, isRealWeekId } from "@/lib/calendar-date";
import { EQUIPMENT_TYPES, SESSION_TYPES } from "@/lib/domain";
import { isValidTime } from "@/lib/week";
import { parseYouTubeUrl } from "@/lib/youtube";

/**
 * Server-side validation for every mutation in the data layer. Client-side
 * checks are for convenience only; these are the ones that count.
 *
 * Length limits match the database check constraints, so a value that passes
 * here is also accepted by the database.
 */

export const MAX_ITEMS = 100;

const name = z.string().trim().min(1, "Name is required").max(200);
const optionalText = (max: number) => z.string().trim().max(max).default("");

export const idSchema = z.uuid();

export const categorySchema = z.enum(SESSION_TYPES);

export const equipmentSchema = z
  .array(z.enum(EQUIPMENT_TYPES))
  .max(EQUIPMENT_TYPES.length)
  .default([])
  .transform((values) => EQUIPMENT_TYPES.filter((id) => values.includes(id)));

/** Empty means "no video"; anything else must be a YouTube link, stored normalised. */
export const videoUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((value, ctx) => {
    if (!value) return null;
    const normalised = parseYouTubeUrl(value);
    if (!normalised) {
      ctx.addIssue({ code: "custom", message: "Video must be a YouTube link" });
      return z.NEVER;
    }
    return normalised;
  });

export const workoutItemInputSchema = z.object({
  /** Present when editing an existing item, so its id is kept. */
  id: idSchema.optional(),
  name,
  instruction: optionalText(2000),
  rest: optionalText(200),
  target: optionalText(200),
  notes: optionalText(4000),
  equipment: equipmentSchema,
  videoUrl: videoUrlSchema,
});

export type WorkoutItemInput = z.input<typeof workoutItemInputSchema>;

export const routineInputSchema = z.object({
  name,
  category: categorySchema,
  description: optionalText(2000),
  items: z.array(workoutItemInputSchema).max(MAX_ITEMS).default([]),
});

export type RoutineInput = z.input<typeof routineInputSchema>;

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: "Invalid date" });

/** Start times are on the hour or half hour, as the planner offers them. */
export const startTimeSchema = z
  .string()
  .nullish()
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") return null;
    if (!isValidTime(value)) {
      ctx.addIssue({ code: "custom", message: "Invalid time" });
      return z.NEVER;
    }
    return value;
  });

export const durationSchema = z
  .number()
  .int()
  .min(1)
  .max(1440)
  .nullish()
  .transform((value) => value ?? null);

export const weekIdSchema = z.string().refine(isRealWeekId, { message: "Invalid week" });

const sessionFields = {
  date: isoDateSchema,
  startTime: startTimeSchema,
  durationMinutes: durationSchema,
  notes: optionalText(4000),
};

/** Put a routine on the calendar; its items are copied into a snapshot. */
export const scheduleRoutineInputSchema = z.object({
  routineId: idSchema,
  /** Defaults to the routine's name. */
  name: name.optional(),
  ...sessionFields,
});

export type ScheduleRoutineInput = z.input<typeof scheduleRoutineInputSchema>;

/** A one-off session that does not come from a routine. */
export const adhocSessionInputSchema = z.object({
  name,
  category: categorySchema,
  ...sessionFields,
  items: z.array(workoutItemInputSchema).max(MAX_ITEMS).default([]),
});

export type AdhocSessionInput = z.input<typeof adhocSessionInputSchema>;

/** Rescheduling and renaming; the workout content is changed separately. */
export const sessionDetailsInputSchema = z.object({
  name,
  category: categorySchema,
  ...sessionFields,
});

export type SessionDetailsInput = z.input<typeof sessionDetailsInputSchema>;

export const sessionItemsInputSchema = z.array(workoutItemInputSchema).max(MAX_ITEMS);

export const duplicateWeekInputSchema = z
  .object({ sourceWeekId: weekIdSchema, destWeekId: weekIdSchema })
  .refine((value) => value.sourceWeekId !== value.destWeekId, {
    message: "Choose a different week",
  });

export type DuplicateWeekInput = z.input<typeof duplicateWeekInputSchema>;

/** The stored snapshot document (D-15). */
export const snapshotItemSchema = z.object({
  id: idSchema,
  source_item_id: idSchema.nullable(),
  name: z.string(),
  instruction: z.string(),
  rest: z.string(),
  target: z.string(),
  notes: z.string(),
  equipment: z.array(z.enum(EQUIPMENT_TYPES)),
  video_url: z.string().nullable(),
});

export const snapshotSchema = z.object({
  version: z.literal(1),
  items: z.array(snapshotItemSchema),
});

export type SnapshotItemDoc = z.infer<typeof snapshotItemSchema>;
export type SnapshotDoc = z.infer<typeof snapshotSchema>;
