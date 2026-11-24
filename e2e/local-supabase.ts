import { isLocalSupabaseOrigin } from "../lib/supabase/local-origin";
import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Helpers that create users in the LOCAL Supabase stack for E2E tests.
 * Every helper refuses to run against anything but a local URL.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

/** Fixed id of the local E2E admin; playwright.config.ts lists it in TRAINGRID_ADMIN_USER_IDS. */
export const LOCAL_ADMIN_ID = "e2e00000-0000-4000-8000-00000000ad01";
const LOCAL_ADMIN_EMAIL = "e2e-admin@example.test";

export type SupabaseState = "ok" | "unconfigured" | "unreachable";

export async function supabaseState(baseURL: string): Promise<SupabaseState> {
  const response = await fetch(`${baseURL}/api/health`);
  const body = (await response.json()) as { supabase: SupabaseState };
  return body.supabase;
}

export function hasLocalSecretKey(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

function assertLocal() {
  if (!isLocalSupabaseOrigin(supabaseUrl)) {
    throw new Error("Refusing to create test users outside the local Supabase stack");
  }
}

export function serviceClient() {
  assertLocal();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Keep member content out of public documentation screenshots. */
export async function requireEmptyCaptureDirectory() {
  const { count, error } = await serviceClient()
    .from("social_profiles")
    .select("user_id", { count: "exact", head: true });
  if (error || count !== 0) throw new Error("Social screenshots require an empty local social directory.");
}

/** A cookie-backed client, so a sign-in produces the same cookies the app reads. */
function cookieClient() {
  assertLocal();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  const jar = new Map<string, string>();
  const client = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  return { client, jar };
}

async function adoptSession(context: BrowserContext, baseURL: string, jar: Map<string, string>) {
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL })));
}

/** Creates a throwaway user and signs the browser in as them. They are not a member. */
export async function signInAsNewLocalUser(context: BrowserContext, baseURL: string) {
  const { client, jar } = cookieClient();
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const { data, error } = await client.auth.signUp({
    email,
    password: `local-${crypto.randomUUID()}`,
  });
  if (error || !data.session) throw new Error(`Local sign-up failed: ${error?.message}`);
  await adoptSession(context, baseURL, jar);
  return { email, userId: data.session.user.id };
}

/**
 * Makes a local test user a member by creating their profile directly.
 * Real members are only ever provisioned by accept_invitation(); that path is
 * covered by the database tests, since it needs a Google or GitHub identity.
 */
export async function makeLocalMember(userId: string, displayName = "E2E Member") {
  const { error } = await serviceClient()
    .from("profiles")
    .upsert({ id: userId, display_name: displayName });
  if (error) throw new Error(`Could not create local profile: ${error.message}`);
}

/** Makes a member's profile look a day old, as for a member who joined in an earlier session. */
export async function backdateLocalProfile(userId: string) {
  const { error } = await serviceClient()
    .from("profiles")
    .update({ created_at: new Date(Date.now() - 86_400_000).toISOString() })
    .eq("id", userId);
  if (error) throw new Error(`Could not backdate local profile: ${error.message}`);
}

/** Creates a throwaway member and signs the browser in as them. */
export async function signInAsNewLocalMember(context: BrowserContext, baseURL: string) {
  const user = await signInAsNewLocalUser(context, baseURL);
  await makeLocalMember(user.userId);
  return user;
}

/** Signs the browser in as the fixed local admin, creating them on first use. */
export async function signInAsLocalAdmin(context: BrowserContext, baseURL: string) {
  const admin = serviceClient();
  const password = `local-${crypto.randomUUID()}`;

  const created = await admin.auth.admin.createUser({
    id: LOCAL_ADMIN_ID,
    email: LOCAL_ADMIN_EMAIL,
    password,
    email_confirm: true,
  });
  if (created.error) {
    // Already exists from an earlier run: give them a fresh password.
    const updated = await admin.auth.admin.updateUserById(LOCAL_ADMIN_ID, { password });
    if (updated.error) throw new Error(`Could not prepare local admin: ${updated.error.message}`);
  }
  await makeLocalMember(LOCAL_ADMIN_ID, "E2E Admin");

  const { client, jar } = cookieClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: LOCAL_ADMIN_EMAIL,
    password,
  });
  if (error || !data.session) throw new Error(`Local admin sign-in failed: ${error?.message}`);
  await adoptSession(context, baseURL, jar);
}

/** Removes invite requests from E2E runs (all on example.test), so limits start fresh. */
export async function deleteLocalInviteRequests() {
  await serviceClient().from("invite_requests").delete().like("email", "%@example.test");
}

