/**
 * Which paths can be reached without a session. Pure, no I/O.
 *
 * Everything is private unless listed here. New routes are therefore
 * protected by default.
 */

const PUBLIC_PATHS = new Set(["/login", "/auth/callback", "/api/health"]);

export function isPublicPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_PATHS.has(path);
}

/** API routes answer 401 instead of redirecting to an HTML page. */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** Where to send an anonymous visitor, remembering what they asked for. */
export function loginPathFor(pathname: string, search: string): string {
  const target = `${pathname}${search}`;
  if (target === "/" || target === "") return "/login";
  return `/login?next=${encodeURIComponent(target)}`;
}
