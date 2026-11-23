import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportUserData } from "@/lib/data/export";
import { DataError } from "@/lib/data/model";
import { getSession, listSessionsForWeek } from "@/lib/data/sessions";
import {
  acceptFollowRequest,
  addComment,
  createPost,
  deleteComment,
  followMember,
  getPost,
  likePost,
  listComments,
  listPosts,
  removeFollower,
  saveSocialProfile,
  unlikePost,
} from "@/lib/data/social";
import { finishWorkout, getWorkoutLog, saveWorkout, startQuickWorkout } from "@/lib/data/workouts";
import { weekDayOfDate } from "@/lib/calendar-date";
import { newFreeFormExercise, trainedMinutes, type WorkoutEntries } from "@/lib/workouts/model";
import { createTestUser, deleteTestUsers, integrationReady, service, type TestUser } from "./helpers";

/**
 * Quick workouts (started from Home with no plan), the workout summary a post
 * can share, and likes and comments, against a real database as real members.
 */

const TODAY = "2026-11-23";
const tag = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

async function rejects(promise: Promise<unknown>, code: DataError["code"]) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof DataError && error.code === code);
}

async function profile(user: TestUser, visibility: "public" | "private") {
  return saveSocialProfile(user.db, user.id, {
    username: `it_rq_${tag()}`,
    displayName: `IT ${visibility}`,
    bio: "",
    visibility,
    useIdentityAvatar: false,
  });
}

/** A quick lift: two exercises added on the fly, three sets done, then finished and named. */
async function finishedQuickLift(user: TestUser, name = "Leg day") {
  const sessionId = await startQuickWorkout(user.db, user.id, { category: "strength", date: TODAY, unit: "kg" });
  return finishedQuickLiftFrom(user, sessionId, name);
}

async function finishedQuickLiftFrom(user: TestUser, sessionId: string, name = "Leg day") {
  const squat = newFreeFormExercise({ name: "Back squat", mode: "load", restSeconds: 90 }, crypto.randomUUID()).entry;
  const pushups = newFreeFormExercise({ name: "Push-up", mode: "reps", restSeconds: null }, crypto.randomUUID()).entry;
  const entries: WorkoutEntries = {
    version: 1,
    items: [
      { ...squat, sets: [{ weight: 100, reps: 5, done: true }, { weight: 100, reps: 5, done: true }, { weight: null, reps: null, done: false }] },
      { ...pushups, sets: [{ weight: null, reps: 12, done: true }] },
    ],
  };
  await saveWorkout(user.db, user.id, sessionId, { unit: "kg", entries, notes: "" });
  const log = await finishWorkout(user.db, user.id, sessionId, { unit: "kg", entries, notes: "Solid" }, new Date().toISOString(), name);
  return { sessionId, log };
}

