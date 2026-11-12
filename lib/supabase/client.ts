"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase client for Client Components.
 *
 * Uses the publishable key and the signed-in user's cookie session, so every
 * query is subject to Row Level Security.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
