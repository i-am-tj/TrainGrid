import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataError } from "@/lib/data/model";
import { createAdhocSession, getSession, listSessionsForWeek } from "@/lib/data/sessions";
import {
  WorkoutConflictError,
  discardWorkout,
  finishWorkout,
  getWorkoutLog,
  recentPerformances,
  saveWorkout,
  startWorkout,
} from "@/lib/data/workouts";
import { initialEntries, planExercise, type WorkoutEntries } from "@/lib/workouts/model";
import { createTestUser, deleteTestUsers, integrationReady, service, type TestUser } from "./helpers";

/**
 * Live workouts against a real database, as real members. Cross-member cases
 * use the attacker's own client and user id, as the app would.
 */

const WEEK = "2026-W46";
const MONDAY = "2026-11-09";

async function rejects(promise: Promise<unknown>, code: DataError["code"]) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof DataError && error.code === code);
}

describe.skipIf(!integrationReady)("workout logs (local Supabase)", () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    a = await createTestUser("wa");
    b = await createTestUser("wb");
  });

  afterAll(async () => {
    if (!integrationReady) return;
    await deleteTestUsers();
  });

  async function sessionWithLift(user: TestUser, name: string) {
    const session = await createAdhocSession(user.db, user.id, {
      name,
      category: "strength",
      date: MONDAY,
      items: [{ name: "Bench Press", instruction: "3 × 5", rest: "2 min", equipment: ["barbell"] }],
    });
    const plans = session.items.map((item) => planExercise(item, session.category));
    return { session, entries: initialEntries(plans) };
  }

  function withSets(entries: WorkoutEntries, sets: WorkoutEntries["items"][number]["sets"]): WorkoutEntries {
    return { version: 1, items: [{ ...entries.items[0]!, sets }] };
  }

  it("starts, saves and finishes a workout; the session shows it", async () => {
    const { session, entries } = await sessionWithLift(a, "IT Workout");
    expect(entries.items[0]!.sets).toHaveLength(3);

    const started = await startWorkout(a.db, a.id, session.id, { unit: "kg", entries });
    expect(started).toMatchObject({ sessionId: session.id, status: "in_progress", finishedAt: null });
    // Starting again returns the same log.
    expect((await startWorkout(a.db, a.id, session.id, { unit: "lb", entries })).id).toBe(started.id);
    expect((await getSession(a.db, a.id, session.id))?.workoutStatus).toBe("in_progress");

    const logged = withSets(entries, [
      { weight: 80, reps: 5, done: true },
      { weight: 80, reps: 5, done: true },
      { weight: null, reps: null, done: false },
    ]);
    await saveWorkout(a.db, a.id, session.id, { unit: "kg", entries: logged, notes: "" });

    // A finish time from before the start is held to the start.
    const finished = await finishWorkout(a.db, a.id, session.id, { unit: "kg", entries: logged, notes: "Good" }, "2000-01-01T00:00:00Z");
    expect(finished.status).toBe("completed");
    expect(finished.finishedAt && Date.parse(finished.finishedAt)).toBe(Date.parse(started.startedAt) + 1);
    expect(finished.entries.items[0]!.sets.filter((set) => set.done)).toHaveLength(2);

    // Editing and finishing again keeps the first finish time.
    const again = await finishWorkout(a.db, a.id, session.id, { unit: "kg", entries: logged, notes: "Edited" }, new Date().toISOString());
    expect(again.finishedAt).toBe(finished.finishedAt);

    const week = await listSessionsForWeek(a.db, a.id, WEEK);
    expect(week.find((s) => s.id === session.id)?.workoutStatus).toBe("completed");
  });

  it("remembers last time for the same exercise in another session", async () => {
    const { session } = await sessionWithLift(a, "IT Next Workout");
    const history = await recentPerformances(a.db, a.id, session.id);
    expect(history.get("bench press")).toMatchObject({ unit: "kg", sets: [{ weight: 80, reps: 5 }, { weight: 80, reps: 5 }] });
    // Another member's history is their own.
    expect((await recentPerformances(b.db, b.id, session.id)).size).toBe(0);
  });

  it("refuses invalid progress", async () => {
    const { session, entries } = await sessionWithLift(a, "IT Invalid");
    await startWorkout(a.db, a.id, session.id, { unit: "kg", entries });
    await rejects(
      saveWorkout(a.db, a.id, session.id, { unit: "kg", entries: withSets(entries, [{ weight: -5, reps: 5, done: true }]) }),
      "invalid",
    );
    await rejects(saveWorkout(a.db, a.id, "not-a-uuid", { unit: "kg", entries }), "not_found");
  });

  it("another member can neither start, read, save nor discard my workout", async () => {
    const { session, entries } = await sessionWithLift(a, "IT Private");
    await rejects(startWorkout(b.db, b.id, session.id, { unit: "kg", entries }), "not_found");
    await startWorkout(a.db, a.id, session.id, { unit: "kg", entries });

    expect(await getWorkoutLog(b.db, b.id, session.id)).toBeNull();
    await rejects(saveWorkout(b.db, b.id, session.id, { unit: "kg", entries, notes: "hijack" }), "not_found");
    await discardWorkout(b.db, b.id, session.id);

    // Past the app's own filters: straight at the table with b's client.
    await b.db.from("workout_logs").update({ notes: "hijack" }).eq("session_id", session.id);
    await b.db.from("workout_logs").delete().eq("session_id", session.id);

    const { data } = await service().from("workout_logs").select("notes").eq("session_id", session.id).single();
    expect(data?.notes).toBe("");
  });

  it("discarding removes the log and keeps the session", async () => {
    const { session, entries } = await sessionWithLift(a, "IT Discard");
    await startWorkout(a.db, a.id, session.id, { unit: "kg", entries });
    await discardWorkout(a.db, a.id, session.id);
    expect(await getWorkoutLog(a.db, a.id, session.id)).toBeNull();
    expect((await getSession(a.db, a.id, session.id))?.workoutStatus).toBeNull();
  });

  const PHONE = "0e000000-0000-4000-8000-0000000000a1";
  const TABLET = "0e000000-0000-4000-8000-0000000000b2";

  it("two devices: a save made on a stale version is refused, not applied over the newer one", async () => {
    const { session, entries } = await sessionWithLift(a, "IT Two devices");
    const loaded = await startWorkout(a.db, a.id, session.id, { unit: "kg", entries }, PHONE);
    expect(loaded.savedBy).toBe(PHONE);
    const phone = withSets(entries, [{ weight: 60, reps: 8, done: true }]);
    const tablet = withSets(entries, [{ weight: 70, reps: 6, done: true }]);

    // Both devices opened the workout at the same version. The phone saves first.
    const phoneVersion = await saveWorkout(a.db, a.id, session.id, { unit: "kg", entries: phone, notes: "" }, {
      expectedUpdatedAt: loaded.updatedAt,
      device: PHONE,
    });
    expect(phoneVersion).not.toBe(loaded.updatedAt);

    // The tablet's save still carries the version it loaded.
    const fromTablet = { expectedUpdatedAt: loaded.updatedAt, device: TABLET };
    const refused = await saveWorkout(a.db, a.id, session.id, { unit: "kg", entries: tablet, notes: "" }, fromTablet).catch(
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(WorkoutConflictError);
    expect((refused as WorkoutConflictError).latest).toMatchObject({ updatedAt: phoneVersion, savedBy: PHONE, entries: phone });
    expect((await getWorkoutLog(a.db, a.id, session.id))?.entries).toEqual(phone);

    // Finishing from the stale version is refused the same way.
    const stale = await finishWorkout(
      a.db, a.id, session.id, { unit: "kg", entries: tablet, notes: "" }, new Date().toISOString(), undefined, fromTablet,
    ).catch((error: unknown) => error);
    expect(stale).toBeInstanceOf(WorkoutConflictError);
    expect((await getWorkoutLog(a.db, a.id, session.id))?.status).toBe("in_progress");

    // Keeping the tablet's version means saving it on top of the version it was shown.
    const kept = await saveWorkout(a.db, a.id, session.id, { unit: "kg", entries: tablet, notes: "" }, {
      expectedUpdatedAt: phoneVersion,
      device: TABLET,
    });
    const finished = await finishWorkout(
      a.db, a.id, session.id, { unit: "kg", entries: tablet, notes: "Kept" }, new Date().toISOString(), undefined,
      { expectedUpdatedAt: kept, device: TABLET },
    );
    expect(finished).toMatchObject({ status: "completed", notes: "Kept", entries: tablet, savedBy: TABLET });
  });

  it("a device's own save whose reply was lost is not a conflict", async () => {
    const { session, entries } = await sessionWithLift(a, "IT Lost reply");
    const loaded = await startWorkout(a.db, a.id, session.id, { unit: "kg", entries }, PHONE);
    const check = { expectedUpdatedAt: loaded.updatedAt, device: PHONE };
    const first = withSets(entries, [{ weight: 60, reps: 8, done: true }]);
    const more = withSets(entries, [{ weight: 60, reps: 8, done: true }, { weight: 60, reps: 8, done: true }]);

    // The first save reached TrainGrid but the phone never heard back, so it retries from the old version.
    await saveWorkout(a.db, a.id, session.id, { unit: "kg", entries: first, notes: "" }, check);
    await saveWorkout(a.db, a.id, session.id, { unit: "kg", entries: more, notes: "" }, check);
    const finished = await finishWorkout(
      a.db, a.id, session.id, { unit: "kg", entries: more, notes: "" }, new Date().toISOString(), undefined, check,
    );
    expect(finished.entries).toEqual(more);
  });

  it("a checked save of another member's workout is not found, never a conflict that reveals it", async () => {
    const { session, entries } = await sessionWithLift(a, "IT Checked other");
    const loaded = await startWorkout(a.db, a.id, session.id, { unit: "kg", entries }, PHONE);
    const check = { expectedUpdatedAt: loaded.updatedAt, device: TABLET };
    await rejects(saveWorkout(b.db, b.id, session.id, { unit: "kg", entries, notes: "" }, check), "not_found");
    await rejects(
      finishWorkout(b.db, b.id, session.id, { unit: "kg", entries, notes: "" }, new Date().toISOString(), undefined, check),
      "not_found",
    );
    // Only a version as the server writes it, and a uuid, reach the filter.
    await rejects(
      saveWorkout(a.db, a.id, session.id, { unit: "kg", entries, notes: "" }, { ...check, expectedUpdatedAt: 'x",id.neq.0' }),
      "invalid",
    );
    await rejects(saveWorkout(a.db, a.id, session.id, { unit: "kg", entries, notes: "" }, { ...check, device: "phone" }), "invalid");
  });
});
