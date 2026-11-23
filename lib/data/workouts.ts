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
 * Level Security (own rows, active membership). `userId` comes from the
 * verified session only. The owner is never written from here: the column
 * defaults to the caller in the database.
 */

const LOG_COLUMNS = "id, session_id, status, started_at, finished_at, unit, entries, notes, updated_at";

type LogRow = Pick<
  Tables<"workout_logs">,
  "id" | "session_id" | "status" | "started_at" | "finished_at" | "unit" | "entries" | "notes" | "updated_at"
>;

const NOT_FOUND = () => new DataError("not_found", "Workout not found.");

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
): Promise<WorkoutLog> {
  const id = sessionId(rawSessionId);
  const parsed = validate(workoutProgressSchema, input);

  const existing = await getWorkoutLog(db, userId, id);
  if (existing) return existing;

  const { data, error } = await db
    .from("workout_logs")
    .insert({ session_id: id, unit: parsed.unit, entries: entriesToJson(parsed.entries), notes: parsed.notes })
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

/** Saves progress (sets, unit, notes). Returns when it was saved. */
export async function saveWorkout(
  db: Db,
  userId: string,
  rawSessionId: unknown,
  input: WorkoutProgress,
): Promise<string> {
  const id = sessionId(rawSessionId);
  const parsed = validate(workoutProgressSchema, input);
  const { data, error } = await db
    .from("workout_logs")
    .update({ unit: parsed.unit, entries: entriesToJson(parsed.entries), notes: parsed.notes })
    .eq("session_id", id)
    .eq("user_id", userId)
    .select("updated_at")
    .maybeSingle();
  if (error) throw new Error("Could not save the workout.");
  if (!data) throw NOT_FOUND();
  return data.updated_at;
}

/**
 * Saves the final state and marks the workout completed. `finishedAt` is the
 * moment the member tapped Finish (it may reach the server later, after a
 * dropped connection); it is kept within [started, now]. Finishing again
 * after editing keeps the first finish time.
 */
export async function finishWorkout(
  db: Db,
  userId: string,
  rawSessionId: unknown,
  input: WorkoutProgress,
  rawFinishedAt: unknown,
): Promise<WorkoutLog> {
  const id = sessionId(rawSessionId);
  const parsed = validate(workoutProgressSchema, input);
  const current = await getWorkoutLog(db, userId, id);
  if (!current) throw NOT_FOUND();

  const now = Date.now();
  // The database keeps microseconds; a millisecond on is never before the start.
  const earliest = Date.parse(current.startedAt) + 1;
  const requested = typeof rawFinishedAt === "string" ? Date.parse(rawFinishedAt) : Number.NaN;
  const finished = Math.max(earliest, Number.isFinite(requested) ? Math.min(requested, now) : now);

  const { data, error } = await db
    .from("workout_logs")
    .update({
      unit: parsed.unit,
      entries: entriesToJson(parsed.entries),
      notes: parsed.notes,
      status: "completed",
      finished_at: current.finishedAt ?? new Date(finished).toISOString(),
    })
    .eq("session_id", id)
    .eq("user_id", userId)
    .select(LOG_COLUMNS)
    .maybeSingle();
  if (error) throw new Error("Could not finish the workout.");
  if (!data) throw NOT_FOUND();
  return logFromRow(data);
}

/**
 * Starts a quick workout: a session for `date` (the member's today) with no
 * plan, marked quick, and its workout already under way. Returns the session
 * id. Exercises are added during the workout; it is named at the finish.
 */
export async function startQuickWorkout(
  db: Db,
  userId: string,
  input: { category: unknown; date: unknown; unit: unknown },
): Promise<string> {
  const category = validate(categorySchema, input.category);
  const date = validate(isoDateSchema, input.date);
  const unit = WEIGHT_UNITS.includes(input.unit as WeightUnit) ? (input.unit as WeightUnit) : "kg";
  const { data, error } = await db
    .from("scheduled_sessions")
    .insert({
      user_id: userId,
      date,
      name: QUICK_WORKOUT_NAMES[category],
      category,
      origin: "quick",
      snapshot: { version: 1, items: [] },
    })
    .select("id")
    .single();
  if (error) throw new Error("Could not start the workout.");
  await startWorkout(db, userId, data.id, { unit, entries: EMPTY_ENTRIES, notes: "" });
  return data.id;
}

/**
 * Names a finished quick workout and records how long it took, so the
 * planner, Home and any post show what was actually done. Only quick sessions
 * are renamed this way; planned ones keep their name and planned duration.
 */
export async function nameQuickWorkout(
  db: Db,
  userId: string,
  rawSessionId: unknown,
  rawName: unknown,
  durationMinutes: number,
): Promise<void> {
  const id = sessionId(rawSessionId);
  const name = validate(z.string().trim().min(1, "Name your workout.").max(200, "Keep the name to 200 characters."), rawName);
  const { error } = await db
    .from("scheduled_sessions")
    .update({ name, duration_minutes: Math.min(1440, Math.max(1, Math.round(durationMinutes))) })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("origin", "quick");
  if (error) throw new Error("Could not name the workout.");
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
