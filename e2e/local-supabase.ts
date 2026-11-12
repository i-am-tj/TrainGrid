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
  const { error } = await serviceClient()
    .from("profiles")
    .upsert({ id: userId, display_name: displayName });
  if (error) throw new Error(`Could not create local profile: ${error.message}`);
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
