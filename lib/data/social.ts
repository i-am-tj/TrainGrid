import { addDays } from "@/lib/calendar-date";
import type { TablesInsert } from "@/lib/database.types";
import type { SessionType } from "@/lib/domain";
import {
  CONNECTIONS_PAGE_SIZE,
  POST_PAGE_SIZE,
  SEARCH_MIN,
  decodeCursor,
  encodeCursor,
  postInputSchema,
  captionSchema,
  searchQuerySchema,
  socialProfileInputSchema,
  type Connection,
  type FollowStatus,
  type OwnSocialProfile,
  type PostInput,
  type PostPage,
  type PostView,
  type ProfileCard,
  type SocialIdentity,
  type SocialProfileInput,
  type Visibility,
} from "@/lib/social/model";
import { SocialUnavailableError, socialFailure } from "@/lib/social/availability";
import { DataError, type Db } from "./model";
import { idSchema } from "./schemas";
import { validate } from "./validate";

/**
 * The social layer: profiles, follows and session posts.
 *
 * Every call runs as the signed-in member, so Row Level Security decides
 * what exists (supabase/migrations/20261122000000_social.sql). Writes are
 * also narrowed to the member's own rows here, and `userId` always comes
 * from the verified session, never from the request.
 *
 * Nothing here reads an email address, a post's scheduled session id, or a
 * session's start time, notes or workout.
 */

const IDENTITY_COLUMNS = "user_id, username, display_name, avatar_url, visibility";
const POST_COLUMNS =
  "id, caption, session_name, session_category, session_date, session_duration_minutes, created_at, edited_at, author:social_profiles!inner(user_id, username, display_name, avatar_url)";

type IdentityRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  visibility: string;
};

function identityFromRow(row: IdentityRow): SocialIdentity {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    visibility: row.visibility === "public" ? "public" : "private",
  };
}

const followStatus = (value: string | null | undefined): FollowStatus | null =>
  value === "accepted" || value === "pending" ? value : null;

// ---------------------------------------------------------------------------
// Your own profile
// ---------------------------------------------------------------------------

export async function getOwnSocialProfile(db: Db, userId: string): Promise<OwnSocialProfile | null> {
  const { data, error } = await db
    .from("social_profiles")
    .select(`${IDENTITY_COLUMNS}, bio, use_identity_avatar`)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw socialFailure(error, "Could not load your social profile.");
  if (!data) return null;
  return { ...identityFromRow(data), bio: data.bio, useIdentityAvatar: data.use_identity_avatar };
}

/** Creates or updates the member's social profile. A taken username is an "invalid" error. */
export async function saveSocialProfile(
  db: Db,
  userId: string,
  input: SocialProfileInput,
): Promise<OwnSocialProfile> {
  const parsed = validate(socialProfileInputSchema, input);
  const row = {
    username: parsed.username,
    display_name: parsed.displayName,
    bio: parsed.bio,
    visibility: parsed.visibility,
    use_identity_avatar: parsed.useIdentityAvatar,
  };
  const existing = await getOwnSocialProfile(db, userId);
  const result = existing
    ? await db.from("social_profiles").update(row).eq("user_id", userId).select("user_id").maybeSingle()
    : await db.from("social_profiles").insert(row).select("user_id").single();
  if (result.error) {
    if (result.error.code === "23505") throw new DataError("invalid", "That username is taken. Try another.");
    if (result.error.code === "23514") throw new DataError("invalid", "That username can’t be used. Try another.");
    throw socialFailure(result.error, "Could not save your social profile.");
  }
  if (!result.data) throw new DataError("not_found", "Social profile not found.");
  const saved = await getOwnSocialProfile(db, userId);
  if (!saved) throw new DataError("not_found", "Social profile not found.");
  return saved;
}

/** Deletes the member's social profile with every post and relationship. Their plan is untouched. */
export async function deleteSocialProfile(db: Db, userId: string): Promise<void> {
  const { error } = await db.from("social_profiles").delete().eq("user_id", userId);
  if (error) throw socialFailure(error, "Could not delete your social profile.");
}