/** An invitation that was revoked before anyone accepted it. */
export async function createRevokedInvitation(email: string) {
  const { error } = await serviceClient().from("invitations").insert({ email, revoked_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Removes invitations created by E2E runs. */
export async function deleteLocalInvitations(emails: string[]) {
  if (emails.length === 0) return;
  await serviceClient().from("invitations").delete().in("email", emails);
}

/** Records that a user accepted an invitation for their email, as accept_invitation() would. */
export async function createAcceptedInvitation(email: string, userId: string) {
  const { error } = await serviceClient()
    .from("invitations")
    .insert({ email: email.toLowerCase(), accepted_at: new Date().toISOString(), accepted_by: userId });
  if (error) throw new Error(`Could not create accepted invitation: ${error.message}`);
}

/** Inserts a PERSONAL routine with one item directly for a user (test fixture). */
export async function createLocalRoutineFor(userId: string, name: string): Promise<string> {
  const db = serviceClient();
  const routine = await db
    .from("routines")
    .insert({ scope: "PERSONAL", owner_user_id: userId, name, category: "running" })
    .select("id")
    .single();
  if (routine.error) throw new Error(routine.error.message);
  const item = await db
    .from("workout_items")
    .insert({ routine_id: routine.data.id, name: `${name} item`, instruction: "original", sort_order: 0 });
  if (item.error) throw new Error(item.error.message);
  return routine.data.id;
}

/** Inserts a scheduled session directly for a user (test fixture). */
export async function createLocalSessionFor(userId: string, name: string, date: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from("scheduled_sessions")
    .insert({
      user_id: userId,
      date,
      start_time: "06:00",
      name,
      category: "running",
      snapshot: {
        version: 1,
        items: [
          {
            id: crypto.randomUUID(),
            source_item_id: null,
            name: "Original item",
            instruction: "original",
            rest: "",
            target: "",
            notes: "",
            equipment: [],
            video_url: null,
          },
        ],
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** A session with nothing planned in it (a blank session, or a quick workout's session). */
export async function createLocalEmptySessionFor(userId: string, name: string, date: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from("scheduled_sessions")
    .insert({ user_id: userId, date, start_time: null, name, category: "other", snapshot: { version: 1, items: [] } })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** A strength session for today with a loaded lift and a bodyweight move (live workout tests). */
export async function createLocalWorkoutSessionFor(userId: string, name: string, date: string): Promise<string> {
  const item = (name: string, instruction: string, rest: string, equipment: string[]) => ({
    id: crypto.randomUUID(),
    source_item_id: null,
    name,
    instruction,
    rest,
    target: "",
    notes: "",
    equipment,
    video_url: null,
  });
  const { data, error } = await serviceClient()
    .from("scheduled_sessions")
    .insert({
      user_id: userId,
      date,
      start_time: null,
      name,
      category: "strength",
      snapshot: {
        version: 1,
        items: [
          item("Bench Press", "2 × 5", "60 sec", ["barbell", "bench"]),
          item("Push-up", "1 × 10", "", ["bodyweight"]),
        ],
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Reads rows as the service role, to check what really happened. */
export async function readRows(
  table: "routines" | "scheduled_sessions" | "invitations" | "invitation_email_deliveries" | "member_feedback" | "invite_requests" | "workout_logs",
  filter: Record<string, string>) {
  let query = serviceClient().from(table).select("*");
  for (const [column, value] of Object.entries(filter)) query = query.eq(column, value);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Array<Record<string, unknown>>;
}

/** Marks a session as scheduled from a routine (as scheduling from the library does). */
export async function linkSessionToRoutine(sessionId: string, routineId: string) {
  const { error } = await serviceClient()
    .from("scheduled_sessions")
    .update({ source_routine_id: routineId })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

/** Gives a local member a social profile directly (test fixture). New profiles are private unless asked. */
export async function createLocalSocialProfile(
  userId: string,
  fields: { username: string; displayName: string; bio?: string; visibility?: "public" | "private" },
) {
  const { error } = await serviceClient()
    .from("social_profiles")
    .insert({
      user_id: userId,
      username: fields.username,
      display_name: fields.displayName,
      bio: fields.bio ?? "",
      visibility: fields.visibility ?? "private",
    });
  if (error) throw new Error(`Could not create social profile: ${error.message}`);
}

/** A follow between two local members, approved or pending (test fixture). */
export async function createLocalFollow(followerId: string, followeeId: string, status: "accepted" | "pending" = "accepted") {
  const db = serviceClient();
  const inserted = await db.from("follows").insert({ follower_id: followerId, followee_id: followeeId });
  if (inserted.error) throw new Error(`Could not create follow: ${inserted.error.message}`);
  // The database decides the status from the profile's visibility; fix it up as asked.
  const updated = await db
    .from("follows")
    .update({ status, accepted_at: status === "accepted" ? new Date().toISOString() : null })
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId);
  if (updated.error) throw new Error(`Could not set follow status: ${updated.error.message}`);
}

/** A session post by a member about one of their own sessions; the database copies the summary. */
export async function createLocalPostFor(
  userId: string,
  sessionId: string,
  caption: string,
  showsDuration = false,
  createdAt?: string,
) {
  const { data, error } = await serviceClient()
    .from("session_posts")
    .insert({
      author_id: userId,
      session_id: sessionId,
      caption,
      shows_duration: showsDuration,
      ...(createdAt ? { created_at: createdAt } : {}),
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`Could not create post: ${error.message}`);
  return (data as { id: string }).id;
}

/** Revokes a local member's access, as an admin would (data kept). */
export async function revokeLocalMember(userId: string) {
  const { error } = await serviceClient().from("profiles").update({ revoked_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw new Error(`Could not revoke member: ${error.message}`);
}
