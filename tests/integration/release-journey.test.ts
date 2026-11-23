import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportUserData } from "@/lib/data/export";
import { findGlobalRoutineIdBySlug } from "@/lib/data/routines";
import { getSession, listSessionsForWeek, scheduleRoutine } from "@/lib/data/sessions";
import { finishWorkout, getWorkoutLog, saveWorkout, startQuickWorkout, startWorkout } from "@/lib/data/workouts";
import { initialEntries, planExercise } from "@/lib/workouts/model";
import { createTestUser, deleteTestUsers, integrationReady, type TestUser } from "./helpers";

/**
 * The release gate's journey (PRODUCT_AUDIT F1, "Acceptance and evidence" 1),
 * end to end as a new member on a fully migrated stack: plan a TrainGrid
 * routine on a chosen date across a year boundary, find it again, start,
 * leave, resume and finish it, start a quick workout, and download both.
 * Any column the data layer reads that the database lacks fails here, as
 * it did in the audit's local environment.
 */

// Sunday 3 January 2027 is in 2026-W53; Monday 4 January starts 2027-W01.
const NEXT_MONDAY = "2027-01-04";
const NEXT_WEEK = "2027-W01";

describe.skipIf(!integrationReady)("release journey (local Supabase)", () => {
  let member: TestUser;

  beforeAll(async () => {
    member = await createTestUser("release");
  });

  afterAll(async () => {
    if (!integrationReady) return;
    await deleteTestUsers();
  });

  it("schedules a routine on a chosen date, finds it after a reload, and trains it", async () => {
    const routineId = await findGlobalRoutineIdBySlug(member.db, "easy-run");
    expect(routineId).not.toBeNull();

    const planned = await scheduleRoutine(member.db, member.id, {
      routineId: routineId!,
      date: NEXT_MONDAY,
      startTime: "07:00",
      durationMinutes: null,
      notes: "",
    });
    expect(planned).toMatchObject({ weekId: NEXT_WEEK, day: 1, origin: "planned", sourceRoutineId: routineId });

    // "Reload": read the week back as the planner and Home do.
    const week = await listSessionsForWeek(member.db, member.id, NEXT_WEEK);
    expect(week.map((session) => session.id)).toContain(planned.id);

    const exercises = planned.items.map((item) => planExercise(item, planned.category));
    const entries = initialEntries(exercises);
    await startWorkout(member.db, member.id, planned.id, { unit: "kg", entries });
    const progress = {
      version: 1 as const,
      items: entries.items.map((item, index) => (index === 0 ? { ...item, sets: item.sets.map((set) => ({ ...set, done: true })) } : item)),
    };
    await saveWorkout(member.db, member.id, planned.id, { unit: "kg", entries: progress, notes: "" });

    // Leave and come back: the log, not the plan, holds what was done.
    const resumed = await getWorkoutLog(member.db, member.id, planned.id);
    expect(resumed?.status).toBe("in_progress");
    expect(resumed?.entries.items[0]?.sets.every((set) => set.done)).toBe(true);

    const finished = await finishWorkout(member.db, member.id, planned.id, { unit: "kg", entries: progress, notes: "Felt easy" }, new Date().toISOString());
    expect(finished.status).toBe("completed");
    expect((await getSession(member.db, member.id, planned.id))?.workoutStatus).toBe("completed");

    const quickId = await startQuickWorkout(member.db, member.id, { category: "strength", date: NEXT_MONDAY, unit: "kg" });
    expect((await getSession(member.db, member.id, quickId))?.origin).toBe("quick");

    const download = await exportUserData(member.db, member.id);
    expect(download.sessions.map((session) => session.id).sort()).toEqual([planned.id, quickId].sort());
    expect(download.workoutLogs.map((log) => log.sessionId)).toEqual(expect.arrayContaining([planned.id, quickId]));
  });
});