/** Whether a username is free (true), taken (false); the member's own counts as free. */
export async function isUsernameAvailable(db: Db, userId: string, username: string): Promise<boolean> {
  const { data, error } = await db.from("social_profiles").select("user_id").eq("username", username).maybeSingle();
  if (error) throw socialFailure(error, "Could not check that username.");
  return !data || data.user_id === userId;
}

// ---------------------------------------------------------------------------
// Profiles and discovery
// ---------------------------------------------------------------------------

/** One profile as the member sees it, or null when it does not exist for them. */
export async function getProfileCard(db: Db, rawUsername: unknown): Promise<ProfileCard | null> {
  if (typeof rawUsername !== "string" || rawUsername.length > 64) return null;
  const { data, error } = await db.rpc("social_profile", { p_username: rawUsername });
  if (error) throw socialFailure(error, "Could not load that profile.");
  const row = data?.[0];
  if (!row) return null;
  return {
    ...identityFromRow(row),
    bio: row.bio,
    createdAt: row.created_at,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    postCount: row.post_count,
    isSelf: row.is_self,
    viewerFollow: followStatus(row.viewer_follow),
    followsViewer: followStatus(row.follows_viewer),
    canViewPosts: row.can_view_posts,
  };
}

export type ProfileListItem = SocialIdentity & { bio: string };

/** Members by username or display name; empty below two characters. */
export async function searchProfiles(db: Db, rawQuery: unknown): Promise<ProfileListItem[]> {
  const query = searchQuerySchema.safeParse(rawQuery);
  if (!query.success || query.data.replace(/^@/, "").length < SEARCH_MIN) return [];
  const { data, error } = await db.rpc("search_social_profiles", { p_query: query.data, p_limit: 20 });
  if (error) throw socialFailure(error, "Could not search members.");
  return data.map((row) => ({ ...identityFromRow(row), bio: row.bio }));
}

/** Newest social profiles, for the discovery page before a search. */
export async function listNewestProfiles(db: Db, userId: string, limit = 12): Promise<ProfileListItem[]> {
  const { data, error } = await db
    .from("social_profiles")
    .select(`${IDENTITY_COLUMNS}, bio`)
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw socialFailure(error, "Could not load members.");
  return data.map((row) => ({ ...identityFromRow(row), bio: row.bio }));
}

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

/** Follows a public profile, or requests to follow a private one. Idempotent. */
export async function followMember(db: Db, userId: string, rawTargetId: unknown): Promise<FollowStatus> {
  const target = idSchema.safeParse(rawTargetId);
  if (!target.success) throw new DataError("not_found", "Member not found.");
  if (target.data === userId) throw new DataError("invalid", "You can’t follow yourself.");

  const { data, error } = await db.from("follows").insert({ followee_id: target.data }).select("status").single();
  if (!error) return followStatus(data.status) ?? "pending";
  if (error.code === "23505") {
    const existing = await db
      .from("follows")
      .select("status")
      .eq("follower_id", userId)
      .eq("followee_id", target.data)
      .maybeSingle();
    const status = followStatus(existing.data?.status);
    if (status) return status;
  }
  if (error.message.includes("follow_rate_limited")) {
    throw new DataError("invalid", "That’s a lot of follows today. Try again tomorrow.");
  }
  if (error.code === "42501") {
    // Refused by RLS: either the caller has no social profile, or the target
    // is not a visible member. Tell the caller which, without saying more.
    if (!(await getOwnSocialProfile(db, userId))) {
      throw new DataError("invalid", "Set up your social profile before following people.");
    }
    throw new DataError("not_found", "Member not found.");
  }
  if (error.code === "23503") throw new DataError("not_found", "Member not found.");
  throw socialFailure(error, "Could not follow that member.");
}

/** Unfollows, or cancels a pending request. Nothing to undo is not an error. */
export async function unfollowMember(db: Db, userId: string, rawTargetId: unknown): Promise<void> {
  const target = idSchema.safeParse(rawTargetId);
  if (!target.success) throw new DataError("not_found", "Member not found.");
  const { error } = await db.from("follows").delete().eq("follower_id", userId).eq("followee_id", target.data);
  if (error) throw socialFailure(error, "Could not unfollow that member.");
}

