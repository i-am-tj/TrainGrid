/**
 * Server error reporting (instrumentation.ts → onRequestError).
 *
 * Every server error becomes one structured log line, and — when
 * TRAINGRID_ALERT_WEBHOOK_URL is an https URL (a Slack or Discord incoming
 * webhook) — an alert, at most once per distinct error per 10 minutes on
 * each server instance.
 *
 * Privacy: a report carries the route, the path without its query, the
 * method, the error's class name and Next.js's digest. Never the message
 * (it can contain data), never headers, cookies, bodies or user ids.
 */

export type ErrorReport = {
  at: string;
  route: string;
  path: string;
  method: string;
  kind: string;
  error: string;
  digest: string | null;
};

type RequestInfo = { path: string; method: string };
type ContextInfo = { routePath: string; routeType: string };

const THROTTLE_MS = 10 * 60 * 1000;

export function buildErrorReport(error: unknown, request: RequestInfo, context: ContextInfo, now: Date): ErrorReport {
  const name = error instanceof Error && /^[A-Za-z]{1,60}$/.test(error.name) ? error.name : "Error";
  const rawDigest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;
  return {
    at: now.toISOString(),
    route: context.routePath.slice(0, 200),
    path: (request.path.split(/[?#]/)[0] ?? "").slice(0, 200),
    method: request.method.toUpperCase().slice(0, 10),
    kind: context.routeType.slice(0, 20),
    error: name,
    digest: rawDigest && /^[\w-]{1,64}$/.test(rawDigest) ? rawDigest : null,
  };
}

/** An https webhook URL, or null. Anything else (http, garbage) means no alerts. */
export function alertWebhook(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.TRAINGRID_ALERT_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Remembers which errors were alerted recently, so a burst sends one alert. */
export function createThrottle(windowMs = THROTTLE_MS) {
  const last = new Map<string, number>();
  return (key: string, nowMs: number): boolean => {
    const previous = last.get(key);
    if (previous !== undefined && nowMs - previous < windowMs) return false;
    last.set(key, nowMs);
    // Keep the map small on a long-lived instance.
    if (last.size > 200) for (const [k, t] of last) if (nowMs - t >= windowMs) last.delete(k);
    return true;
  };
}

/** Slack reads `text`, Discord reads `content`; both get the same line. */
export function alertMessage(report: ErrorReport): { text: string; content: string } {
  const line = `TrainGrid server error: ${report.error} on ${report.method} ${report.path} (${report.kind} ${report.route})${report.digest ? ` · digest ${report.digest}` : ""} · ${report.at}`;
  return { text: line, content: line };
}
