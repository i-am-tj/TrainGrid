import type { Db } from "./model";

export type ProfileSummary = {
  createdAt: string | null;
  /** Every session the member has planned. */
  sessions: number;
  /** Sessions on or after today. */
  upcoming: number;
  /** The member's own routines (copies and their own). */
  routines: number;
};

/**
 * What the profile page shows: the member's own profile row and three
 * head-only counts (no rows are transferred). Runs as the member under RLS
 * and is narrowed to their user id as well.
 */
export async function getProfileSummary(db: Db, userId: string, todayIso: string): Promise<ProfileSummary> {
  const [profile, sessions, upcoming, routines] = await Promise.all([
    db.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
    db.from("scheduled_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    db
      .from("scheduled_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("date", todayIso),
    db
      .from("routines")
      .select("id", { count: "exact", head: true })
      .eq("scope", "PERSONAL")
      .eq("owner_user_id", userId),
  ]);
  if (profile.error || sessions.error || upcoming.error || routines.error) {
    throw new Error("Could not load your profile.");
  }
  return {
    createdAt: profile.data?.created_at ?? null,
    sessions: sessions.count ?? 0,
    upcoming: upcoming.count ?? 0,
    routines: routines.count ?? 0,
  };
}
