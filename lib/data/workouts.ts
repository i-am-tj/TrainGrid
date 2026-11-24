import { z } from "zod";
import type { Json, Tables } from "@/lib/database.types";
import {
  EMPTY_ENTRIES,
  QUICK_WORKOUT_NAMES,
  WEIGHT_UNITS,
  latestPerformances,
  workoutEntriesSchema,
  workoutProgressSchema,
  type PreviousPerformance,
  type WeightUnit,
  type WorkoutEntries,
  type WorkoutLog,
  type WorkoutProgress,
} from "@/lib/workouts/model";
import { DataError, type Db } from "./model";
import { categorySchema, idSchema, isoDateSchema } from "./schemas";
import { validate } from "./validate";

/**
 * The signed-in member's workout logs: one per scheduled session.
 *
 * Every query is narrowed to `user_id = userId` here AND restricted by Row
 * Level Security (own rows, active membership). The two database functions
 * (start_quick_workout, finish_workout) run as the caller under the same
 * policies and act only on the caller's rows. `userId` comes from the
 * verified session only. The owner is never written from here: the column
 * defaults to the caller in the database.
 */

const LOG_COLUMNS = "id, session_id, status, started_at, finished_at, unit, entries, notes, updated_at, saved_by";

type LogRow = Pick<
  Tables<"workout_logs">,
  "id" | "session_id" | "status" | "started_at" | "finished_at" | "unit" | "entries" | "notes" | "updated_at"
> &
  // Read for the workout screen; the data export leaves it out.
  Partial<Pick<Tables<"workout_logs">, "saved_by">>;

const NOT_FOUND = () => new DataError("not_found", "Workout not found.");

/**
 * The workout was saved from another device after this one last saw it.
 * Carries that newer version, so the member can choose which one to keep.
 */
export class WorkoutConflictError extends Error {
  constructor(readonly latest: WorkoutLog) {
    super("The workout was changed on another device.");
    this.name = "WorkoutConflictError";
  }
}

/**
 * How a write checks that it is not overwriting another device's save.
 *
 *   expectedUpdatedAt  the log's version (`updated_at`) as the device last saw it
 *   device             the device's own random id, recorded as `saved_by`
 *
 * The write applies if the log is still at that version, or if this device
 * made the last save (its own save whose reply was lost). Otherwise it throws
 * WorkoutConflictError with the newer log. The app always sends both; leaving
 * them out writes unconditionally.
 */
export type WriteCheck = { expectedUpdatedAt?: unknown; device?: unknown };

/** A version the server handed out (`updated_at`), sent back unchanged. It goes into a filter, so only this shape. */
const versionSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/, "Unknown version.");

function writeCheck(raw: WriteCheck | undefined): { expected?: string; device?: string } {
  return {
    expected: raw?.expectedUpdatedAt === undefined ? undefined : validate(versionSchema, raw.expectedUpdatedAt),
    device: raw?.device === undefined ? undefined : validate(idSchema, raw.device),
  };
}

/** After a refused write: the log as it is now, or not found. */
async function conflictOrNotFound(db: Db, userId: string, id: string): Promise<never> {
  const latest = await getWorkoutLog(db, userId, id);
  if (!latest) throw NOT_FOUND();
  throw new WorkoutConflictError(latest);
}

function entriesFromJson(value: Json): WorkoutEntries {
  const parsed = workoutEntriesSchema.safeParse(value);
  // A log that no longer reads is shown as empty rather than breaking the page.
  return parsed.success ? parsed.data : EMPTY_ENTRIES;
}

function entriesToJson(entries: WorkoutEntries): NonNullable<Json> {
  return entries as unknown as NonNullable<Json>;
}

function unitOf(value: string): WeightUnit {
  return value === "lb" ? "lb" : "kg";
}

export function logFromRow(row: LogRow): WorkoutLog {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status === "completed" ? "completed" : "in_progress",
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    unit: unitOf(row.unit),
    entries: entriesFromJson(row.entries),
    notes: row.notes,
    updatedAt: row.updated_at,
    ...(row.saved_by === undefined ? {} : { savedBy: row.saved_by }),
  };
}