/** Approves a pending request to follow the member. */
export async function acceptFollowRequest(db: Db, userId: string, rawFollowerId: unknown): Promise<void> {
  const follower = idSchema.safeParse(rawFollowerId);
  if (!follower.success) throw new DataError("not_found", "Request not found.");
  const { data, error } = await db
    .from("follows")
    .update({ status: "accepted" })
    .eq("followee_id", userId)
    .eq("follower_id", follower.data)
    .eq("status", "pending")
    .select("status");
  if (error) throw socialFailure(error, "Could not approve that request.");
  if (data.length === 0) throw new DataError("not_found", "Request not found.");
}

/** Declines a pending request to follow the member. */
export async function rejectFollowRequest(db: Db, userId: string, rawFollowerId: unknown): Promise<void> {
  await deleteIncoming(db, userId, rawFollowerId, "pending", "Request not found.");
}

/** Removes an accepted follower: they lose access to a private profile at once. */
export async function removeFollower(db: Db, userId: string, rawFollowerId: unknown): Promise<void> {
  await deleteIncoming(db, userId, rawFollowerId, "accepted", "Follower not found.");
}

async function deleteIncoming(db: Db, userId: string, rawFollowerId: unknown, status: FollowStatus, missing: string) {
  const follower = idSchema.safeParse(rawFollowerId);
  if (!follower.success) throw new DataError("not_found", missing);
  const { data, error } = await db
    .from("follows")
    .delete()
    .eq("followee_id", userId)
    .eq("follower_id", follower.data)
    .eq("status", status)
    .select("status");
  if (error) throw socialFailure(error, "Could not update your followers.");
  if (data.length === 0) throw new DataError("not_found", missing);
}

export type FollowRequests = { incoming: Connection[]; outgoing: Connection[] };

