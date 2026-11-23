import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportUserData } from "@/lib/data/export";
import { DataError, type Db } from "@/lib/data/model";
import { createAdhocSession, deleteSession, updateSessionDetails } from "@/lib/data/sessions";
import {
  acceptFollowRequest,
  countIncomingRequests,
  createPost,
  deletePost,
  deleteSocialProfile,
  exportSocialData,
  followMember,
  getOwnSocialProfile,
  getPost,
  getProfileCard,
  isUsernameAvailable,
  listConnections,
  listFollowRequests,
  listNewestProfiles,
  listPostableSessions,
  listPosts,
  rejectFollowRequest,
  removeFollower,
  saveSocialProfile,
  searchProfiles,
  unfollowMember,
  updatePostCaption,
} from "@/lib/data/social";
import { SocialUnavailableError } from "@/lib/social/availability";
import { anonymous, createTestUser, deleteTestUsers, integrationReady, service, type TestUser } from "./helpers";

/**
 * The social data layer against a real database, as real members. Every
 * cross-member case uses the other member's own client and user id, exactly
 * as the app would: the database is what refuses.
 */

const MONDAY = "2026-11-09";

async function rejects(promise: Promise<unknown>, code: DataError["code"]) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof DataError && error.code === code);
}

const tag = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

async function profile(user: TestUser, visibility: "public" | "private", name: string) {
  return saveSocialProfile(user.db, user.id, {
    username: `it_${name}_${tag()}`,
    displayName: `IT ${name}`,
    bio: `${name} trains`,
    visibility,
    useIdentityAvatar: false,
  });
}

async function session(user: TestUser, name: string, durationMinutes: number | null = 45) {
  return createAdhocSession(user.db, user.id, {
    name,
    category: "running",
    date: MONDAY,
    startTime: "06:00",
    durationMinutes,
    notes: "Private: knee felt off",
    items: [{ name: "Tempo intervals", instruction: "4 × 6 min", equipment: [] }],
  });
}

