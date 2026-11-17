/**
 * Is this the member's first session since joining?
 *
 * A profile row is created when an invitation is accepted, which happens in
 * the sign-in callback, right after the session itself is created. Supabase
 * records when a session signed in in the token's `amr` claim (seconds since
 * the epoch; one entry per method, e.g. oauth, then any MFA step). So:
 *
 *   profile created at or after this session signed in → the session that
 *   joined → "Welcome". Any later sign-in started after the profile existed
 *   → "Welcome back".
 *
 * A member who was revoked and invited again keeps their old profile row, so
 * they are (correctly) welcomed back. Anything missing or malformed counts as
 * a returning member. Pure: no clock, no I/O.
 */

/** Allowance for the auth server's and the database's clocks disagreeing. */
const CLOCK_SKEW_MS = 5_000;

export function sessionSignedInAt(amr: unknown): number | null {
  if (!Array.isArray(amr)) return null;
  let earliest: number | null = null;
  for (const entry of amr) {
    const timestamp = (entry as { timestamp?: unknown } | null)?.timestamp;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) continue;
    const ms = timestamp * 1000;
    if (earliest === null || ms < earliest) earliest = ms;
  }
  return earliest;
}

export function isFirstVisit(amr: unknown, profileCreatedAt: string | null | undefined): boolean {
  const signedInAt = sessionSignedInAt(amr);
  const joinedAt = profileCreatedAt ? Date.parse(profileCreatedAt) : Number.NaN;
  if (signedInAt === null || !Number.isFinite(joinedAt)) return false;
  return joinedAt >= signedInAt - CLOCK_SKEW_MS;
}
