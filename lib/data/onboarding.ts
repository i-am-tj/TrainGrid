import type { Db } from "./model";

/**
 * Whether the member has ever planned a session. One head-only count (no rows
 * are transferred), run as the member under RLS and narrowed to their user id.
 */
export async function hasPlannedSession(db: Db, userId: string): Promise<boolean> {
  const { count, error } = await db
    .from("scheduled_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .limit(1);
  if (error) throw new Error("Could not check your sessions.");
  return (count ?? 0) > 0;
}
