"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DataError } from "@/lib/data/model";
import { memberData } from "@/lib/data/server";
import { deleteSession, getSession } from "@/lib/data/sessions";
import { discardWorkout, finishWorkout, nameQuickWorkout, saveWorkout, startQuickWorkout, startWorkout } from "@/lib/data/workouts";
import { getRequestToday } from "@/lib/today";
import { trainedMinutes, type WorkoutLog, type WorkoutProgress } from "./model";

/**
 * The workout screen's mutations. Called from event handlers, so each
 * returns a result instead of throwing: a dropped connection in the gym must
 * never become an error page. Every call starts from memberData() (the
 * verified member and their own client); the data layer validates the input
 * and Row Level Security checks ownership again.
 */

export type WorkoutActionResult<T> = { ok: true; value: T } | { ok: false; reason: "invalid" | "not_found" | "failed" };

async function attempt<T>(run: () => Promise<T>): Promise<WorkoutActionResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
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
): Promise<WorkoutActionResult<WorkoutLog>> {
  const { db, userId } = await memberData();
  const result = await attempt(() => startWorkout(db, userId, sessionId, progress));
  if (result.ok) revalidateMemberPages();
  return result;
}

export async function saveWorkoutAction(
  sessionId: string,
  progress: WorkoutProgress,
): Promise<WorkoutActionResult<string>> {
  const { db, userId } = await memberData();
  return attempt(() => saveWorkout(db, userId, sessionId, progress));
}

/**
 * Finishes the workout. For a quick workout, `name` is the name the member
 * gave it at the finish, and the session records the time actually trained.
 */
export async function finishWorkoutAction(
  sessionId: string,
  progress: WorkoutProgress,
  finishedAt: string,
  name?: string,
): Promise<WorkoutActionResult<WorkoutLog>> {
  const { db, userId } = await memberData();
  const result = await attempt(async () => {
    const log = await finishWorkout(db, userId, sessionId, progress, finishedAt);
    if (name !== undefined && log.finishedAt) {
      await nameQuickWorkout(db, userId, sessionId, name, trainedMinutes(log.startedAt, log.finishedAt));
    }
    return log;
  });
  if (result.ok) revalidateMemberPages();
  return result;
}

/**
 * "Start a workout" on Home: a quick session for the member's today, with its
 * workout already started, then straight into the workout screen. Only the
 * type (and the weight unit this phone uses) come from the form.
 */
export async function startQuickWorkoutAction(form: FormData) {
  const { db, userId } = await memberData();
  const today = await getRequestToday();
  const sessionId = await startQuickWorkout(db, userId, {
    category: form.get("category"),
    date: today.date,
    unit: form.get("unit"),
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