/** Requests waiting for the member's answer, and the member's own waiting requests. */
export async function listFollowRequests(db: Db, userId: string): Promise<FollowRequests> {
  const [incoming, outgoing] = await Promise.all([
    db
      .from("follows")
      .select(`created_at, profile:social_profiles!follows_follower_id_fkey!inner(${IDENTITY_COLUMNS})`)
      .eq("followee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("follows")
      .select(`created_at, profile:social_profiles!follows_followee_id_fkey!inner(${IDENTITY_COLUMNS})`)
      .eq("follower_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (incoming.error || outgoing.error) throw socialFailure(incoming.error ?? outgoing.error, "Could not load your requests.");
  const toConnection = (row: { created_at: string; profile: IdentityRow }): Connection => ({
    ...identityFromRow(row.profile),
    since: row.created_at,
  });
  return { incoming: incoming.data.map(toConnection), outgoing: outgoing.data.map(toConnection) };
}

/** How many people are waiting for the member to answer. */
export async function countIncomingRequests(db: Db, userId: string): Promise<number> {
  const { count, error } = await db
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("followee_id", userId)
    .eq("status", "pending");
  if (error) throw socialFailure(error, "Could not count your requests.");
  // A HEAD request has no body, so a missing table comes back as no error and
  // no count (supabase-js reports 204); a working count is always a number.
  if (count === null) throw new SocialUnavailableError();
  return count;
}

export type ConnectionPage = { people: Connection[]; page: number; hasMore: boolean };

/**
 * A profile's followers or following, newest first. RLS shows only what the
 * member may see; callers check the profile's `canViewPosts` first so a
 * private list reads as private rather than empty.
 */
export async function listConnections(
  db: Db,
  rawProfileId: unknown,
  kind: "followers" | "following",
  page = 1,
): Promise<ConnectionPage> {
  const profileId = idSchema.safeParse(rawProfileId);
  if (!profileId.success) return { people: [], page: 1, hasMore: false };
  const from = (page - 1) * CONNECTIONS_PAGE_SIZE;
  const embed =
    kind === "followers"
      ? `profile:social_profiles!follows_follower_id_fkey!inner(${IDENTITY_COLUMNS})`
      : `profile:social_profiles!follows_followee_id_fkey!inner(${IDENTITY_COLUMNS})`;
  const { data, error } = await db
    .from("follows")
    .select(`accepted_at, ${embed}`)
    .eq(kind === "followers" ? "followee_id" : "follower_id", profileId.data)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .order(kind === "followers" ? "follower_id" : "followee_id")
    .range(from, from + CONNECTIONS_PAGE_SIZE);
  if (error) throw socialFailure(error, "Could not load that list.");
  const rows = data as unknown as Array<{ accepted_at: string | null; profile: IdentityRow }>;
  return {
    people: rows.slice(0, CONNECTIONS_PAGE_SIZE).map((row) => ({ ...identityFromRow(row.profile), since: row.accepted_at })),
    page,
    hasMore: rows.length > CONNECTIONS_PAGE_SIZE,
  };
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

type PostRpcRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  caption: string;
  session_name: string;
  session_category: string;
  session_date: string;
  session_duration_minutes: number | null;
  created_at: string;
  edited_at: string | null;
};

function postFromRpc(row: PostRpcRow): PostView {
  return {
    id: row.id,
    author: {
      userId: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
    },
    caption: row.caption,
    session: {
      name: row.session_name,
      category: row.session_category as SessionType,
      date: row.session_date,
      durationMinutes: row.session_duration_minutes,
    },
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

/**
 * The member's feed (no author) or one member's timeline, newest first.
 * One extra row is read to know whether there is a next page.
 */
export async function listPosts(
  db: Db,
  { authorId, cursor, limit = POST_PAGE_SIZE }: { authorId?: string; cursor?: unknown; limit?: number },
): Promise<PostPage> {
  const after = decodeCursor(cursor);
  const pageSize = Math.min(Math.max(limit, 1), 49);
  const { data, error } = await db.rpc("social_posts", {
    p_author: authorId,
    p_before_created_at: after?.createdAt,
    p_before_id: after?.id,
    p_limit: pageSize + 1,
  });
  if (error) throw socialFailure(error, "Could not load posts.");
  const posts = (data as PostRpcRow[]).map(postFromRpc);
  const page = posts.slice(0, pageSize);
  const last = page.at(-1);
  return {
    posts: page,
    nextCursor: posts.length > pageSize && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  };
}

type PostRow = {
  id: string;
  caption: string;
  session_name: string;
  session_category: string;
  session_date: string;
  session_duration_minutes: number | null;
  created_at: string;
  edited_at: string | null;
  author: { user_id: string; username: string; display_name: string; avatar_url: string | null };
};

/** One post, if the member may see it. */
export async function getPost(db: Db, rawId: unknown): Promise<PostView | null> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return null;
  const { data, error } = await db.from("session_posts").select(POST_COLUMNS).eq("id", id.data).maybeSingle();
  if (error) throw socialFailure(error, "Could not load that post.");
  if (!data) return null;
  const row = data as unknown as PostRow;
  return postFromRpc({
    ...row,
    author_id: row.author.user_id,
    author_username: row.author.username,
    author_display_name: row.author.display_name,
    author_avatar_url: row.author.avatar_url,
  });
}

const POST_ERRORS: Record<string, string> = {
  post_session_not_found: "That session isn’t one of yours, or it no longer exists.",
  post_session_required: "Choose one of your sessions.",
  post_rate_limited: "That’s a lot of updates today. Post more tomorrow.",
};

/**
 * Posts about one of the member's own sessions. The database copies the
 * summary (name, category, date and, only when chosen, the duration) from
 * the session itself; nothing else of it is shared.
 */
export async function createPost(db: Db, userId: string, input: PostInput): Promise<string> {
  const parsed = validate(postInputSchema, input);
  const { data, error } = await db
    .from("session_posts")
    // The snapshot columns are required by the table but filled by the
    // database from the session (trigger session_posts_before_insert); they
    // cannot be supplied through the API, so the generated type is widened here.
    .insert({
      session_id: parsed.sessionId,
      caption: parsed.caption,
      shows_duration: parsed.showsDuration,
    } as TablesInsert<"session_posts">)
    .select("id, author_id")
    .single();
  if (error) {
    const known = Object.keys(POST_ERRORS).find((key) => error.message.includes(key));
    if (known) throw new DataError(known === "post_session_not_found" ? "not_found" : "invalid", POST_ERRORS[known]!);
    if (error.code === "42501") throw new DataError("invalid", "Set up your social profile before posting.");
    throw socialFailure(error, "Could not publish your update.");
  }
  if (data.author_id !== userId) throw new Error("Could not publish your update.");
  return data.id;
}

/** Changes the caption of one of the member's own posts. The session summary never changes. */
export async function updatePostCaption(db: Db, userId: string, rawId: unknown, rawCaption: unknown): Promise<void> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) throw new DataError("not_found", "Post not found.");
  const caption = validate(captionSchema, rawCaption);
  const { data, error } = await db
    .from("session_posts")
    .update({ caption })
    .eq("id", id.data)
    .eq("author_id", userId)
    .select("id");
  if (error) throw socialFailure(error, "Could not save your post.");
  if (data.length === 0) throw new DataError("not_found", "Post not found.");
}

export async function deletePost(db: Db, userId: string, rawId: unknown): Promise<void> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) throw new DataError("not_found", "Post not found.");
  const { data, error } = await db.from("session_posts").delete().eq("id", id.data).eq("author_id", userId).select("id");
  if (error) throw socialFailure(error, "Could not delete your post.");
  if (data.length === 0) throw new DataError("not_found", "Post not found.");
}

export type PostableSession = {
  id: string;
  name: string;
  category: SessionType;
  date: string;
  durationMinutes: number | null;
};

/** The member's sessions from three weeks ago to a week ahead, newest first, to pick one to post. */
export async function listPostableSessions(db: Db, userId: string, todayIso: string): Promise<PostableSession[]> {
  const { data, error } = await db
    .from("scheduled_sessions")
    .select("id, name, category, date, duration_minutes")
    .eq("user_id", userId)
    .gte("date", addDays(todayIso, -21))
    .lte("date", addDays(todayIso, 7))
    .order("date", { ascending: false })
    .order("start_time", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw socialFailure(error, "Could not load your sessions.");
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category as SessionType,
    date: row.date,
    durationMinutes: row.duration_minutes,
  }));
}

