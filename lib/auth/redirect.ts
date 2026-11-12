/**
 * Helpers for building redirects during sign-in.
 * Pure functions: no Next.js or Supabase imports, so they are unit-testable.
 */

const DEFAULT_NEXT_PATH = "/";

/**
 * Returns a same-site path to send the user to after sign-in.
 *
 * Anything that is not a plain absolute path on this site falls back to "/",
 * so a crafted link cannot bounce a freshly signed-in user to another origin.
 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NEXT_PATH;
  const value = raw.trim();
  if (!value.startsWith("/")) return DEFAULT_NEXT_PATH;
  // "//host" and "/\host" are treated by browsers as another origin.
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_NEXT_PATH;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return DEFAULT_NEXT_PATH;
  if (value.length > 512) return DEFAULT_NEXT_PATH;

  let parsed: URL;
  try {
    parsed = new URL(value, "http://traingrid.invalid");
  } catch {
    return DEFAULT_NEXT_PATH;
  }
  if (parsed.origin !== "http://traingrid.invalid") return DEFAULT_NEXT_PATH;

  // Never loop back into the sign-in flow itself.
  if (parsed.pathname === "/login" || parsed.pathname.startsWith("/auth/")) {
    return DEFAULT_NEXT_PATH;
  }
  return `${parsed.pathname}${parsed.search}`;
}

type HeaderReader = { get(name: string): string | null };

/**
 * The public origin of the current request, e.g. "https://train-grid.vercel.app".
 *
 * Supabase only redirects back to URLs on its allow-list, so a forged Host
 * header cannot be used to send an authorization code elsewhere.
 */
export function originFromHeaders(headers: HeaderReader): string {
  const host = firstValue(headers.get("x-forwarded-host")) ?? headers.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) {
    throw new Error("Cannot determine the request origin.");
  }
  const forwardedProto = firstValue(headers.get("x-forwarded-proto"));
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : isLocal
        ? "http"
        : "https";
  return `${proto}://${host}`;
}

function firstValue(header: string | null): string | null {
  const value = header?.split(",")[0]?.trim();
  return value ? value : null;
}

/** The URL Supabase sends the browser back to after the provider step. */
export function buildCallbackUrl(origin: string, nextPath: string): string {
  const url = new URL("/auth/callback", origin);
  const next = safeNextPath(nextPath);
  if (next !== DEFAULT_NEXT_PATH) url.searchParams.set("next", next);
  return url.toString();
}
