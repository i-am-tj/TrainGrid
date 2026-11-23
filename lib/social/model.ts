import { z } from "zod";
import { isIsoDate } from "@/lib/calendar-date";
import type { SessionType } from "@/lib/domain";
import { TYPE_SHORT } from "@/lib/ui";

/**
 * The social layer's shapes and rules, without Next.js or the database, so
 * they can be tested on their own. The database enforces the same limits
 * (supabase/migrations/20261122000000_social.sql); these give members a
 * clear message before a request is made.
 */

export type Visibility = "private" | "public";
export type FollowStatus = "pending" | "accepted";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const DISPLAY_NAME_MAX = 60;
export const BIO_MAX = 160;
export const CAPTION_MAX = 500;
export const COMMENT_MAX = 500;
export const POST_PAGE_SIZE = 20;
export const CONNECTIONS_PAGE_SIZE = 50;
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 60;

/** Matches the database: letters, digits and single underscores, not at either end. */
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|_(?!_)){1,28}[a-z0-9]$/;

/** Words that are routes or would mislead. Kept in step with the migration. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "about", "account", "admin", "administrator", "api", "edit", "everyone",
  "feed", "followers", "following", "help", "home", "login", "me", "new",
  "null", "people", "post", "posts", "profile", "requests", "root",
  "search", "settings", "support", "system", "traingrid", "undefined",
]);

/** "  @Ada_L " → "ada_l". */
export function normaliseUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Why a (normalised) username cannot be used, or null when it can. */
export function usernameProblem(username: string): string | null {
  if (username.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters.`;
  if (username.length > USERNAME_MAX) return `Use at most ${USERNAME_MAX} characters.`;
  if (!/^[a-z0-9_]+$/.test(username)) return "Use only letters, numbers and underscores.";
  if (!USERNAME_PATTERN.test(username)) return "Start and end with a letter or number, with no double underscores.";
  if (RESERVED_USERNAMES.has(username)) return "That username is reserved. Try another.";
  return null;
}

/** A starting suggestion from the member's name or email: "Ada Lovelace" → "ada_lovelace". */
export function suggestUsername(displayName: string | null, email: string | null): string {
  const fromName = (displayName ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  const fromEmail = (email ?? "").split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "_") ?? "";
  for (const candidate of [fromName, fromEmail]) {
    const cleaned = candidate.replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, USERNAME_MAX).replace(/_+$/, "");
    if (!usernameProblem(cleaned)) return cleaned;
    if (cleaned.length > 0 && cleaned.length < USERNAME_MIN) {
      const padded = `${cleaned}_trains`;
      if (!usernameProblem(padded)) return padded;
    }
  }
  return "";
}

export const usernameSchema = z
  .string()
  .transform(normaliseUsername)
  .superRefine((value, ctx) => {
    const problem = usernameProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

export const socialProfileInputSchema = z.object({
  username: usernameSchema,
  displayName: z
    .string()
    .trim()
    .min(1, "Add the name people will see.")
    .max(DISPLAY_NAME_MAX, `Keep your name to ${DISPLAY_NAME_MAX} characters.`),
  // Line breaks collapse to spaces: a bio is one short line.
  bio: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(BIO_MAX, `Keep your bio to ${BIO_MAX} characters.`)),
  visibility: z.enum(["private", "public"], { message: "Choose public or private." }),
  useIdentityAvatar: z.boolean(),
});

export type SocialProfileInput = z.input<typeof socialProfileInputSchema>;

export const captionSchema = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
  .pipe(z.string().max(CAPTION_MAX, `Keep your caption to ${CAPTION_MAX} characters.`));

export const postInputSchema = z.object({
  sessionId: z.uuid({ message: "Choose one of your sessions." }),
  caption: captionSchema,
  showsDuration: z.boolean(),
  /** Sets done in the finished workout; only used when there is one. */
  showsSets: z.boolean().default(false),
  /** Volume lifted in the finished workout; only used when there is one. */
  showsVolume: z.boolean().default(false),
});

export const commentBodySchema = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
  .pipe(
    z
      .string()
      .min(1, "Write a comment first.")
      .max(COMMENT_MAX, `Keep your comment to ${COMMENT_MAX} characters.`),
  );

export type PostInput = z.input<typeof postInputSchema>;

export const searchQuerySchema = z.string().trim().max(SEARCH_MAX);

// ---------------------------------------------------------------------------
// What pages read
// ---------------------------------------------------------------------------

/** A member as the social layer shows them: never an email address. */
export type SocialIdentity = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  visibility: Visibility;
};

export type OwnSocialProfile = SocialIdentity & {
  bio: string;
  useIdentityAvatar: boolean;
};

export type ProfileCard = SocialIdentity & {
  bio: string;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isSelf: boolean;
  /** The viewer's follow of this profile. */
  viewerFollow: FollowStatus | null;
  /** This profile's follow of the viewer. */
  followsViewer: FollowStatus | null;
  canViewPosts: boolean;
};

/** The session summary a post carries: a snapshot, fixed when it was posted. */
export type SessionSummary = {
  name: string;
  category: SessionType;
  date: string;
  durationMinutes: number | null;
};

/** What a post shares from a finished workout, fixed when it was posted. */
export type WorkoutShare = {
  /** The session had a finished workout when it was posted. */
  completed: boolean;
  /** Sets done, if the author chose to share it. */
  sets: number | null;
  /** Weight × reps over done sets, if the author chose to share it. */
  volume: number | null;
  unit: "kg" | "lb" | null;
};

export type PostView = {
  id: string;
  author: Pick<SocialIdentity, "userId" | "username" | "displayName" | "avatarUrl">;
  caption: string;
  session: SessionSummary;
  workout: WorkoutShare;
  likeCount: number;
  commentCount: number;
  viewerLiked: boolean;
  createdAt: string;
  editedAt: string | null;
};

export type CommentView = {
  id: string;
  postId: string;
  author: Pick<SocialIdentity, "userId" | "username" | "displayName" | "avatarUrl">;
  body: string;
  createdAt: string;
};

export type PostPage = { posts: PostView[]; nextCursor: string | null };

export type Connection = SocialIdentity & { since: string | null };

// ---------------------------------------------------------------------------
// Cursors: opaque to the URL, validated on the way back in
// ---------------------------------------------------------------------------

export type Cursor = { createdAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, "utf8").toString("base64url");
}

/** A cursor from the URL, or null when it is missing or not one of ours. */
export function decodeCursor(raw: unknown): Cursor | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [createdAt, id, ...rest] = decoded.split("|");
  if (rest.length > 0 || !createdAt || !id) return null;
  if (!z.uuid().safeParse(id).success) return null;
  if (!z.iso.datetime({ offset: true }).safeParse(createdAt).success) return null;
  return { createdAt, id };
}

/** "Lift · 47 min · 12 sets · 4,250 kg": the workout facts a post shares, after the session's. */
export function workoutParts(workout: WorkoutShare): string[] {
  const parts: string[] = [];
  if (workout.sets !== null) parts.push(`${workout.sets.toLocaleString("en-AU")} ${workout.sets === 1 ? "set" : "sets"}`);
  if (workout.volume !== null && workout.unit) parts.push(`${formatVolumeShort(workout.volume)} ${workout.unit} lifted`);
  return parts;
}

function formatVolumeShort(volume: number): string {
  if (volume >= 10000) return `${(Math.round(volume / 100) / 10).toLocaleString("en-AU")}k`;
  return (Math.round(volume * 10) / 10).toLocaleString("en-AU");
}

/** "1 like", "3 likes". */
export function countLabel(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-AU")} ${count === 1 ? one : many}`;
}

/** "1".."n" from the URL; anything else is the first page. */
export function pageNumber(raw: unknown, max = 1000): number {
  const n = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= max ? n : 1;
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

const DAY = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const DAY_YEAR = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "Tue 17 Nov" for a calendar date; the year when it is not `currentYear`. */
export function formatSessionDate(isoDate: string, currentYear?: number): string {
  if (!isIsoDate(isoDate)) return isoDate;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return (currentYear !== undefined && date.getUTCFullYear() !== currentYear ? DAY_YEAR : DAY).format(date).replace(",", "");
}

/** "45 min", "1 h", "1 h 30 min". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The parts of a session summary, in reading order: ["Lift", "Tue 17 Nov", "60 min"]. */
export function summaryParts(session: SessionSummary, currentYear?: number): string[] {
  return [
    TYPE_SHORT[session.category] ?? "Session",
    formatSessionDate(session.date, currentYear),
    session.durationMinutes != null ? formatMinutes(session.durationMinutes) : null,
  ].filter((part): part is string => part !== null);
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(timestamp: string, now: Date = new Date()): string {
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  const date = new Date(then);
  return (date.getUTCFullYear() === now.getUTCFullYear() ? DAY : DAY_YEAR).format(date).replace(",", "");
}

/** What the follow button says for a relationship. */
export function followLabel(card: Pick<ProfileCard, "visibility" | "viewerFollow" | "followsViewer">): string {
  if (card.viewerFollow === "accepted") return "Following";
  if (card.viewerFollow === "pending") return "Requested";
  if (card.followsViewer === "accepted") return "Follow back";
  return card.visibility === "private" ? "Request to follow" : "Follow";
}

/** Initials for a display name: "Ada Lovelace" → "AL". */
export function socialInitials(displayName: string, username: string): string {
  const words = displayName.trim().split(/\s+/).filter((word) => /\p{L}|\p{N}/u.test(word));
  if (words.length === 0) return (Array.from(username)[0] ?? "?").toLocaleUpperCase("en-AU");
  const first = Array.from(words[0]!)[0] ?? "";
  const last = words.length > 1 ? (Array.from(words.at(-1)!)[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("en-AU");
}

/**
 * Only https images from the sign-in providers are shown, and only because
 * the database copied them from the member's own sign-in picture.
 */
export function safeAvatarUrl(url: string | null | undefined): string | null {
  if (!url || url.length > 2048) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Same-site paths only, for "back to" links that travel in the URL. */
export function safeReturnPath(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw.length <= 200 ? raw : fallback;
}
