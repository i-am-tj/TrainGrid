import { createHmac } from "node:crypto";

/**
 * The client's IP as a keyed hash that changes every UTC day: enough to count
 * requests from one network within the hour, never the address itself, and
 * not linkable from one day to the next.
 */
export function networkHash(ip: string | null, key: string, now: Date = new Date()): string | null {
  const value = ip?.trim();
  if (!value || !key) return null;
  const day = now.toISOString().slice(0, 10);
  return createHmac("sha256", key).update(`invite-request:${day}:${value}`).digest("hex");
}

/** The first address in x-forwarded-for (set by Vercel), else x-real-ip. */
export function clientIp(forwardedFor: string | null, realIp: string | null): string | null {
  const first = forwardedFor?.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = realIp?.trim();
  return real ? real.slice(0, 64) : null;
}
