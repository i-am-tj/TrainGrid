import type { OnboardingProgress } from "@/lib/onboarding/model";
import type { Db } from "./model";

/**
 * Whether the member has planned a session, owns a routine, and scheduled a
 * routine. Three head-only counts (no rows are transferred), run in parallel
 * as the member under RLS and narrowed to their user id.
 */
export async function getOnboardingProgress(db: Db, userId: string): Promise<OnboardingProgress> {
  const [sessions, routines, scheduled] = await Promise.all([
    db.from("scheduled_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    db
      .from("routines")
      .select("id", { count: "exact", head: true })
      .eq("scope", "PERSONAL")
      .eq("owner_user_id", userId),
    db
      .from("scheduled_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("source_routine_id", "is", null),
  ]);
  if (sessions.error || routines.error || scheduled.error) throw new Error("Could not load your progress.");
  return {
    plannedSession: (sessions.count ?? 0) > 0,
    ownRoutine: (routines.count ?? 0) > 0,
    scheduledRoutine: (scheduled.count ?? 0) > 0,
  };
}
