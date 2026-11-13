import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";

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
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl)) {
    throw new Error("Refusing to create test users outside the local Supabase stack");
  }
}

function serviceClient() {
  assertLocal();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  const admin = serviceClient();
  const { error } = await admin.from("profiles").upsert({ id: userId, display_name: displayName });
  if (error) throw new Error(`Could not create local profile: ${error.message}`);
  // Real members sign in with Google or GitHub on their invited address, and
  // membership requires such an identity (E2-D22). Give test members one.
  const user = await admin.auth.admin.getUserById(userId);
  const email = user.data.user?.email?.toLowerCase();
  if (!email || !ensureLocalGoogleIdentity(userId, email)) {
    throw new Error("Could not give the local member a Google identity (is the database container running?)");
  }
}

/** Adds a Google identity on `email` unless the user already has an OAuth identity on it. */
function ensureLocalGoogleIdentity(userId: string, email: string): boolean {
  if (!/^[0-9a-f-]{36}$/.test(userId) || !/^[\w.+-]+@[\w.-]+$/.test(email)) throw new Error("Bad fixture input");
  return localSql(
    `insert into auth.identities (provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
     select 'e2e-g-${userId}', '${userId}', 'google', '{"email": "${email}"}', now(), now(), now()
      where not exists (select 1 from auth.identities
                         where user_id = '${userId}' and provider in ('google', 'github') and email = '${email}');`,
  );
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

/** Reads rows as the service role, to check what really happened. */
export async function readRows(table: "routines" | "scheduled_sessions" | "invitations", filter: Record<string, string>) {
  let query = serviceClient().from(table).select("*");
  for (const [column, value] of Object.entries(filter)) query = query.eq(column, value);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Array<Record<string, unknown>>;
}

/**
 * Runs SQL in the LOCAL Supabase database container, for fixtures the API
 * cannot create (an OAuth identity linked to an existing user). It can only
 * reach the Docker container of this project's local stack; returns false when
 * that container is not available, so callers can skip.
 */
export function localSql(sql: string): boolean {
  const result = spawnSync(
    "docker",
    ["exec", "-i", "supabase_db_traingrid", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: sql, encoding: "utf8" },
  );
  return result.status === 0;
}

/** Links a Google identity with `email` to an existing local user, as Supabase Auth would. */
export function linkLocalGoogleIdentity(userId: string, email: string): boolean {
  if (!/^[0-9a-f-]{36}$/.test(userId) || !/^[\w.+-]+@[\w.-]+$/.test(email)) throw new Error("Bad fixture input");
  return localSql(
    `insert into auth.identities (provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
     values ('e2e-${crypto.randomUUID()}', '${userId}', 'google', '{"email": "${email}"}', now(), now(), now());`,
  );
}
