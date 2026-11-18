/**
 * The deployment's public origin, e.g. "https://traingrid.example.com".
 *
 * Used where a URL must not come from the request: absolute metadata URLs and
 * the sign-in link inside invitation emails. A forged Host header can change
 * what one request sees, but never what is written into an email.
 *
 *   1. TRAINGRID_SITE_URL, set explicitly per environment (preferred);
 *   2. otherwise, on Vercel, VERCEL_PROJECT_PRODUCTION_URL, which Vercel sets
 *      to the project's production domain (host only, always HTTPS);
 *   3. otherwise null: the caller decides what "unknown" means.
 *
 * Pure: the environment is a parameter, so it is unit-testable.
 */

type Env = Record<string, string | undefined>;

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/i;

/** An absolute origin, or null if the value is not one we would trust. */
export function parseSiteOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.protocol === "https:") return url.origin;
  // Plain HTTP only for local development and tests.
  if (url.protocol === "http:" && LOCAL_HOST.test(url.hostname)) return url.origin;
  return null;
}

export function configuredSiteOrigin(env: Env = process.env): string | null {
  const explicit = parseSiteOrigin(env.TRAINGRID_SITE_URL);
  if (explicit) return explicit;
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost && /^[a-z0-9.-]+$/i.test(vercelHost)) {
    return parseSiteOrigin(`https://${vercelHost}`);
  }
  return null;
}

/** For `metadataBase`; null lets Next.js fall back to the request. */
export function siteMetadataBase(env: Env = process.env): URL | null {
  const origin = configuredSiteOrigin(env);
  return origin ? new URL(origin) : null;
}

/**
 * The canonical URL of a public page, only when the origin was set explicitly.
 * A preview deployment must not claim to be canonical for production.
 */
export function canonicalUrl(path: string, env: Env = process.env): string | null {
  const origin = parseSiteOrigin(env.TRAINGRID_SITE_URL);
  return origin ? new URL(path, origin).toString() : null;
}

/** The sign-in page on the trusted origin, or null when the origin is unknown. */
export function trustedLoginUrl(env: Env = process.env): string | null {
  const origin = configuredSiteOrigin(env);
  return origin ? `${origin}/login` : null;
}

/**
 * The owner's contact address for the privacy notice and terms
 * (TRAINGRID_CONTACT_EMAIL), or null when it is not set or not an address.
 */
export function contactEmail(env: Env = process.env): string | null {
  const value = env.TRAINGRID_CONTACT_EMAIL?.trim();
  if (!value || value.length > 254) return null;
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value) ? value : null;
}
