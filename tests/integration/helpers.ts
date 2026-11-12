import { createClient } from "@supabase/supabase-js";
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

export type TestUser = { id: string; email: string; db: Db };

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
  }

  const db = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign-in failed: ${signIn.error.message}`);
  return { id: data.user.id, email, db };
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
