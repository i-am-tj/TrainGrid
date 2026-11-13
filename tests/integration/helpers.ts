import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import type { Database } from "@/lib/database.types";
import type { Db } from "@/lib/data/model";

/**
 * Real users in the LOCAL Supabase stack, each with their own signed-in
 * client using the publishable key, exactly like the app. Nothing here can
 * point at a non-local project.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

export const integrationReady =
  /^http:\/\/(127\.0\.0\.1|localhost):/.test(url) && publishableKey !== "" && secretKey !== "";

export function service(): Db {
  if (!integrationReady) throw new Error("Integration tests need the local Supabase stack");
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestUser = {
  id: string;
  email: string;
  db: Db;
  /** Another signed-in client for the same user, with a custom fetch (to count requests). */
  clientWithFetch: (fetchImpl: typeof fetch) => Promise<Db>;
};

const created: string[] = [];

/** Creates a confirmed user, optionally a member, and returns their signed-in client. */
export async function createTestUser(label: string, { member = true } = {}): Promise<TestUser> {
  const admin = service();
  const email = `it-${label}-${crypto.randomUUID()}@example.test`;
  const password = `local-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.push(data.user.id);

  if (member) {
    const profile = await admin.from("profiles").insert({ id: data.user.id });
    if (profile.error) throw new Error(`profile insert failed: ${profile.error.message}`);
    // Members sign in with Google or GitHub on their invited address, and
    // membership requires such an identity (E2-D22).
    if (!linkGoogleIdentity(data.user.id, email)) throw new Error("Could not link a Google identity (database container?)");
  }

  const db = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign-in failed: ${signIn.error.message}`);
  const clientWithFetch = async (fetchImpl: typeof fetch) => {
    const client = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchImpl },
    });
    const again = await client.auth.signInWithPassword({ email, password });
    if (again.error) throw new Error(`sign-in failed: ${again.error.message}`);
    return client;
  };
  return { id: data.user.id, email, db, clientWithFetch };
}

/** A client with no session: the publishable key alone. */
export function anonymous(): Db {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Deletes every user this run created; their rows go with them (on delete cascade). */
export async function deleteTestUsers(): Promise<void> {
  const admin = service();
  while (created.length > 0) {
    const id = created.pop()!;
    await admin.auth.admin.deleteUser(id);
  }
}

/** Inserts a GLOBAL routine with items, as system content would be. */
export async function createGlobalRoutine(name: string, items: string[]): Promise<string> {
  const admin = service();
  const slug = `it-${crypto.randomUUID()}`;
  const routine = await admin
    .from("routines")
    .insert({ scope: "GLOBAL", slug, name, category: "strength" })
    .select("id")
    .single();
  if (routine.error) throw new Error(routine.error.message);
  const rows = items.map((item, i) => ({
    routine_id: routine.data.id,
    name: item,
    instruction: "3 × 8",
    equipment: ["barbell"],
    sort_order: i,
  }));
  const inserted = await admin.from("workout_items").insert(rows);
  if (inserted.error) throw new Error(inserted.error.message);
  return routine.data.id;
}

export async function deleteGlobalRoutine(id: string): Promise<void> {
  await service().from("routines").delete().eq("id", id);
}

/**
 * Runs SQL in the LOCAL Supabase database container, for auth fixtures the
 * API cannot create (an OAuth identity linked onto an existing user). Returns
 * false when the container is unavailable so callers can skip.
 */
export function localSql(sql: string): boolean {
  if (!integrationReady) return false;
  const result = spawnSync(
    "docker",
    ["exec", "-i", "supabase_db_traingrid", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: sql, encoding: "utf8" },
  );
  return result.status === 0;
}

/**
 * Links a Google identity with `email` onto an existing local user, the way
 * Supabase Auth's automatic linking does, and returns its provider id.
 */
export function linkGoogleIdentity(userId: string, email: string): string | null {
  if (!/^[0-9a-f-]{36}$/.test(userId) || !/^[\w.+-]+@[\w.-]+$/.test(email)) throw new Error("Bad fixture input");
  const providerId = `it-google-${crypto.randomUUID()}`;
  const ok = localSql(
    `insert into auth.identities (provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
     values ('${providerId}', '${userId}', 'google', '{"email": "${email}", "sub": "${providerId}"}', now(), now(), now());`,
  );
  return ok ? providerId : null;
}