describe.skipIf(!integrationReady)("social (local Supabase)", () => {
  let pub: TestUser; // public profile
  let priv: TestUser; // private profile
  let fan: TestUser; // follows people
  let lurker: TestUser; // member without a social profile
  let pubName: string;
  let privName: string;

  beforeAll(async () => {
    [pub, priv, fan, lurker] = await Promise.all([
      createTestUser("spub"),
      createTestUser("spriv"),
      createTestUser("sfan"),
      createTestUser("slurk"),
    ]);
    pubName = (await profile(pub, "public", "pub")).username;
    privName = (await profile(priv, "private", "priv")).username;
    await profile(fan, "private", "fan");
  });

  afterAll(async () => {
    if (!integrationReady) return;
    await deleteTestUsers();
  });

  it("accepts a follow arriving while a private profile becomes public", async () => {
    const owner = await createTestUser("visibility");
    const account = await profile(owner, "private", "visibility");
    await Promise.all([
      saveSocialProfile(owner.db, owner.id, { ...account, visibility: "public", useIdentityAvatar: false }),
      followMember(fan.db, fan.id, owner.id),
    ]);
    const relation = await fan.db.from("follows").select("status")
      .eq("follower_id", fan.id).eq("followee_id", owner.id).single();
    expect(relation.error).toBeNull();
    expect(relation.data?.status).toBe("accepted");
    await unfollowMember(fan.db, fan.id, owner.id);
  });

  describe("profiles", () => {
    it("creates a profile, private by default, and edits it", async () => {
      const user = await createTestUser("sprof");
      expect(await getOwnSocialProfile(user.db, user.id)).toBeNull();
      const created = await saveSocialProfile(user.db, user.id, {
        username: `  @IT_Prof_${tag()} `,
        displayName: " Prof ",
        bio: "line one\nline two",
        visibility: "private",
        useIdentityAvatar: false,
      });
      expect(created.username).toMatch(/^it_prof_[a-z0-9]+$/);
      expect(created).toMatchObject({ displayName: "Prof", bio: "line one line two", visibility: "private", avatarUrl: null });

      const edited = await saveSocialProfile(user.db, user.id, { ...created, bio: "Edited", visibility: "public", useIdentityAvatar: false });
      expect(edited).toMatchObject({ username: created.username, bio: "Edited", visibility: "public" });
    });

    it("keeps usernames unique and valid", async () => {
      const user = await createTestUser("suniq");
      expect(await isUsernameAvailable(user.db, user.id, pubName)).toBe(false);
      await rejects(
        saveSocialProfile(user.db, user.id, { username: pubName.toUpperCase(), displayName: "Dupe", bio: "", visibility: "private", useIdentityAvatar: false }),
        "invalid",
      );
      for (const bad of ["ab", "has space", "x__y", "_lead", "admin", "a".repeat(31)]) {
        await rejects(
          saveSocialProfile(user.db, user.id, { username: bad, displayName: "Bad", bio: "", visibility: "private", useIdentityAvatar: false }),
          "invalid",
        );
      }
      expect(await getOwnSocialProfile(user.db, user.id)).toBeNull();
    });

    it("uses the sign-in picture only when chosen", async () => {
      const user = await createTestUser("savatar");
      await service().from("profiles").update({ avatar_url: "https://avatars.example.test/me.png" }).eq("id", user.id);
      const withPicture = await profile(user, "private", "pic");
      expect(withPicture.avatarUrl).toBeNull();
      const chosen = await saveSocialProfile(user.db, user.id, { ...withPicture, useIdentityAvatar: true });
      expect(chosen.avatarUrl).toBe("https://avatars.example.test/me.png");
    });

    it("never exposes email addresses, and finds members by name", async () => {
      const card = await getProfileCard(lurker.db, pubName);
      expect(card).not.toBeNull();
      expect(JSON.stringify(card)).not.toContain("@example.test");
      expect(await searchProfiles(lurker.db, pub.email)).toEqual([]);
      expect((await searchProfiles(lurker.db, `@${pubName}`)).map((p) => p.username)).toEqual([pubName]);
      expect((await searchProfiles(lurker.db, "a"))).toEqual([]);
      const newest = await listNewestProfiles(lurker.db, lurker.id, 50);
      expect(newest.map((p) => p.username)).toEqual(expect.arrayContaining([pubName, privName]));
    });

    it("is closed to anonymous callers and non-members", async () => {
      const anon = anonymous();
      expect((await anon.from("social_profiles").select("username")).error?.code).toBe("42501");
      const stranger = await createTestUser("sstranger", { member: false });
      expect(await getProfileCard(stranger.db, pubName)).toBeNull();
      expect(await searchProfiles(stranger.db, pubName)).toEqual([]);
      await expect(
        saveSocialProfile(stranger.db, stranger.id, { username: `it_x_${tag()}`, displayName: "X", bio: "", visibility: "public", useIdentityAvatar: false }),
      ).rejects.toThrow();
      expect(await getOwnSocialProfile(stranger.db, stranger.id)).toBeNull();
    });

    it("refuses to edit someone else's profile", async () => {
      const { data } = await fan.db.from("social_profiles").update({ bio: "hacked" }).eq("user_id", pub.id).select("user_id");
      expect(data).toEqual([]);
      expect((await getProfileCard(fan.db, pubName))?.bio).toBe("pub trains");
    });
  });

  describe("following", () => {
    it("follows a public profile at once and unfollows", async () => {
      expect(await followMember(fan.db, fan.id, pub.id)).toBe("accepted");
      expect(await followMember(fan.db, fan.id, pub.id)).toBe("accepted"); // idempotent
      const card = await getProfileCard(fan.db, pubName);
      expect(card).toMatchObject({ viewerFollow: "accepted", canViewPosts: true, followerCount: 1 });
      await unfollowMember(fan.db, fan.id, pub.id);
      expect(await getProfileCard(fan.db, pubName)).toMatchObject({ viewerFollow: null, followerCount: 0 });
    });

    it("requests a private profile; the owner approves, rejects or removes", async () => {
      expect(await followMember(fan.db, fan.id, priv.id)).toBe("pending");
      expect(await countIncomingRequests(priv.db, priv.id)).toBe(1);
      const requests = await listFollowRequests(priv.db, priv.id);
      expect(requests.incoming.map((p) => p.userId)).toEqual([fan.id]);
      expect((await listFollowRequests(fan.db, fan.id)).outgoing.map((p) => p.userId)).toEqual([priv.id]);

      // Reject, then ask again and get approved.
      await rejectFollowRequest(priv.db, priv.id, fan.id);
      expect((await getProfileCard(fan.db, privName))?.viewerFollow).toBeNull();
      expect(await followMember(fan.db, fan.id, priv.id)).toBe("pending");

      // Only the person followed can approve.
      await rejects(acceptFollowRequest(fan.db, fan.id, fan.id), "not_found");
      await rejects(acceptFollowRequest(lurker.db, lurker.id, fan.id), "not_found");
      await acceptFollowRequest(priv.db, priv.id, fan.id);
      expect(await getProfileCard(fan.db, privName)).toMatchObject({ viewerFollow: "accepted", canViewPosts: true });
      await rejects(rejectFollowRequest(priv.db, priv.id, fan.id), "not_found"); // no longer pending

      // Remove the follower: access goes at once.
      await removeFollower(priv.db, priv.id, fan.id);
      expect(await getProfileCard(fan.db, privName)).toMatchObject({ viewerFollow: null, canViewPosts: false });
      await rejects(removeFollower(priv.db, priv.id, fan.id), "not_found");
    });

    it("cancels a pending request", async () => {
      expect(await followMember(fan.db, fan.id, priv.id)).toBe("pending");
      await unfollowMember(fan.db, fan.id, priv.id);
      expect(await countIncomingRequests(priv.db, priv.id)).toBe(0);
    });

    it("refuses self-follows, unknown members and members without a profile", async () => {
      await rejects(followMember(fan.db, fan.id, fan.id), "invalid");
      await rejects(followMember(fan.db, fan.id, crypto.randomUUID()), "not_found");
      await rejects(followMember(fan.db, fan.id, "not-a-uuid"), "not_found");
      await rejects(followMember(lurker.db, lurker.id, pub.id), "invalid");
    });

    it("cannot be forged through the API", async () => {
      // Choosing the follower, or the status, is not granted.
      const forged = await lurker.db.from("follows").insert({ follower_id: fan.id, followee_id: pub.id } as never);
      expect(forged.error?.code).toBe("42501");
      const accepted = await fan.db.from("follows").insert({ followee_id: priv.id, status: "accepted" } as never);
      expect(accepted.error?.code).toBe("42501");
    });

    it("shows a private profile's lists only to approved followers", async () => {
      await followMember(pub.db, pub.id, priv.id);
      await acceptFollowRequest(priv.db, priv.id, pub.id);
      const owner = await listConnections(priv.db, priv.id, "followers");
      expect(owner.people.map((p) => p.userId)).toEqual([pub.id]);
      const follower = await listConnections(pub.db, priv.id, "followers");
      expect(follower.people.map((p) => p.userId)).toEqual([pub.id]);
      expect((await listConnections(fan.db, priv.id, "followers")).people).toEqual([]);
      // Nor through the public member's following list.
      expect((await listConnections(fan.db, pub.id, "following")).people).toEqual([]);
      await unfollowMember(pub.db, pub.id, priv.id);
    });
  });

  describe("posts", () => {
    it("posts a snapshot of the author's own session, and only what was chosen", async () => {
      const s = await session(priv, "IT Tempo run", 50);
      const id = await createPost(priv.db, priv.id, { sessionId: s.id, caption: "  Felt quick  ", showsDuration: false });
      const post = await getPost(priv.db, id);
      expect(post).toMatchObject({
        caption: "Felt quick",
        session: { name: "IT Tempo run", category: "running", date: MONDAY, durationMinutes: null },
        editedAt: null,
      });
      const serialized = JSON.stringify(post);
      for (const secret of ["knee", "06:00", "Tempo intervals", s.id]) expect(serialized).not.toContain(secret);

      const withTime = await createPost(priv.db, priv.id, { sessionId: s.id, caption: "", showsDuration: true });
      expect((await getPost(priv.db, withTime))?.session.durationMinutes).toBe(50);
    });

    it("keeps the snapshot when the session is edited or deleted", async () => {
      const s = await session(pub, "IT Long run", 90);
      const id = await createPost(pub.db, pub.id, { sessionId: s.id, caption: "Long one", showsDuration: true });
      await updateSessionDetails(pub.db, pub.id, s.id, {
        name: "Renamed",
        category: "other",
        date: "2026-11-10",
        startTime: null,
        durationMinutes: 10,
        notes: "",
      });
      expect((await getPost(pub.db, id))?.session).toEqual({ name: "IT Long run", category: "running", date: MONDAY, durationMinutes: 90 });
      await deleteSession(pub.db, pub.id, s.id);
      expect((await getPost(pub.db, id))?.session.name).toBe("IT Long run");
      const { data } = await service().from("session_posts").select("session_id").eq("id", id).single();
      expect(data?.session_id).toBeNull();
    });

    it("refuses another member's session and a forged snapshot", async () => {
      const theirs = await session(pub, "IT Not yours");
      await rejects(createPost(fan.db, fan.id, { sessionId: theirs.id, caption: "Mine now", showsDuration: true }), "not_found");
      const forged = await fan.db
        .from("session_posts")
        .insert({ session_id: theirs.id, session_name: "Forged", session_category: "running", session_date: MONDAY });
      expect(forged.error?.code).toBe("42501");
      // A member without a social profile cannot post either.
      const own = await session(lurker, "IT Lurker run");
      await rejects(createPost(lurker.db, lurker.id, { sessionId: own.id, caption: "", showsDuration: false }), "invalid");
    });

    it("never reveals the scheduled session behind a post", async () => {
      const read = await pub.db.from("session_posts").select("session_id").limit(1);
      expect(read.error?.code).toBe("42501");
    });

    it("lets only the author edit or delete", async () => {
      const s = await session(pub, "IT Owner only");
      const id = await createPost(pub.db, pub.id, { sessionId: s.id, caption: "Original", showsDuration: false });
      await rejects(updatePostCaption(fan.db, fan.id, id, "Hacked"), "not_found");
      await rejects(deletePost(fan.db, fan.id, id), "not_found");
      await rejects(updatePostCaption(pub.db, pub.id, id, "x".repeat(501)), "invalid");
      await updatePostCaption(pub.db, pub.id, id, "Edited");
      const edited = await getPost(fan.db, id);
      expect(edited).toMatchObject({ caption: "Edited" });
      expect(edited?.editedAt).not.toBeNull();
      await deletePost(pub.db, pub.id, id);
      expect(await getPost(pub.db, id)).toBeNull();
    });

    it("shows private posts only to approved followers, and revokes access", async () => {
      const s = await session(priv, "IT Private session");
      const id = await createPost(priv.db, priv.id, { sessionId: s.id, caption: "For followers", showsDuration: false });
      expect(await getPost(fan.db, id)).toBeNull();
      expect(await getPost(lurker.db, id)).toBeNull();
      expect((await listPosts(fan.db, { authorId: priv.id })).posts).toEqual([]);

      await followMember(fan.db, fan.id, priv.id);
      expect(await getPost(fan.db, id)).toBeNull(); // still pending
      await acceptFollowRequest(priv.db, priv.id, fan.id);
      expect((await getPost(fan.db, id))?.caption).toBe("For followers");
      expect((await listPosts(fan.db, {})).posts.map((p) => p.id)).toContain(id);

      await removeFollower(priv.db, priv.id, fan.id);
      expect(await getPost(fan.db, id)).toBeNull();
      expect((await listPosts(fan.db, {})).posts.map((p) => p.id)).not.toContain(id);
    });

    it("hides posts from non-followers when a profile switches to private", async () => {
      const user = await createTestUser("sswitch");
      const p = await profile(user, "public", "switch");
      const s = await session(user, "IT Switch session");
      const id = await createPost(user.db, user.id, { sessionId: s.id, caption: "Public for now", showsDuration: false });
      await followMember(fan.db, fan.id, user.id); // accepted (public)
      expect(await getPost(lurker.db, id)).not.toBeNull();

      await saveSocialProfile(user.db, user.id, { ...p, visibility: "private", useIdentityAvatar: false });
      expect(await getPost(lurker.db, id)).toBeNull();
      expect(await getPost(fan.db, id)).not.toBeNull(); // approved follower keeps access
    });

    it("lists sessions to post from, only the member's own", async () => {
      const mine = await session(fan, "IT Fan session");
      await session(pub, "IT Someone else");
      const sessions = await listPostableSessions(fan.db, fan.id, MONDAY);
      expect(sessions.map((s) => s.id)).toContain(mine.id);
      expect(sessions.every((s) => s.name !== "IT Someone else")).toBe(true);
    });
  });

  describe("feed", () => {
    it("is newest first, paginated, and holds own and followed posts only", async () => {
      const author = await createTestUser("sfeedauthor");
      await profile(author, "public", "feedauthor");
      const reader = await createTestUser("sfeedreader");
      await profile(reader, "private", "feedreader");
      const stranger = await createTestUser("sfeedstranger");
      await profile(stranger, "public", "feedstranger");

      expect((await listPosts(reader.db, {})).posts).toEqual([]); // empty feed

      const s = await session(author, "IT Feed session");
      const ids: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        ids.push(await createPost(author.db, author.id, { sessionId: s.id, caption: `Post ${i}`, showsDuration: false }));
      }
      const strangerSession = await session(stranger, "IT Stranger session");
      await createPost(stranger.db, stranger.id, { sessionId: strangerSession.id, caption: "Not followed", showsDuration: false });
      const ownSession = await session(reader, "IT Reader session");
      const ownId = await createPost(reader.db, reader.id, { sessionId: ownSession.id, caption: "Mine", showsDuration: false });

      await followMember(reader.db, reader.id, author.id);
      const first = await listPosts(reader.db, { limit: 4 });
      expect(first.posts.map((p) => p.caption)).toEqual(["Mine", "Post 4", "Post 3", "Post 2"]);
      expect(first.nextCursor).not.toBeNull();
      const second = await listPosts(reader.db, { limit: 4, cursor: first.nextCursor });
      expect(second.posts.map((p) => p.caption)).toEqual(["Post 1", "Post 0"]);
      expect(second.nextCursor).toBeNull();
      expect([...first.posts, ...second.posts].map((p) => p.id)).toEqual([ownId, ...ids.slice().reverse()]);

      // A tampered cursor is ignored: the first page again.
      expect((await listPosts(reader.db, { limit: 4, cursor: "not-a-cursor" })).posts[0]?.caption).toBe("Mine");
    });
  });

  describe("revoked members", () => {
    it("lose access, and disappear for everyone else", async () => {
      const user = await createTestUser("srevoked");
      const p = await profile(user, "public", "revoked");
      const s = await session(user, "IT Revoked session");
      const id = await createPost(user.db, user.id, { sessionId: s.id, caption: "Before", showsDuration: false });
      await followMember(user.db, user.id, pub.id);
      const before = (await getProfileCard(fan.db, pubName))!.followerCount;

      await service().from("profiles").update({ revoked_at: new Date().toISOString() }).eq("id", user.id);

      expect(await getProfileCard(fan.db, p.username)).toBeNull();
      expect(await getPost(fan.db, id)).toBeNull();
      expect(await searchProfiles(fan.db, p.username)).toEqual([]);
      expect((await getProfileCard(fan.db, pubName))!.followerCount).toBe(before - 1);

      expect(await getOwnSocialProfile(user.db, user.id)).toBeNull();
      expect((await listPosts(user.db, {})).posts).toEqual([]);
      expect(await getProfileCard(user.db, pubName)).toBeNull();
      await rejects(createPost(user.db, user.id, { sessionId: s.id, caption: "After", showsDuration: false }), "not_found");

      // Invited again: everything comes back.
      await service().from("profiles").update({ revoked_at: null }).eq("id", user.id);
      expect((await getPost(fan.db, id))?.caption).toBe("Before");
    });
  });

  describe("export and leaving", () => {
    it("exports the member's social data without emails or session ids, then deletes it", async () => {
      const user = await createTestUser("sexport");
      const p = await profile(user, "private", "export");
      const s = await session(user, "IT Export session");
      await createPost(user.db, user.id, { sessionId: s.id, caption: "Exported", showsDuration: false });
      await followMember(user.db, user.id, pub.id);

      const data = await exportUserData(user.db, user.id);
      expect(data).toMatchObject({ version: 6, complete: true, sections: { social: "included" } });
      expect(data.social!.profile).toMatchObject({ username: p.username, visibility: "private" });
      expect(data.social!.following).toEqual([expect.objectContaining({ username: pubName, status: "accepted" })]);
      expect(data.social!.posts.map((post) => post.caption)).toEqual(["Exported"]);
      expect(JSON.stringify(data.social)).not.toMatch(/@example\.test|session_id/);

      await deleteSocialProfile(user.db, user.id);
      expect(await getOwnSocialProfile(user.db, user.id)).toBeNull();
      expect((await exportUserData(user.db, user.id)).sessions.map((x) => x.id)).toContain(s.id); // the plan stays
      expect((await getProfileCard(fan.db, pubName))?.followerCount).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Deployed before the social migration: the API answers "not found" for the
 * social tables and functions. A client on the exposed but empty
 * `graphql_public` schema gets exactly those answers (PGRST205 / PGRST202),
 * as production did when the app went out ahead of its migration.
 */
describe.skipIf(!integrationReady)("social before its migration (local Supabase)", () => {
  let user: TestUser;
  let missing: Db;

  beforeAll(async () => {
    user = await createTestUser("snomig");
    // PostgREST picks the schema from these headers; graphql_public has no tables or social functions.
    missing = await user.clientWithFetch((input, init) => {
      const headers = new Headers(init?.headers);
      if (String(input).includes("/rest/v1/")) {
        headers.set("Accept-Profile", "graphql_public");
        headers.set("Content-Profile", "graphql_public");
      }
      return fetch(input, { ...init, headers });
    });
  });

  afterAll(async () => {
    if (!integrationReady) return;
    await deleteTestUsers();
  });

  const unavailable = (promise: Promise<unknown>) =>
    expect(promise).rejects.toBeInstanceOf(SocialUnavailableError);

  it("reports reads as unavailable, not as server errors", async () => {
    await unavailable(getOwnSocialProfile(missing, user.id));
    await unavailable(getProfileCard(missing, "someone"));
    await unavailable(searchProfiles(missing, "someone"));
    await unavailable(listPosts(missing, {}));
    await unavailable(countIncomingRequests(missing, user.id));
    await unavailable(exportSocialData(missing, user.id));
  });

  it("marks the social section unavailable in a download instead of exporting it as empty", async () => {
    // Only the social tables are hidden; the plan is readable as usual.
    const socialOnly = await user.clientWithFetch((input, init) => {
      const headers = new Headers(init?.headers);
      if (/\/rest\/v1\/(social_profiles|follows|session_posts|post_likes|post_comments)\b/.test(String(input))) {
        headers.set("Accept-Profile", "graphql_public");
      }
      return fetch(input, { ...init, headers });
    });
    const data = await exportUserData(socialOnly, user.id);
    expect(data).toMatchObject({ complete: false, sections: { sessions: "included", social: "unavailable" }, social: null });
  });

  it("reports writes as unavailable, with a message for the form", async () => {
    const error = await followMember(missing, user.id, crypto.randomUUID()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SocialUnavailableError);
    expect(error).toBeInstanceOf(DataError);
    expect((error as DataError).message).toMatch(/aren’t available right now/);
  });
});