describe.skipIf(!integrationReady)("quick workouts, workout posts, likes and comments (local Supabase)", () => {
  let ada: TestUser; // public profile, posts
  let bea: TestUser; // private profile
  let cyd: TestUser; // follows people
  let dev: TestUser; // no social profile

  beforeAll(async () => {
    [ada, bea, cyd, dev] = await Promise.all([
      createTestUser("rqada"),
      createTestUser("rqbea"),
      createTestUser("rqcyd"),
      createTestUser("rqdev"),
    ]);
    await Promise.all([profile(ada, "public"), profile(bea, "private"), profile(cyd, "private")]);
  });

  afterAll(async () => {
    if (!integrationReady) return;
    await deleteTestUsers();
  });

  describe("quick workouts", () => {
    it("starts today with no plan, runs free-form, and is named at the finish", async () => {
      const { sessionId, log } = await finishedQuickLift(ada, "  Heavy legs  ");
      const session = await getSession(ada.db, ada.id, sessionId);
      expect(session).toMatchObject({ origin: "quick", name: "Heavy legs", category: "strength", date: TODAY, items: [], workoutStatus: "completed" });
      expect(session?.durationMinutes).toBeGreaterThanOrEqual(1);
      expect(log.entries.items.map((item) => [item.name, item.mode, item.rest_seconds])).toEqual([
        ["Back squat", "load", 90],
        ["Push-up", "reps", null],
      ]);
      // It is on the planner like any other session.
      const week = await listSessionsForWeek(ada.db, ada.id, weekDayOfDate(TODAY).weekId);
      expect(week.map((s) => s.id)).toContain(sessionId);
    });

    it("names only quick sessions, and only the member's own", async () => {
      const { sessionId } = await finishedQuickLift(ada);
      const empty = { unit: "kg" as const, entries: { version: 1 as const, items: [] }, notes: "" };
      await rejects(finishWorkout(cyd.db, cyd.id, sessionId, empty, new Date().toISOString(), "Hijacked"), "not_found");
      expect((await getSession(ada.db, ada.id, sessionId))?.name).toBe("Leg day");
      await rejects(finishWorkout(ada.db, ada.id, sessionId, empty, new Date().toISOString(), "   "), "invalid");

      // A planned session keeps its own name and planned duration.
      const planned = await service()
        .from("scheduled_sessions")
        .insert({ user_id: ada.id, date: TODAY, name: "Tempo run", category: "running", duration_minutes: 45, snapshot: { version: 1, items: [] } })
        .select("id")
        .single();
      await service().from("workout_logs").insert({ user_id: ada.id, session_id: planned.data!.id, unit: "kg", entries: { version: 1, items: [] } });
      await finishWorkout(ada.db, ada.id, planned.data!.id, empty, new Date().toISOString(), "Renamed");
      expect(await getSession(ada.db, ada.id, planned.data!.id)).toMatchObject({ name: "Tempo run", durationMinutes: 45, workoutStatus: "completed" });
    });

    it("starts once per request: sending the same request again returns the same workout (F18)", async () => {
      const requestId = crypto.randomUUID();
      const input = { category: "strength", date: TODAY, unit: "kg", requestId };
      const first = await startQuickWorkout(ada.db, ada.id, input);
      const [again, raced] = await Promise.all([startQuickWorkout(ada.db, ada.id, input), startQuickWorkout(ada.db, ada.id, input)]);
      expect(first).toBe(requestId);
      expect([again, raced]).toEqual([requestId, requestId]);
      const sessions = await service().from("scheduled_sessions").select("id").eq("id", requestId);
      const logs = await service().from("workout_logs").select("id").eq("session_id", requestId);
      expect(sessions.data).toHaveLength(1);
      expect(logs.data).toHaveLength(1);

      // A retry after sets were logged and the workout finished keeps all of it.
      const { log } = await finishedQuickLiftFrom(ada, requestId);
      expect(await startQuickWorkout(ada.db, ada.id, input)).toBe(requestId);
      expect(await getWorkoutLog(ada.db, ada.id, requestId)).toMatchObject({ status: "completed", finishedAt: log.finishedAt });
    });

    it("never adopts another member's session through a reused request id", async () => {
      const theirs = await startQuickWorkout(cyd.db, cyd.id, { category: "running", date: TODAY, unit: "kg" });
      await rejects(startQuickWorkout(ada.db, ada.id, { category: "strength", date: TODAY, unit: "kg", requestId: theirs }), "not_found");
      const { data } = await service().from("scheduled_sessions").select("user_id, name").eq("id", theirs).single();
      expect(data).toEqual({ user_id: cyd.id, name: "Quick run" });
    });

    it("leaves nothing behind when starting fails part-way (F18)", async () => {
      const id = crypto.randomUUID();
      // The session insert succeeds; the log insert is refused (no such unit).
      const { error } = await ada.db.rpc("start_quick_workout", {
        p_session_id: id,
        p_date: TODAY,
        p_category: "strength",
        p_name: "Quick lift",
        p_unit: "stone",
        p_entries: { version: 1, items: [] },
      });
      expect(error?.code).toBe("23514");
      const { data } = await service().from("scheduled_sessions").select("id").eq("id", id);
      expect(data).toEqual([]);
    });

    it("never leaves a finished workout with its placeholder name (F18)", async () => {
      const sessionId = await startQuickWorkout(ada.db, ada.id, { category: "strength", date: TODAY, unit: "kg" });
      // The log update succeeds; the rename is refused (too long for a session name).
      const { error } = await ada.db.rpc("finish_workout", {
        p_session_id: sessionId,
        p_unit: "kg",
        p_entries: { version: 1, items: [] },
        p_notes: "",
        p_finished_at: new Date().toISOString(),
        p_name: "x".repeat(201),
      });
      expect(error?.code).toBe("23514");
      expect(await getWorkoutLog(ada.db, ada.id, sessionId)).toMatchObject({ status: "in_progress", finishedAt: null });
      expect((await getSession(ada.db, ada.id, sessionId))?.name).toBe("Quick lift");

      // The retry finishes and names it together; finishing again keeps the first finish time.
      const empty = { unit: "kg" as const, entries: { version: 1 as const, items: [] }, notes: "" };
      const done = await finishWorkout(ada.db, ada.id, sessionId, empty, new Date().toISOString(), "Evening lift");
      const session = await getSession(ada.db, ada.id, sessionId);
      expect(session).toMatchObject({ name: "Evening lift", durationMinutes: trainedMinutes(done.startedAt, done.finishedAt!) });
      const later = new Date(Date.now() + 60_000).toISOString();
      expect((await finishWorkout(ada.db, ada.id, sessionId, empty, later, "Evening lift")).finishedAt).toBe(done.finishedAt);
    });

    it("keeps a finish time within the workout, whatever the phone sends", async () => {
      const sessionId = await startQuickWorkout(ada.db, ada.id, { category: "other", date: TODAY, unit: "kg" });
      const started = (await getWorkoutLog(ada.db, ada.id, sessionId))!.startedAt;
      const empty = { unit: "kg" as const, entries: { version: 1 as const, items: [] }, notes: "" };
      const log = await finishWorkout(ada.db, ada.id, sessionId, empty, "2000-01-01T00:00:00Z", "Mobility");
      expect(Date.parse(log.finishedAt!)).toBeGreaterThan(Date.parse(started));
      const future = await startQuickWorkout(ada.db, ada.id, { category: "other", date: TODAY, unit: "kg" });
      const capped = await finishWorkout(ada.db, ada.id, future, empty, "2999-01-01T00:00:00Z", "Mobility");
      expect(Date.parse(capped.finishedAt!)).toBeLessThanOrEqual(Date.now() + 1000);
      const unreadable = await startQuickWorkout(ada.db, ada.id, { category: "other", date: TODAY, unit: "kg" });
      expect((await finishWorkout(ada.db, ada.id, unreadable, empty, "not a date", "Mobility")).status).toBe("completed");
    });

    it("refuses an unknown type", async () => {
      await rejects(startQuickWorkout(ada.db, ada.id, { category: "yoga", date: TODAY, unit: "kg" }), "invalid");
    });

    it("cannot be started for someone else", async () => {
      const sessionId = await startQuickWorkout(cyd.db, cyd.id, { category: "running", date: TODAY, unit: "kg" });
      expect(await getWorkoutLog(ada.db, ada.id, sessionId)).toBeNull();
      const { data } = await service().from("scheduled_sessions").select("user_id, origin").eq("id", sessionId).single();
      expect(data).toEqual({ user_id: cyd.id, origin: "quick" });
    });
  });

  describe("posting a workout", () => {
    it("shares only the totals the member ticks, copied by the database", async () => {
      const { sessionId, log } = await finishedQuickLift(ada);
      const everything = await createPost(ada.db, ada.id, { sessionId, caption: "PR day", showsDuration: true, showsSets: true, showsVolume: true });
      const post = await getPost(cyd.db, everything);
      expect(post?.workout).toEqual({ completed: true, sets: 3, volume: 1000, unit: "kg" });
      expect(post?.session.durationMinutes).toBe(trainedMinutes(log.startedAt, log.finishedAt!));
      expect(post?.session.name).toBe("Leg day");

      const quiet = await createPost(ada.db, ada.id, { sessionId, caption: "Just vibes", showsDuration: false, showsSets: false, showsVolume: false });
      expect((await getPost(cyd.db, quiet))?.workout).toEqual({ completed: true, sets: null, volume: null, unit: null });

      // Never the exercises, sets or notes.
      const serialized = JSON.stringify(post);
      for (const secret of ["Back squat", "Push-up", "Solid", "100 ×"]) expect(serialized).not.toContain(secret);
    });

    it("keeps the posted totals even if the workout is edited later", async () => {
      const { sessionId } = await finishedQuickLift(ada);
      const id = await createPost(ada.db, ada.id, { sessionId, caption: "", showsDuration: false, showsSets: true, showsVolume: false });
      await saveWorkout(ada.db, ada.id, sessionId, { unit: "kg", entries: { version: 1, items: [] }, notes: "" });
      expect((await getPost(ada.db, id))?.workout.sets).toBe(3);
    });
  });

  describe("likes", () => {
    let postId: string;

    beforeAll(async () => {
      const { sessionId } = await finishedQuickLift(ada);
      postId = await createPost(ada.db, ada.id, { sessionId, caption: "Like me", showsDuration: false });
    });

    it("likes once, shows the count, and unlikes", async () => {
      await likePost(cyd.db, postId);
      await likePost(cyd.db, postId); // idempotent
      expect(await getPost(cyd.db, postId)).toMatchObject({ likeCount: 1, viewerLiked: true });
      expect(await getPost(ada.db, postId)).toMatchObject({ likeCount: 1, viewerLiked: false });
      await unlikePost(cyd.db, cyd.id, postId);
      expect(await getPost(cyd.db, postId)).toMatchObject({ likeCount: 0, viewerLiked: false });
    });

    it("needs a social profile, and a post the member can see", async () => {
      await rejects(likePost(dev.db, postId), "invalid");
      await rejects(likePost(cyd.db, crypto.randomUUID()), "not_found");
      await rejects(likePost(cyd.db, "not-a-post"), "not_found");
    });

    it("counts appear in the feed", async () => {
      await followMember(cyd.db, cyd.id, ada.id);
      await likePost(cyd.db, postId);
      const feed = await listPosts(cyd.db, {});
      expect(feed.posts.find((p) => p.id === postId)).toMatchObject({ likeCount: 1, viewerLiked: true, commentCount: 0 });
    });
  });

  describe("comments", () => {
    let privatePost: string;

    beforeAll(async () => {
      const { sessionId } = await finishedQuickLift(bea);
      privatePost = await createPost(bea.db, bea.id, { sessionId, caption: "Private lift", showsDuration: false });
    });

    it("only members who can see the post can comment or read comments", async () => {
      await rejects(addComment(cyd.db, privatePost, "Hello?"), "not_found");
      expect(await listComments(cyd.db, privatePost)).toEqual([]);

      await followMember(cyd.db, cyd.id, bea.id);
      await acceptFollowRequest(bea.db, bea.id, cyd.id);
      await addComment(cyd.db, privatePost, "  Strong!\n\n\n\nKeep going  ");
      const comments = await listComments(bea.db, privatePost);
      expect(comments.map((c) => [c.body, c.author.userId])).toEqual([["Strong!\n\nKeep going", cyd.id]]);
      expect((await getPost(bea.db, privatePost))?.commentCount).toBe(1);
      expect(JSON.stringify(comments)).not.toContain("@example.test");
    });

    it("validates comments", async () => {
      await rejects(addComment(cyd.db, privatePost, "   "), "invalid");
      await rejects(addComment(cyd.db, privatePost, "x".repeat(501)), "invalid");
      await rejects(addComment(dev.db, privatePost, "No profile"), "not_found");
    });

    it("are deleted by their author or by the post's author, nobody else", async () => {
      const mine = await addComment(cyd.db, privatePost, "Mine");
      const onHerPost = await addComment(cyd.db, privatePost, "Hers to remove");
      await rejects(deleteComment(ada.db, mine), "not_found");
      await deleteComment(cyd.db, mine);
      await deleteComment(bea.db, onHerPost);
      expect((await listComments(bea.db, privatePost)).map((c) => c.body)).toEqual(["Strong!\n\nKeep going"]);
    });

    it("disappear for a removed follower, who keeps control of their own", async () => {
      const own = await addComment(cyd.db, privatePost, "Before removal");
      await likePost(cyd.db, privatePost);
      await removeFollower(bea.db, bea.id, cyd.id);
      expect(await getPost(cyd.db, privatePost)).toBeNull();
      await rejects(addComment(cyd.db, privatePost, "After"), "not_found");
      // Their own like and comment can still be taken back.
      await unlikePost(cyd.db, cyd.id, privatePost);
      await deleteComment(cyd.db, own);
      expect((await getPost(bea.db, privatePost))?.likeCount).toBe(0);
    });
  });

  describe("export", () => {
    it("includes the member's comments and likes (v5)", async () => {
      const { sessionId } = await finishedQuickLift(ada);
      const postId = await createPost(ada.db, ada.id, { sessionId, caption: "Export me", showsDuration: false });
      await likePost(cyd.db, postId);
      const commentId = await addComment(cyd.db, postId, "Exported comment");
      const data = await exportUserData(cyd.db, cyd.id);
      expect(data.version).toBe(6);
      expect(data.social!.comments).toContainEqual(expect.objectContaining({ id: commentId, postId, body: "Exported comment" }));
      expect(data.social!.likes).toContainEqual(expect.objectContaining({ postId }));
    });

    it("keeps a quick workout quick and a post's shared totals (v6)", async () => {
      const { sessionId } = await finishedQuickLift(ada, "Export lift");
      const postId = await createPost(ada.db, ada.id, { sessionId, caption: "Totals", showsDuration: false, showsSets: true, showsVolume: true });
      const data = await exportUserData(ada.db, ada.id);
      expect(data.sessions.find((session) => session.id === sessionId)?.origin).toBe("quick");
      expect(data.social!.posts.find((post) => post.id === postId)?.workout).toEqual({ completed: true, sets: 3, volume: 1000, unit: "kg" });
    });
  });
});
