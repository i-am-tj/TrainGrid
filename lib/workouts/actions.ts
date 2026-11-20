"use server";

import { revalidatePath } from "next/cache";
import { DataError } from "@/lib/data/model";
import { memberData } from "@/lib/data/server";
import { discardWorkout, finishWorkout, saveWorkout, startWorkout } from "@/lib/data/workouts";
import type { WorkoutLog, WorkoutProgress } from "./model";

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
    if (error instanceof DataError) return { ok: false, reason: error.code };
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

export async function finishWorkoutAction(
  sessionId: string,
  progress: WorkoutProgress,
  finishedAt: string,
): Promise<WorkoutActionResult<WorkoutLog>> {
  const { db, userId } = await memberData();
  const result = await attempt(() => finishWorkout(db, userId, sessionId, progress, finishedAt));
  if (result.ok) revalidateMemberPages();
  return result;
}

export async function discardWorkoutAction(sessionId: string): Promise<WorkoutActionResult<null>> {
  const { db, userId } = await memberData();
  const result = await attempt(async () => {
    await discardWorkout(db, userId, sessionId);
    return null;
  });
  if (result.ok) revalidateMemberPages();
  return result;
}
