import { addDays, weekDateRange, weeksBetween } from "@/lib/calendar-date";
import type { Json } from "@/lib/database.types";
import {
  copySnapshot,
  parseSnapshot,
  snapshotToJson,
  sessionFromRow,
  snapshotFromInputItems,
  snapshotFromRoutineItems,
} from "./mappers";
import { DataError, type Db, type ScheduledSessionRecord } from "./model";
import { getRoutine } from "./routines";
import {
  adhocSessionInputSchema,
  duplicateWeekInputSchema,
  idSchema,
  scheduleRoutineInputSchema,
  sessionDetailsInputSchema,
  sessionItemsInputSchema,
  weekIdSchema,
  type AdhocSessionInput,
  type DuplicateWeekInput,
  type ScheduleRoutineInput,
  type SessionDetailsInput,
  type WorkoutItemInput,
} from "./schemas";
import { validate } from "./validate";

/**
 * The signed-in user's calendar.
 *
 * Every query is narrowed to `user_id = userId` here AND restricted to the
 * same rows by Row Level Security. `userId` must come from the verified
 * session; no function accepts an owner from request input.
 *
 * A scheduled session is a snapshot (D-03): its workout is copied in when it
 * is created and never read from the routine again.
 */

const SESSION_COLUMNS =
  "id, date, start_time, name, category, duration_minutes, notes, source_routine_id, snapshot";

const NOT_FOUND = () => new DataError("not_found", "Session not found.");

export async function listSessionsForWeek(
  db: Db,
  userId: string,
  rawWeekId: unknown,
): Promise<ScheduledSessionRecord[]> {
  const weekId = validate(weekIdSchema, rawWeekId);
  const { start, end } = weekDateRange(weekId);
  const { data, error } = await db
    .from("scheduled_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end)
    .order("date")
    .order("start_time", { nullsFirst: true })
    .order("created_at");
  if (error) throw new Error("Could not load the week.");
  return data.map(sessionFromRow);
}

export async function getSession(
  db: Db,
  userId: string,
  rawId: unknown,
): Promise<ScheduledSessionRecord | null> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return null;
  const { data, error } = await db
    .from("scheduled_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", id.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not load the session.");
  return data ? sessionFromRow(data) : null;
}

/** Puts a routine on the calendar as a snapshot of its current items. */
export async function scheduleRoutine(
  db: Db,
  userId: string,
  input: ScheduleRoutineInput,
): Promise<ScheduledSessionRecord> {
  const parsed = validate(scheduleRoutineInputSchema, input);
  const routine = await getRoutine(db, userId, parsed.routineId);
  if (!routine) throw new DataError("not_found", "Routine not found.");

  return insertSession(db, {
    user_id: userId,
    date: parsed.date,
    start_time: parsed.startTime,
    name: parsed.name ?? routine.name,
    category: routine.category,
    duration_minutes: parsed.durationMinutes,
    notes: parsed.notes,
    source_routine_id: routine.id,
    snapshot: snapshotToJson(snapshotFromRoutineItems(routine.items)),
  });
}

/** A one-off session with its own items. */
export async function createAdhocSession(
  db: Db,
  userId: string,
  input: AdhocSessionInput,
): Promise<ScheduledSessionRecord> {
  const parsed = validate(adhocSessionInputSchema, input);
  return insertSession(db, {
    user_id: userId,
    date: parsed.date,
    start_time: parsed.startTime,
    name: parsed.name,
    category: parsed.category,
    duration_minutes: parsed.durationMinutes,
    notes: parsed.notes,
    source_routine_id: null,
    snapshot: snapshotToJson(snapshotFromInputItems(parsed.items)),
  });
}

/** Renames or reschedules one session. Its workout content is untouched. */
export async function updateSessionDetails(
  db: Db,
  userId: string,
  rawId: unknown,
  input: SessionDetailsInput,
): Promise<ScheduledSessionRecord> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) throw NOT_FOUND();
  const parsed = validate(sessionDetailsInputSchema, input);

  const { data, error } = await db
    .from("scheduled_sessions")
    .update({
      date: parsed.date,
      start_time: parsed.startTime,
      name: parsed.name,
      category: parsed.category,
      duration_minutes: parsed.durationMinutes,
      notes: parsed.notes,
    })
    .eq("id", id.data)
    .eq("user_id", userId)
    .select(SESSION_COLUMNS)
    .maybeSingle();
  if (error) throw new Error("Could not update the session.");
  if (!data) throw NOT_FOUND();
  return sessionFromRow(data);
}

/** Replaces the workout of one occurrence. The routine and other sessions are untouched. */
export async function replaceSessionItems(
  db: Db,
  userId: string,
  rawId: unknown,
  items: WorkoutItemInput[],
): Promise<ScheduledSessionRecord> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) throw NOT_FOUND();
  const parsedItems = validate(sessionItemsInputSchema, items);

  const { data: row, error: readError } = await db
    .from("scheduled_sessions")
    .select("snapshot")
    .eq("id", id.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error("Could not load the session.");
  if (!row) throw NOT_FOUND();

  const snapshot = snapshotFromInputItems(parsedItems, parseSnapshot(row.snapshot));
  const { data, error } = await db
    .from("scheduled_sessions")
    .update({ snapshot: snapshotToJson(snapshot) })
    .eq("id", id.data)
    .eq("user_id", userId)
    .select(SESSION_COLUMNS)
    .maybeSingle();
  if (error) throw new Error("Could not update the session.");
  if (!data) throw NOT_FOUND();
  return sessionFromRow(data);
}

export async function deleteSession(db: Db, userId: string, rawId: unknown): Promise<void> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) throw NOT_FOUND();
  const { data, error } = await db
    .from("scheduled_sessions")
    .delete()
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error("Could not delete the session.");
  if (data.length === 0) throw NOT_FOUND();
}

/**
 * Copies the caller's sessions from one week into another, shifted by whole
 * weeks, as new snapshots with new ids. Existing sessions in the destination
 * week are kept. Returns how many sessions were copied.
 */
export async function duplicateWeek(
  db: Db,
  userId: string,
  input: DuplicateWeekInput,
): Promise<number> {
  const { sourceWeekId, destWeekId } = validate(duplicateWeekInputSchema, input);
  const { start, end } = weekDateRange(sourceWeekId);
  const shift = weeksBetween(sourceWeekId, destWeekId) * 7;

  const { data, error } = await db
    .from("scheduled_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);
  if (error) throw new Error("Could not load the week.");
  if (data.length === 0) return 0;

  const copies = data.map((row) => ({
    user_id: userId,
    date: addDays(row.date, shift),
    start_time: row.start_time,
    name: row.name,
    category: row.category,
    duration_minutes: row.duration_minutes,
    notes: row.notes,
    source_routine_id: row.source_routine_id,
    snapshot: snapshotToJson(copySnapshot(parseSnapshot(row.snapshot))),
  }));

  // One statement, so the copy is all or nothing.
  const { error: insertError } = await db.from("scheduled_sessions").insert(copies);
  if (insertError) throw new Error("Could not duplicate the week.");
  return copies.length;
}

type SessionInsert = {
  user_id: string;
  date: string;
  start_time: string | null;
  name: string;
  category: string;
  duration_minutes: number | null;
  notes: string;
  source_routine_id: string | null;
  snapshot: NonNullable<Json>;
};

async function insertSession(db: Db, row: SessionInsert): Promise<ScheduledSessionRecord> {
  const { data, error } = await db
    .from("scheduled_sessions")
    .insert(row)
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw new Error("Could not save the session.");
  return sessionFromRow(data);
}
