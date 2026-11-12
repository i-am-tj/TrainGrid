import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Create one per request; never share it between requests. It uses the
 * publishable key and the caller's cookie session, so every query runs as
 * that user and is subject to Row Level Security.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. That is fine: the proxy
          // refreshes the session on every request and writes them there.
        }
      },
    },
  });
}
