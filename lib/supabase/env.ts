/**
 * Public Supabase configuration.
 *
 * Both values are safe to expose to the browser: the URL identifies the
 * project and the publishable key only grants what Row Level Security allows.
 * The secret key is deliberately not read here; see `lib/supabase/admin.ts`
 * when the admin flow introduces it.
 *
 * The `process.env.NEXT_PUBLIC_*` references must stay as literal property
 * accesses so Next.js can inline them into client bundles.
 */

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

export function readSupabaseEnv(
  url: string | undefined,
  publishableKey: string | undefined,
): SupabaseEnv | null {
  const trimmedUrl = url?.trim();
  const trimmedKey = publishableKey?.trim();
  if (!trimmedUrl || !trimmedKey) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  // Refuse a secret or legacy service-role key in the public slot. A secret
  // key here would be shipped to every browser.
  if (looksLikeSecretKey(trimmedKey)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a secret key. Use the publishable key.",
    );
  }

  return { url: trimmedUrl.replace(/\/+$/, ""), publishableKey: trimmedKey };
}

export function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  // Legacy keys are JWTs whose payload names the role.
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

/** Returns the configuration, or null when Supabase is not configured. */
export function getSupabaseEnv(): SupabaseEnv | null {
  return readSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Returns the configuration, or throws when Supabase is not configured. */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return env;
}
