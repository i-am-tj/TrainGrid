"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DataError } from "@/lib/data/model";
import { memberData } from "@/lib/data/server";
import { deleteSession, getSession } from "@/lib/data/sessions";
import {
  WorkoutConflictError,
  discardWorkout,
  finishWorkout,
  saveWorkout,
  startQuickWorkout,
  startWorkout,
} from "@/lib/data/workouts";
import { getRequestToday } from "@/lib/today";
import type { WorkoutLog, WorkoutProgress } from "./model";

/**
 * The workout screen's mutations. Called from event handlers, so each
 * returns a result instead of throwing: a dropped connection in the gym must
 * never become an error page. Every call starts from memberData() (the
 * verified member and their own client); the data layer validates the input
 * and Row Level Security checks ownership again.
 */

export type WorkoutActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "invalid" | "not_found" | "failed" }
  /** Saved from another device since this one last saw it; `latest` is that version. */
  | { ok: false; reason: "conflict"; latest: WorkoutLog };

async function attempt<T>(run: () => Promise<T>): Promise<WorkoutActionResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof WorkoutConflictError) return { ok: false, reason: "conflict", latest: error.latest };
    if (error instanceof DataError) return { ok: false, reason: error.code === "unavailable" ? "failed" : error.code };
    // memberData() redirects a signed-out visitor; let Next handle that.
    if (error instanceof Error && "digest" in error) throw error;
    console.error("workout action failed", { message: error instanceof Error ? error.message : "unknown" });
    return { ok: false, reason: "failed" };
  }
}

function revalidateMemberPages() {
  revalidatePath("/", "layout");
}

export async function startWorkoutAction(
  sessionId: string,
  progress: WorkoutProgress,
  device: string,
): Promise<WorkoutActionResult<WorkoutLog>> {
  const { db, userId } = await memberData();
  const result = await attempt(() => startWorkout(db, userId, sessionId, progress, device));
  if (result.ok) revalidateMemberPages();
  return result;
}

/** The version this device last saw and its own id: see WriteCheck. */
export type WorkoutWriteCheck = { expectedUpdatedAt: string; device: string };

/**
 * Saves progress unless another device saved since this one last saw the log.
 * Returns the new version, or a conflict with the newer log. A missing check
 * is refused as invalid, never treated as "overwrite".
 */
export async function saveWorkoutAction(
  sessionId: string,
  progress: WorkoutProgress,
  check: WorkoutWriteCheck,
): Promise<WorkoutActionResult<string>> {
  const { db, userId } = await memberData();
  return attempt(() => saveWorkout(db, userId, sessionId, progress, required(check)));
}

/** From the client, so possibly missing: null fields fail validation. */
function required(check: WorkoutWriteCheck | undefined) {
  return { expectedUpdatedAt: check?.expectedUpdatedAt ?? null, device: check?.device ?? null };
}

/**
 * Finishes the workout. For a quick workout, `name` is the name the member
 * gave it at the finish, and the session records the time actually trained,
 * in the same transaction as the finish. Like a save, it does not overwrite
 * another device's newer save.
 */
export async function finishWorkoutAction(
  sessionId: string,
  progress: WorkoutProgress,
  finishedAt: string,
  check: WorkoutWriteCheck,
  name?: string,
): Promise<WorkoutActionResult<WorkoutLog>> {
  const { db, userId } = await memberData();
  const result = await attempt(() => finishWorkout(db, userId, sessionId, progress, finishedAt, name, required(check)));
  if (result.ok) revalidateMemberPages();
  return result;
}

/**
 * "Start a workout" on Home: a quick session for the member's today, with its
 * workout already started, then straight into the workout screen. Only the
 * type, the weight unit this phone uses and the request id (so a resent
 * form returns the same workout) come from the form.
 */
export async function startQuickWorkoutAction(form: FormData) {
  const { db, userId } = await memberData();
  const today = await getRequestToday();
  const sessionId = await startQuickWorkout(db, userId, {
    category: form.get("category"),
    date: today.date,
    unit: form.get("unit"),
    requestId: form.get("request"),
  });
  revalidateMemberPages();
  redirect(`/workout/${sessionId}`);
}

/**
 * Discards the workout. A planned session stays on the calendar; a quick one
 * existed only for this workout, so it goes too (its log with it).
 */
export async function discardWorkoutAction(sessionId: string): Promise<WorkoutActionResult<null>> {
  const { db, userId } = await memberData();
  const result = await attempt(async () => {
    const session = await getSession(db, userId, sessionId);
    if (session?.origin === "quick") await deleteSession(db, userId, sessionId);
    else await discardWorkout(db, userId, sessionId);
    return null;
  });
  if (result.ok) revalidateMemberPages();
  return result;
}