function sessionId(raw: unknown): string {
  const id = idSchema.safeParse(raw);
  if (!id.success) throw NOT_FOUND();
  return id.data;
}

export async function getWorkoutLog(db: Db, userId: string, rawSessionId: unknown): Promise<WorkoutLog | null> {
  const id = idSchema.safeParse(rawSessionId);
  if (!id.success) return null;
  const { data, error } = await db
    .from("workout_logs")
    .select(LOG_COLUMNS)
    .eq("session_id", id.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not load the workout.");
  return data ? logFromRow(data) : null;
}

/**
 * Starts the workout for one of the member's sessions, or returns the one
 * already started (a second tap, or another device). The insert policy
 * refuses a session that is not the caller's own.
 */
export async function startWorkout(
  db: Db,
  userId: string,
  rawSessionId: unknown,
  input: WorkoutProgress,
  rawDevice?: unknown,
): Promise<WorkoutLog> {
  const id = sessionId(rawSessionId);
  const parsed = validate(workoutProgressSchema, input);
  const { device } = writeCheck({ device: rawDevice });

  const existing = await getWorkoutLog(db, userId, id);
  if (existing) return existing;

  const { data, error } = await db
    .from("workout_logs")
    .insert({
      session_id: id,
      unit: parsed.unit,
      entries: entriesToJson(parsed.entries),
      notes: parsed.notes,
      ...(device === undefined ? {} : { saved_by: device }),
    })
    .select(LOG_COLUMNS)
    .single();
  if (error) {
    // Started at the same moment elsewhere: use that one.
    if (error.code === "23505") {
      const raced = await getWorkoutLog(db, userId, id);
      if (raced) return raced;
    }
    // The policy refuses sessions that are not the member's own.
    if (error.code === "42501") throw NOT_FOUND();
    throw new Error("Could not start the workout.");
  }
  return logFromRow(data);
}

/**
 * Saves progress (sets, unit, notes). Returns the new version (`updated_at`).
 * With `check`, refuses to overwrite another device's newer save (WriteCheck).
 */
export async function saveWorkout(
  db: Db,
  userId: string,
  rawSessionId: unknown,
  input: WorkoutProgress,
  check?: WriteCheck,
): Promise<string> {
  const id = sessionId(rawSessionId);
  const parsed = validate(workoutProgressSchema, input);
  const { expected, device } = writeCheck(check);
  let query = db
    .from("workout_logs")
    .update({
      unit: parsed.unit,
      entries: entriesToJson(parsed.entries),
      notes: parsed.notes,
      ...(device === undefined ? {} : { saved_by: device }),
    })
    .eq("session_id", id)
    .eq("user_id", userId);
  if (expected !== undefined) {
    // Both values are validated above (a timestamp and a uuid), so they are safe in the filter.
    query = device === undefined
      ? query.eq("updated_at", expected)
      : query.or(`updated_at.eq."${expected}",saved_by.eq.${device}`);
  }
  const { data, error } = await query.select("updated_at").maybeSingle();
  if (error) throw new Error("Could not save the workout.");
  if (!data) {
    if (expected !== undefined) return conflictOrNotFound(db, userId, id);
    throw NOT_FOUND();
  }
  return data.updated_at;
}

const quickNameSchema = z.string().trim().min(1, "Name your workout.").max(200, "Keep the name to 200 characters.");

/**
 * Saves the final state and marks the workout completed, in one call to the
 * database. `finishedAt` is the moment the member tapped Finish (it may reach
 * the server later, after a dropped connection); the database keeps it within
 * (started, now]. Finishing again after editing keeps the first finish time.
 *
 * For a quick workout, `name` is the name given at the finish: the session
 * takes it and the time actually trained in the same transaction, so a
 * workout is never left finished under its placeholder name (F18).
 *
 * With `check`, a log saved from another device since is not finished, and
 * WorkoutConflictError carries it (WriteCheck).
 */
export async function finishWorkout(
  db: Db,
  userId: string,
  rawSessionId: unknown,
  input: WorkoutProgress,
  rawFinishedAt: unknown,
  rawName?: unknown,
  check?: WriteCheck,
): Promise<WorkoutLog> {
  const id = sessionId(rawSessionId);
  const parsed = validate(workoutProgressSchema, input);
  const name = rawName === undefined ? undefined : validate(quickNameSchema, rawName);
  const { expected, device } = writeCheck(check);
  const requested = typeof rawFinishedAt === "string" ? Date.parse(rawFinishedAt) : Number.NaN;

  const { data, error } = await db
    .rpc("finish_workout", {
      p_session_id: id,
      p_unit: parsed.unit,
      p_entries: entriesToJson(parsed.entries),
      p_notes: parsed.notes,
      // Unreadable: now. The database keeps it within (started, now] either way.
      p_finished_at: new Date(Number.isFinite(requested) ? requested : Date.now()).toISOString(),
      ...(name === undefined ? {} : { p_name: name }),
      ...(expected === undefined ? {} : { p_expected_updated_at: expected }),
      ...(device === undefined ? {} : { p_device: device }),
    })
    .maybeSingle();
  if (error) {
    if (error.code === "P0002") throw NOT_FOUND();
    if (error.code === "40001") return conflictOrNotFound(db, userId, id);
    throw new Error("Could not finish the workout.");
  }
  if (!data) throw NOT_FOUND();
  return logFromRow(data);
}

/**
 * Starts a quick workout: a session for `date` (the member's today) with no
 * plan, marked quick, and its workout already under way, created together in
 * one transaction. Returns the session id. Exercises are added during the
 * workout; it is named at the finish.
 *
 * `requestId` becomes the session id. Sending the same request again (a
 * double submit, a retry after the response was lost) returns that same
 * workout rather than starting a second one (F18). Without one, a new id is
 * made here.
 */
export async function startQuickWorkout(
  db: Db,
  userId: string,
  input: { category: unknown; date: unknown; unit: unknown; requestId?: unknown },
): Promise<string> {
  const category = validate(categorySchema, input.category);
  const date = validate(isoDateSchema, input.date);
  const unit = WEIGHT_UNITS.includes(input.unit as WeightUnit) ? (input.unit as WeightUnit) : "kg";
  const requested = idSchema.safeParse(input.requestId);
  const id = requested.success ? requested.data : crypto.randomUUID();
  const { data, error } = await db.rpc("start_quick_workout", {
    p_session_id: id,
    p_date: date,
    p_category: category,
    p_name: QUICK_WORKOUT_NAMES[category],
    p_unit: unit,
    p_entries: entriesToJson(EMPTY_ENTRIES),
  });
  if (error) {
    // The id belongs to something that is not this member's quick session.
    if (error.code === "P0002") throw NOT_FOUND();
    throw new Error("Could not start the workout.");
  }
  return data;
}

/** Discards the workout log. The planned session is untouched. */
export async function discardWorkout(db: Db, userId: string, rawSessionId: unknown): Promise<void> {
  const id = sessionId(rawSessionId);
  const { error } = await db.from("workout_logs").delete().eq("session_id", id).eq("user_id", userId);
  if (error) throw new Error("Could not discard the workout.");
}

/** How many recent completed workouts "last time" looks back over. */
const HISTORY_LIMIT = 40;

/**
 * The member's latest completed performance of each exercise name, from
 * their recent completed workouts other than this session's.
 */
export async function recentPerformances(
  db: Db,
  userId: string,
  excludeSessionId: string,
): Promise<Map<string, PreviousPerformance>> {
  const { data, error } = await db
    .from("workout_logs")
    .select("session_id, finished_at, unit, entries")
    .eq("user_id", userId)
    .eq("status", "completed")
    .neq("session_id", excludeSessionId)
    .order("finished_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error("Could not load your history.");
  return latestPerformances(
    data.map((row) => ({
      finishedAt: row.finished_at ?? "",
      unit: unitOf(row.unit),
      entries: entriesFromJson(row.entries),
    })),
  );
}