/** The member's own social data, for the data download: usernames, never user ids or emails. */
export async function exportSocialData(db: Db, userId: string) {
  const [profile, following, followers, posts] = await Promise.all([
    getOwnSocialProfile(db, userId),
    db
      .from("follows")
      .select("status, created_at, accepted_at, profile:social_profiles!follows_followee_id_fkey!inner(username)")
      .eq("follower_id", userId)
      .order("created_at")
      .limit(1000),
    db
      .from("follows")
      .select("status, created_at, accepted_at, profile:social_profiles!follows_follower_id_fkey!inner(username)")
      .eq("followee_id", userId)
      .order("created_at")
      .limit(1000),
    db
      .from("session_posts")
      .select("id, caption, session_name, session_category, session_date, session_duration_minutes, created_at, edited_at")
      .eq("author_id", userId)
      .order("created_at")
      .limit(5000),
  ]);
  if (following.error || followers.error || posts.error) {
    throw socialFailure(following.error ?? followers.error ?? posts.error, "Could not export your social data.");
  }
  type Row = { status: string; created_at: string; accepted_at: string | null; profile: { username: string } };
  const relation = (row: Row) => ({ username: row.profile.username, status: row.status, since: row.accepted_at ?? row.created_at });
  return {
    profile: profile
      ? {
          username: profile.username,
          displayName: profile.displayName,
          bio: profile.bio,
          visibility: profile.visibility as Visibility,
          useIdentityAvatar: profile.useIdentityAvatar,
        }
      : null,
    following: (following.data as unknown as Row[]).map(relation),
    followers: (followers.data as unknown as Row[]).map(relation),
    posts: posts.data.map((row) => ({
      id: row.id,
      caption: row.caption,
      session: {
        name: row.session_name,
        category: row.session_category,
        date: row.session_date,
        durationMinutes: row.session_duration_minutes,
      },
      createdAt: row.created_at,
      editedAt: row.edited_at,
    })),
  };
}

export type SocialExport = Awaited<ReturnType<typeof exportSocialData>>;
