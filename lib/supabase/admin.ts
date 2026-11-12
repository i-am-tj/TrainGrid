import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase client that uses the secret key and therefore BYPASSES Row Level
 * Security.
 *
 * It exists for one purpose: managing invitations, a table no member may
 * touch. Callers must have established that the current user is an admin
 * before creating it. Never use it for ordinary reads or writes of user
 * data; those go through the per-request client so RLS stays in force.
 *
 * `server-only` makes the build fail if this module is ever imported from
 * client code, so the key cannot reach a browser bundle.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set.");
  }
  if (secretKey.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SECRET_KEY contains a publishable key. Use the secret key.");
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function isSecretKeyConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
}
