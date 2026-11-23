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
import { finishWorkout, getWorkoutLog, nameQuickWorkout, saveWorkout, startQuickWorkout } from "@/lib/data/workouts";
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
  const log = await finishWorkout(user.db, user.id, sessionId, { unit: "kg", entries, notes: "Solid" }, new Date().toISOString());
  await nameQuickWorkout(user.db, user.id, sessionId, name, trainedMinutes(log.startedAt, log.finishedAt!));
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
      await nameQuickWorkout(cyd.db, cyd.id, sessionId, "Hijacked", 10);
      expect((await getSession(ada.db, ada.id, sessionId))?.name).toBe("Leg day");
      await rejects(nameQuickWorkout(ada.db, ada.id, sessionId, "   ", 10), "invalid");
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
